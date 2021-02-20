import StrictEventEmitter from "strict-event-emitter-types";
import NTClient, { NTClientOptions, NTProtocolVersion, NTProtocolVersionUnsupportedError } from "../nt-client";
import { EventEmitter } from "events";
import { NTtoV3EntryType, V3ClientHandshakeState, V3MessageType, V3MessageTypeToString, V3NTEntry, V3toNTEntryType } from "./v3-types";
import { clientHelloCompleteMessageToBuffer, clientHelloMessageToBuffer, entryAssignmentMessageToBuffer, getNextAvailableMessage, V3EntryAssignmentMessage, V3Message, V3MessageWrapper, V3ProtoVersionUnsupportedMessage } from "./v3-messages";
import { NTEntryType } from "../nt-entry";

export interface V3ClientOptions extends NTClientOptions {

}

interface HandshakeCompleteData {
    clientSideEntries: Map<string, V3NTEntry>;
}

// HandshakeManagerEvents
interface HandshakeManagerEvents {
    stateChange: (oldState: V3ClientHandshakeState, newState: V3ClientHandshakeState) => void;
    handshakeComplete: (data?: HandshakeCompleteData) => void;
    handshakeError: (supportedVersion: NTProtocolVersion) => void;
}
type HandshakeManagerEventEmitter = StrictEventEmitter<EventEmitter, HandshakeManagerEvents>;

export class V3ClientHandshakeManager extends (EventEmitter as new () => HandshakeManagerEventEmitter) {
    private _state: V3ClientHandshakeState = V3ClientHandshakeState.V3HS_NOT_CONNECTED;

    private _writeFunc: (data: Buffer) => Promise<void>;
    private _ident: string;

    private _protocolVersion: NTProtocolVersion = { major: 3, minor: 0 };

    private _serverSideEntries: Map<string, V3NTEntry> = new Map<string, V3NTEntry>();
    private _clientSideEntries: Map<string, V3NTEntry> = new Map<string, V3NTEntry>();

    constructor(clientIdent: string, writeFunc: (data: Buffer) => Promise<void>) {
        super();
        this._writeFunc = writeFunc;
        this._ident = clientIdent;
    }

    public get protocolVersion(): NTProtocolVersion {
        return this._protocolVersion;
    }

    public set protocolVersion(val: NTProtocolVersion) {
        this._protocolVersion = val;
    }

    public beginHandshake(clientEntries?: Map<number, V3NTEntry>, pendingEntries?: Map<string, V3NTEntry>) {
        // Clear out the maps
        this._serverSideEntries.clear();
        this._clientSideEntries.clear();

        // Copy the client entries
        if (clientEntries) {
            // Make sure that we're making a copy, and not actually referencing
            // the real entries
            clientEntries.forEach(entry => {
                this._clientSideEntries.set(entry.name, {...entry});
            });
        }

        if (pendingEntries) {
            clientEntries.forEach(entry => {
                this._clientSideEntries.set(entry.name, {...entry});
            });
        }

        this._writeFunc(clientHelloMessageToBuffer({
            type: V3MessageType.CLIENT_HELLO,
            clientIdent: this._ident,
            protocolMajor: this._protocolVersion.major,
            protocolMinor: this._protocolVersion.minor
        }));

        const oldState = this._state;
        this._state = V3ClientHandshakeState.V3HS_AWAIT_SERVER_HELLO;
        this.emit("stateChange", oldState, this._state);
    }

    // Return true if we handled the message, or false if we ignored it
    public handleMessage(msg: V3Message): boolean {
        if (this._state === V3ClientHandshakeState.V3HS_COMPLETE) {
            return false;
        }

        switch (this._state) {
            case V3ClientHandshakeState.V3HS_AWAIT_SERVER_HELLO: {
                // TODO We also need to check for PROTO_VERSION_UNSUPPORTED
                // and emit an event + bail
                if (msg.type === V3MessageType.SERVER_HELLO) {
                    const oldState = this._state;
                    this._state = V3ClientHandshakeState.V3HS_AWAIT_SERVER_ENTRIES;
                    this.emit("stateChange", oldState, this._state);
                }
                else if (msg.type === V3MessageType.PROTO_VERSION_UNSUPPORTED) {
                    const protoUnsupportedMsg = (msg as V3ProtoVersionUnsupportedMessage);
                    this.emit("handshakeError", {
                        major: protoUnsupportedMsg.serverSupportedProtocolMajor,
                        minor: protoUnsupportedMsg.serverSupportedProtocolMinor
                    });
                }
                return true;
            }
            case V3ClientHandshakeState.V3HS_AWAIT_SERVER_ENTRIES: {
                if (msg.type === V3MessageType.ENTRY_ASSIGNMENT) {
                    const entryAssignmentMsg = (msg as V3EntryAssignmentMessage);
                    const entry: V3NTEntry = {
                        name: entryAssignmentMsg.entryName,
                        type: V3toNTEntryType.get(entryAssignmentMsg.entryType),
                        id: entryAssignmentMsg.entryId,
                        value: entryAssignmentMsg.entryValue,
                        seq: entryAssignmentMsg.entrySeq,
                        flags: entryAssignmentMsg.entryFlags
                    };

                    console.log("ENTRY ASSIGNMENT: ", entry);
                    this._serverSideEntries.set(entryAssignmentMsg.entryName, entry);

                    // Update the corresponding client-store
                    // Just add/update the value
                    this._clientSideEntries.set(entryAssignmentMsg.entryName, {...entry});

                }
                else if (msg.type === V3MessageType.SERVER_HELLO_COMPLETE) {
                    console.log("Received SERVER HELLO COMPLETE");

                    // Then, for every one of the items in our client side
                    // store that is NOT in the serverside store, send an entryAssign
                    const entriesToSend: V3NTEntry[] = [];
                    this._clientSideEntries.forEach((entry, name) => {
                        if (!this._serverSideEntries.has(name)) {
                            // Reset the ID and sequence fields
                            entry.id = 0xFFFF;
                            entry.seq = 0;

                            entriesToSend.push(entry);
                        }
                    });

                    if (entriesToSend.length > 0) {
                        console.log(`${entriesToSend.length} client side entries to send`);

                        entriesToSend.forEach(entry => {
                            this._writeFunc(entryAssignmentMessageToBuffer({
                                type: V3MessageType.ENTRY_ASSIGNMENT,
                                entryName: entry.name,
                                entryId: entry.id,
                                entrySeq: entry.seq,
                                entryType: NTtoV3EntryType.get(entry.type),
                                entryValue: entry.value,
                                entryFlags: entry.flags
                            }));
                        });
                    }

                    this._writeFunc(clientHelloCompleteMessageToBuffer());
                    const oldState = this._state;
                    this._state = V3ClientHandshakeState.V3HS_COMPLETE;
                    this.emit("stateChange", oldState, this._state);

                    this.emit("handshakeComplete", {
                        clientSideEntries: this._clientSideEntries
                    });
                }

                return true;
            }
        }
    }
}

export default class V3NTClient extends NTClient {
    // Handler for handshake data
    private _handshakeDataHandler: (data: Buffer) => void;

    private _entryNameToId: Map<string, number> = new Map<string, number>();
    private _entries: Map<number, V3NTEntry> = new Map<number, V3NTEntry>();

    // Pending entries are those in which the client side has seen, but the
    // server hasn't actually assigned yet
    private _pendingEntries: Map<string, V3NTEntry> = new Map<string, V3NTEntry>();

    private _pendingMessages: V3Message[] = [];

    // Remaining un-processed data
    private _dataBuffer: Buffer;

    private _handshakeManager: V3ClientHandshakeManager;

    constructor(options?: V3ClientOptions) {
        super({major: 3, minor: 0}, options);

        // TODO handle additional options, if present

        this._handshakeManager = new V3ClientHandshakeManager("fooclient", (data: Buffer) => {
            return this._write(data, true);
        });
    }

    protected _handshake(): Promise<void> {
        // TEST
        this._entries.set(22, {
            name: "/foo/client data",
            type: NTEntryType.STRING,
            seq: 6,
            id: 22,
            flags: { persistent: false },
            value: {
                str: "hello world"
            }
        });

        return new Promise((resolve, reject) => {
            this._handshakeManager.beginHandshake(this._entries, this._pendingEntries);
            this._handshakeManager.on("handshakeComplete", (data) => {
                console.log("Handshake Complete");
                // Update our client side with the new entries/updated
                if (data) {
                    // Regenerate the entries
                    // note that ID of 0xFFFF = pending server side
                    this._entryNameToId.clear();
                    this._entries.clear();

                    this._pendingEntries.clear();

                    data.clientSideEntries.forEach((entry, name) => {
                        if (entry.id !== 0xFFFF) {
                            // Real, server-assigned record
                            this._entries.set(entry.id, {...entry});
                            this._entryNameToId.set(entry.name, entry.id);
                        }
                        else {
                            // Pending entry
                            this._pendingEntries.set(entry.name, {...entry});
                        }
                    });

                    console.log(`Post Handshake: ${this._entries.size} server assigned entries, ${this._pendingEntries.size} pending entries`);
                }
                resolve();
            });
            this._handshakeManager.on("handshakeError", supportedVersion => {
                reject(new NTProtocolVersionUnsupportedError(supportedVersion, `Server only supports version ${supportedVersion.major}.${supportedVersion.minor}`));
            });
        });
    }

    protected _handleData(data: Buffer): void {
        if (!this._dataBuffer) {
            this._dataBuffer = Buffer.allocUnsafe(data.length);
            data.copy(this._dataBuffer, 0, 0);
        }
        else {
            this._dataBuffer = Buffer.concat([
                this._dataBuffer,
                data
            ]);
        }

        let nextMessageResult: V3MessageWrapper;
        while (nextMessageResult = getNextAvailableMessage(this._dataBuffer)) {
            console.log("GOT A MESSAGE: ", V3MessageTypeToString.get(nextMessageResult.message.type));
            this._pendingMessages.push(nextMessageResult.message);
            this._dataBuffer = Buffer.from(this._dataBuffer.slice(nextMessageResult.newOffset));
        }

        // Now we have pending messages
        if (!this.connected) {
            // Hand off to the handshake manager?
            let lastMessage: V3Message;
            while (this._pendingMessages.length > 0) {
                lastMessage = this._pendingMessages.shift();

                if (!this._handshakeManager.handleMessage(lastMessage)) {
                    this._pendingMessages.unshift(lastMessage);
                    break;
                }
            }
        }
        else {
            // We care about ENTRY_ASSIGNMENT, ENTRY_UPDATE, ENTRY_FLAG_UPDATE
            // ENTRY_DELETE, CLEAR_ALL_ENTRIES
            // TBD RPC
        }
    }
}
