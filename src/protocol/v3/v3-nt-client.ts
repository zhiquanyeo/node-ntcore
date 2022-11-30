import StrictEventEmitter from "strict-event-emitter-types";
import NTClient, { NTClientOptions } from "../nt-client";
import { EventEmitter } from "events";
import { NTtoV3EntryType, V3ClientHandshakeState, V3EntryFlags, V3EntryType, V3MessageType, V3MessageTypeToString, V3RPCDefinition, V3toNTEntryType, V3_DEFAULT_FLAGS } from "./v3-types";
import { clientHelloCompleteMessageToBuffer, clientHelloMessageToBuffer, entryAssignmentMessageToBuffer, entryDeleteMessageToBuffer, entryFlagsUpdateMessageToBuffer, entryUpdateMessageToBuffer, getNextAvailableMessage, V3ClearAllEntriesMessage, V3EntryAssignmentMessage, V3EntryDeleteMessage, V3EntryFlagsUpdateMessage, V3EntryUpdateMessage, V3Message, V3MessageWrapper, V3ProtoVersionUnsupportedMessage, V3RPCResponseMessage } from "./v3-messages";
import NTEntry, { NTEntryFlags, NTEntryType } from "../nt-entry";
import { NTEntryNotFoundError, NTEntryTypeMismatchError, NTEventUpdateSource, NTProtocolVersion, NTProtocolVersionUnsupportedError } from "../nt-types";
import { ntValueIsEqual } from "../protocol-utils";
import winston from "winston";
import LogUtil from "../../utils/log-util";
import { toNetworkTableType } from "../../networktables/network-table-instance";

export interface V3ClientOptions extends NTClientOptions {

}

interface HandshakeCompleteData {
    clientSideEntries: Map<string, NTEntry>;
}

// HandshakeManagerEvents
interface HandshakeManagerEvents {
    stateChange: (oldState: V3ClientHandshakeState, newState: V3ClientHandshakeState) => void;
    handshakeComplete: (data?: HandshakeCompleteData) => void;
    handshakeError: (supportedVersion: NTProtocolVersion) => void;
}
type HandshakeManagerEventEmitter = StrictEventEmitter<EventEmitter, HandshakeManagerEvents>;

export class V3ClientHandshakeManager extends (EventEmitter as new () => HandshakeManagerEventEmitter) {
    private _logger: winston.Logger;
    private _state: V3ClientHandshakeState = V3ClientHandshakeState.V3HS_NOT_CONNECTED;

    private _writeFunc: (data: Buffer) => Promise<void>;
    private _ident: string;

    private _protocolVersion: NTProtocolVersion = { major: 3, minor: 0 };

    private _serverSideEntries: Map<string, NTEntry> = new Map<string, NTEntry>();
    private _clientSideEntries: Map<string, NTEntry> = new Map<string, NTEntry>();

    constructor(clientIdent: string, writeFunc: (data: Buffer) => Promise<void>, logger: winston.Logger) {
        super();

        this._logger = logger;
        this._writeFunc = writeFunc;
        this._ident = clientIdent;
    }

    public get protocolVersion(): NTProtocolVersion {
        return this._protocolVersion;
    }

    public set protocolVersion(val: NTProtocolVersion) {
        this._protocolVersion = val;
    }

    public beginHandshake(clientEntries?: Map<number, NTEntry>, pendingEntries?: Map<string, NTEntry>) {
        this._logger.silly("Beginning Handshake");
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
            pendingEntries.forEach(entry => {
                this._clientSideEntries.set(entry.name, {...entry});
            });
        }

        this._logger.silly("Preparing to send CLIENT HELLO");
        this._writeFunc(clientHelloMessageToBuffer({
            type: V3MessageType.CLIENT_HELLO,
            clientIdent: this._ident,
            protocolMajor: this._protocolVersion.major,
            protocolMinor: this._protocolVersion.minor
        }))
        .then(() => {
            this._logger.silly("CLIENT HELLO sent");
        });

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
                    const entry: NTEntry = {
                        name: entryAssignmentMsg.entryName,
                        type: V3toNTEntryType.get(entryAssignmentMsg.entryType),
                        id: entryAssignmentMsg.entryId,
                        value: entryAssignmentMsg.entryValue,
                        seq: entryAssignmentMsg.entrySeq,
                        flags: entryAssignmentMsg.entryFlags
                    };

                    this._logger.debug("ENTRY ASSIGNMENT: ", entry);
                    this._serverSideEntries.set(entryAssignmentMsg.entryName, entry);

                    // Update the corresponding client-store
                    // Just add/update the value
                    this._clientSideEntries.set(entryAssignmentMsg.entryName, {...entry});

                }
                else if (msg.type === V3MessageType.SERVER_HELLO_COMPLETE) {
                    this._logger.debug("Received SERVER HELLO COMPLETE");

                    // Then, for every one of the items in our client side
                    // store that is NOT in the serverside store, send an entryAssign
                    const entriesToSend: NTEntry[] = [];
                    this._clientSideEntries.forEach((entry, name) => {
                        if (!this._serverSideEntries.has(name)) {
                            // Reset the ID and sequence fields
                            entry.id = 0xFFFF;
                            entry.seq = 0;

                            entriesToSend.push(entry);
                        }
                    });

                    if (entriesToSend.length > 0) {
                        this._logger.debug(`${entriesToSend.length} client side entries to send`);

                        entriesToSend.forEach(entry => {
                            this._writeFunc(entryAssignmentMessageToBuffer({
                                type: V3MessageType.ENTRY_ASSIGNMENT,
                                entryName: entry.name,
                                entryId: entry.id,
                                entrySeq: entry.seq,
                                entryType: NTtoV3EntryType.get(entry.type),
                                entryValue: entry.value,
                                entryFlags: entry.flags || V3_DEFAULT_FLAGS
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
    private _entryNameToId: Map<string, number> = new Map<string, number>();
    private _entries: Map<number, NTEntry> = new Map<number, NTEntry>();

    // RPC Definitions
    private _rpcDefinitions: Map<number, V3RPCDefinition> = new Map<number, V3RPCDefinition>();

    // Pending entries are those in which the client side has seen, but the
    // server hasn't actually assigned yet
    private _pendingEntries: Map<string, NTEntry> = new Map<string, NTEntry>();

    private _pendingMessages: V3Message[] = [];

    // Remaining un-processed data
    private _dataBuffer: Buffer;

    private _handshakeManager: V3ClientHandshakeManager;

    constructor(options?: V3ClientOptions) {
        super({major: 3, minor: 0}, options);

        this._logger = LogUtil.getLogger("NTCORE-CLIENT-V3");

        if (options && options.identifier) {
            this._identifier = options.identifier;
        }
        else {
            this._identifier = `node-ntcore-${Date.now()}`;
        }

        this._handshakeManager = new V3ClientHandshakeManager(this._identifier, (data: Buffer) => {
            return this._write(data, true);
        }, this._logger);

        this._handshakeManager.protocolVersion = this.version;
    }

    public get identifier(): string {
        return this._identifier;
    }

    // Public API
    public setBoolean(key: string, val: boolean): boolean {
        const newEntry: NTEntry = {
            type: NTEntryType.BOOLEAN,
            name: key,
            value: {
                bool: val
            },
            id: 0xFFFF,
            seq: 0,
        }

        return this._setEntryData(newEntry);
    }

    public getBoolean(key: string): boolean {
        return this._getEntry(key, NTEntryType.BOOLEAN).value.bool;
    }

    public setDouble(key: string, val: number): boolean {
        const newEntry: NTEntry = {
            type: NTEntryType.DOUBLE,
            name: key,
            value: {
                double: val
            },
            id: 0xFFFF,
            seq: 0,
        }

        return this._setEntryData(newEntry);
    }

    public getDouble(key: string): number {
        return this._getEntry(key, NTEntryType.DOUBLE).value.double;
    }

    public setString(key: string, val: string): boolean {
        const newEntry: NTEntry = {
            type: NTEntryType.STRING,
            name: key,
            value: {
                str: val
            },
            id: 0xFFFF,
            seq: 0,
        }

        return this._setEntryData(newEntry);
    }

    public getString(key: string): string {
        return this._getEntry(key, NTEntryType.STRING).value.str;
    }

    public setBooleanArray(key: string, val: boolean[]): boolean {
        const newEntry: NTEntry = {
            type: NTEntryType.BOOLEAN_ARRAY,
            name: key,
            value: {
                bool_array: val
            },
            id: 0xFFFF,
            seq: 0,
        }

        return this._setEntryData(newEntry);
    }

    public getBooleanArray(key: string): boolean[] {
        return this._getEntry(key, NTEntryType.BOOLEAN_ARRAY).value.bool_array;
    }

    public setDoubleArray(key: string, val: number[]): boolean {
        const newEntry: NTEntry = {
            type: NTEntryType.DOUBLE_ARRAY,
            name: key,
            value: {
                double_array: val
            },
            id: 0xFFFF,
            seq: 0,
        }

        return this._setEntryData(newEntry);
    }

    public getDoubleArray(key: string): number[] {
        return this._getEntry(key, NTEntryType.DOUBLE_ARRAY).value.double_array;
    }

    public setStringArray(key: string, val: string[]): boolean {
        const newEntry: NTEntry = {
            type: NTEntryType.STRING_ARRAY,
            name: key,
            value: {
                str_array: val
            },
            id: 0xFFFF,
            seq: 0,
        }

        return this._setEntryData(newEntry);
    }

    public getStringArray(key: string): string[] {
        return this._getEntry(key, NTEntryType.STRING_ARRAY).value.str_array;
    }

    public setRaw(key: string, val: Buffer): boolean {
        const newEntry: NTEntry = {
            type: NTEntryType.RAW,
            name: key,
            value: {
                raw: val
            },
            id: 0xFFFF,
            seq: 0,
        }

        return this._setEntryData(newEntry);
    }

    public getRaw(key: string): Buffer {
        const entryBuffer = this._getEntry(key, NTEntryType.RAW).value.raw;
        const bufCopy = Buffer.allocUnsafe(entryBuffer.length);
        entryBuffer.copy(bufCopy);

        return bufCopy;
    }

    public deleteEntry(key: string): boolean {
        if (this._entryNameToId.has(key)) {
            const entryId = this._entryNameToId.get(key);
            const entry = this._entries.get(entryId);

            this._entries.delete(entryId);
            this._entryNameToId.delete(key);

            this._write(entryDeleteMessageToBuffer({
                type: V3MessageType.ENTRY_DELETE,
                entryId
            }));

            this.emit("entryDeleted", {
                source: NTEventUpdateSource.LOCAL,
                entry: {...entry}
            });

            return true;
        }

        return false;
    }

    public updateEntryFlags(key: string, flags: NTEntryFlags): boolean {
        if (this._entryNameToId.has(key)) {
            const entryId = this._entryNameToId.get(key);
            const entry = this._entries.get(entryId);

            entry.flags = (flags as V3EntryFlags);

            this._write(entryFlagsUpdateMessageToBuffer({
                type: V3MessageType.ENTRY_FLAGS_UPDATE,
                entryId,
                entryFlags: entry.flags
            }));

            this.emit("entryFlagsUpdated", {
                source: NTEventUpdateSource.LOCAL,
                entry: {...entry}
            });

            return true;
        }

        return false;
    }

    protected _handshake(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._handshakeManager.beginHandshake(this._entries, this._pendingEntries);
            this._handshakeManager.once("handshakeComplete", (data) => {
                this._logger.debug("Handshake Complete");
                // Update our client side with the new entries/updated
                if (data) {
                    // Regenerate the entries
                    // note that ID of 0xFFFF = pending server side
                    this._entryNameToId.clear();
                    this._entries.clear();

                    this._pendingEntries.clear();
                    this._rpcDefinitions.clear();

                    data.clientSideEntries.forEach((entry, name) => {
                        // TODO We should broadcast the events here
                        // Also, we should check to see if we already had
                        // an existing record, which would mean that we've
                        // reconnected to a server
                        if (entry.id !== 0xFFFF) {
                            // Real, server-assigned record
                            let sendUpdateEvent: boolean = false;
                            if (this._entryNameToId.has(entry.name)) {
                                // TODO This is something that we already have
                                // send an update event
                                sendUpdateEvent = true;
                            }

                            this._entries.set(entry.id, {...entry});
                            this._entryNameToId.set(entry.name, entry.id);

                            if (entry.type === NTEntryType.RPC) {
                                this._rpcDefinitions.set(entry.id, (entry.value.rpc as V3RPCDefinition));
                            }

                            if (sendUpdateEvent) {
                                this.emit("entryUpdated", {
                                    source: NTEventUpdateSource.REMOTE,
                                    entry: {...entry}
                                });
                            }
                            else {
                                this.emit("entryAdded", {
                                    source: NTEventUpdateSource.REMOTE,
                                    entry: {...entry}
                                });
                            }
                        }
                        else {
                            // Pending entry
                            this._pendingEntries.set(entry.name, {...entry});

                            this.emit("entryUpdated", {
                                source: NTEventUpdateSource.LOCAL,
                                entry: {...entry}
                            });
                        }
                    });

                    this._logger.debug(`Post Handshake: ${this._entries.size} server assigned entries, ${this._pendingEntries.size} pending entries`);
                }
                resolve();
            });
            this._handshakeManager.once("handshakeError", supportedVersion => {
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
        while (nextMessageResult = getNextAvailableMessage(this._rpcDefinitions, this._dataBuffer)) {
            this._logger.debug("GOT A MESSAGE: ", V3MessageTypeToString.get(nextMessageResult.message.type));
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
            let lastMessage: V3Message;
            while (this._pendingMessages.length > 0) {
                lastMessage = this._pendingMessages.shift();

                switch (lastMessage.type) {
                    case V3MessageType.ENTRY_ASSIGNMENT: {
                        this._handleEntryAssignment((lastMessage as V3EntryAssignmentMessage));
                    } break;
                    case V3MessageType.ENTRY_UPDATE: {
                        this._handleEntryUpdate((lastMessage as V3EntryUpdateMessage));
                    } break;
                    case V3MessageType.ENTRY_FLAGS_UPDATE: {
                        this._handleEntryFlagsUpdate((lastMessage as V3EntryFlagsUpdateMessage));
                    } break;
                    case V3MessageType.ENTRY_DELETE: {
                        this._handleEntryDelete((lastMessage as V3EntryDeleteMessage));
                    } break;
                    case V3MessageType.CLEAR_ALL_ENTRIES: {
                        this._handleClearAllEntries((lastMessage as V3ClearAllEntriesMessage));
                    } break;
                    case V3MessageType.RPC_RESPONSE: {
                        this._handleRPCRespnse((lastMessage as V3RPCResponseMessage));
                    } break;
                    // NOTE: We don't handle RPC_EXECUTE messages as a client
                    default: {
                        this._logger.debug(`Dropping ${V3MessageTypeToString.get(lastMessage.type)} message (not handled)`);
                    }
                }
            }
        }
    }

    private _handleEntryAssignment(msg: V3EntryAssignmentMessage) {
        let pendingEntryChanged = false;
        let isPendingEntry = false;

        // Getting an entry assignment from the server
        if (this._entryNameToId.has(msg.entryName)) {
            let entry = this._entries.get(msg.entryId);
            this._logger.info("Client has existing key, deleting: " + msg.entryName + 
                " id: " + msg.entryId + 
                " NetworkTableType old: " + toNetworkTableType(entry.type) + 
                " new: " + toNetworkTableType(V3toNTEntryType.get(msg.entryType)) );
            this.emit("entryDeleted", {
			          source: NTEventUpdateSource.REMOTE,
                      entry: {...this._entries.get(msg.entryId)}
			} );
        }
        else if (this._pendingEntries.has(msg.entryName)) {
            isPendingEntry = true;
            // Promote this pending entry into a real entry
            this._logger.debug(`Promoting ${msg.entryName} from pending to full entry`);

            const pendingEntry = this._pendingEntries.get(msg.entryName);
            if (!ntValueIsEqual(pendingEntry.value, msg.entryValue)) {
                pendingEntryChanged = true;
            }
            this._pendingEntries.delete(msg.entryName);
        }

        this._entries.set(msg.entryId, {
            name: msg.entryName,
            id: msg.entryId,
            type: V3toNTEntryType.get(msg.entryType),
            value: msg.entryValue,
            seq: msg.entrySeq,
            flags: msg.entryFlags
        });
        this._entryNameToId.set(msg.entryName, msg.entryId);

        this._logger.debug(`Added new entry ${msg.entryName}: `, this._entries.get(msg.entryId));

        if (msg.entryType === V3EntryType.RPC) {
            this._rpcDefinitions.set(msg.entryId, (msg.entryValue as V3RPCDefinition));
            this._logger.debug(`Added new RPC Definition ${msg.entryName}: `, msg.entryValue);
        }

        if (!isPendingEntry) {
            // If this wasn't a pending entry, it means it came from the remote
            this.emit("entryAdded", {
                source: NTEventUpdateSource.REMOTE,
                entry: {...this._entries.get(msg.entryId)}
            });
        }
        else if (pendingEntryChanged) {
            // If we did have a pending entry (and it changed)
            this.emit("entryUpdated", {
                source: NTEventUpdateSource.REMOTE,
                entry: {...this._entries.get(msg.entryId)}
            });
        }
    }

    private _handleEntryUpdate(msg: V3EntryUpdateMessage) {
        if (this._entries.has(msg.entryId)) {
            const entry = this._entries.get(msg.entryId);
            entry.seq = msg.entrySeq;
            entry.value = {...msg.entryValue}

            this._logger.debug(`Updated entry ${entry.name}: `, entry);
            this.emit("entryUpdated", {
                source: NTEventUpdateSource.REMOTE,
                entry: {...entry}
            });
        }
    }

    private _handleEntryFlagsUpdate(msg: V3EntryFlagsUpdateMessage) {
        if (this._entries.has(msg.entryId)) {
            const entry = this._entries.get(msg.entryId);
            entry.flags = {...msg.entryFlags};

            this._logger.debug(`Updated Entry Flags ${entry.name}: `, entry);
            this.emit("entryFlagsUpdated", {
                source: NTEventUpdateSource.REMOTE,
                entry: {...entry}
            });
        }
    }

    private _handleEntryDelete(msg: V3EntryDeleteMessage) {
        if (this._entries.has(msg.entryId)) {
            const entry = this._entries.get(msg.entryId);

            this._entries.delete(entry.id);
            this._entryNameToId.delete(entry.name);

            this._logger.debug(`Deleted Entry: ${entry.name}`);
            this.emit("entryDeleted", {
                source: NTEventUpdateSource.REMOTE,
                entry: {...entry}
            });
        }
    }

    private _handleClearAllEntries(msg: V3ClearAllEntriesMessage) {
        // Unclear if we will ever get this
    }

    private _handleRPCRespnse(msg: V3RPCResponseMessage) {
        // TODO Implement
    }

    private _setEntryData(newEntry: NTEntry): boolean {
        const key = newEntry.name;

        if (this._entryNameToId.has(key)) {
            const currEntryId = this._entryNameToId.get(key);
            const currEntry = this._entries.get(currEntryId);

            if (currEntry.type !== newEntry.type) {
                return false;
            }

            if (ntValueIsEqual(currEntry.value, newEntry.value)) {
                // Bail out early if the values are the same
                return true;
            }

            newEntry.id = currEntryId;
            newEntry.seq = currEntry.seq + 1;
            newEntry.flags = currEntry.flags;

            // Update the entries map, and send the message
            this._entries.set(currEntryId, newEntry);
            this._write(entryUpdateMessageToBuffer({
                type: V3MessageType.ENTRY_UPDATE,
                entryType: NTtoV3EntryType.get(newEntry.type),
                entryId: newEntry.id,
                entrySeq: newEntry.seq,
                entryValue: newEntry.value
            }));

            // We should emit a LOCAL entryUpdate message here
            this.emit("entryUpdated", {
                source: NTEventUpdateSource.LOCAL,
                entry: {...newEntry}
            });
        }
        else if (this._pendingEntries.has(key)) {
            // If a pending message exists with this key, just update the record
            this._pendingEntries.set(key, newEntry);

            // This is a LOCAL change only since it's still pending
            this.emit("entryUpdated", {
                source: NTEventUpdateSource.LOCAL,
                entry: {...newEntry}
            });
        }
        else {
            // Need to create a new record
            newEntry.seq = 0;
            newEntry.id = 0xFFFF;

            this._pendingEntries.set(key, newEntry);
            this._write(entryAssignmentMessageToBuffer({
                type: V3MessageType.ENTRY_ASSIGNMENT,
                entryType: NTtoV3EntryType.get(newEntry.type),
                entryId: 0xFFFF,
                entrySeq: 0,
                entryValue: newEntry.value,
                entryName: newEntry.name,
                entryFlags: newEntry.flags ? newEntry.flags : V3_DEFAULT_FLAGS
            }));

            this.emit("entryAdded", {
                source: NTEventUpdateSource.LOCAL,
                entry: {...newEntry}
            });
        }

        return true;
    }

    private _getEntry(key: string, type: NTEntryType): NTEntry {
        if (this._entryNameToId.has(key)) {
            const currEntryId = this._entryNameToId.get(key);
            const currEntry = this._entries.get(currEntryId);

            // Check types
            if (currEntry.type !== type) {
                throw new NTEntryTypeMismatchError(`Could not convert types`);
            }

            return {...currEntry};
        }
        else if (this._pendingEntries.has(key)) {
            return {...this._pendingEntries.get(key)};
        }

        throw new NTEntryNotFoundError(`Could not find entry with key "${key}"`);
    }
}
