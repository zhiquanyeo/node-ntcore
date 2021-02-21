import StrictEventEmitter from "strict-event-emitter-types";
import { EventEmitter } from "events";
import { Socket } from "net";
import { NTtoV3EntryType, V3EntryFlags, V3MessageType, V3MessageTypeToString, V3RPCDefinition, V3ServerHandshakeState, V3toNTEntryType, V3_DEFAULT_FLAGS } from "./v3-types";
import { NTEntryNotFoundError, NTEntryTypeMismatchError, NTEventUpdateSource, NTProtocolVersion } from "../nt-types";
import NTEntry, { NTEntryFlags, NTEntryType } from "../nt-entry";
import NTServer, { NTServerOptions } from "../nt-server";
import { clearAllEntriesMessageToBuffer, entryAssignmentMessageToBuffer, entryDeleteMessageToBuffer, entryFlagsUpdateMessageToBuffer, entryUpdateMessageToBuffer, getNextAvailableMessage, serverHelloCompleteMessageToBuffer, serverHelloMessageToBuffer, V3ClearAllEntriesMessage, V3EntryAssignmentMessage, V3EntryDeleteMessage, V3EntryFlagsUpdateMessage, V3EntryUpdateMessage, V3Message, V3MessageWrapper, V3RPCExecuteMessage } from "./v3-messages";
import { ntValueIsEqual } from "../protocol-utils";

export interface V3ServerOptions extends NTServerOptions {

}

export class NTClientConnection extends EventEmitter {
    private _socket: Socket;
    private _serverEntries: Map<number, NTEntry>;
    private _rpcDefinitions: Map<number, V3RPCDefinition>;

    private _dataBuffer: Buffer;
    private _pendingMessages: V3Message[] = [];

    private _serverIdent: string;

    constructor(socket: Socket, serverIdent: string, serverEntries: Map<number, NTEntry>) {
        super();

        this._socket = socket;
        this._serverEntries = serverEntries;

        this._socket.on("data", (data) => {
            this._handleData(data);
        });

        this._socket.on("close", () => {
            this.emit("connectionClosed");
        });
    }

    public write(data: Buffer): void {
        this._socket.write(data);
    }

    private _handleData(data: Buffer): void {
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
            this._pendingMessages.push(nextMessageResult.message);
            this._dataBuffer = Buffer.from(this._dataBuffer.slice(nextMessageResult.newOffset));
        }

        let lastMessage: V3Message;
        while (this._pendingMessages.length > 0) {
            lastMessage = this._pendingMessages.shift();

            switch (lastMessage.type) {
                case V3MessageType.CLIENT_HELLO: {
                    // Client HELLO. Write the Server hello and all messages we have
                    this.write(serverHelloMessageToBuffer({
                        type: V3MessageType.SERVER_HELLO,
                        clientPreviouslySeen: false,
                        serverIdentity: ""
                    }));

                    this._serverEntries.forEach(entry => {
                        this.write(entryAssignmentMessageToBuffer({
                            type: V3MessageType.ENTRY_ASSIGNMENT,
                            entryName: entry.name,
                            entryId: entry.id,
                            entrySeq: entry.seq,
                            entryType: NTtoV3EntryType.get(entry.type),
                            entryValue: entry.value,
                            entryFlags: entry.flags
                        }));
                    });

                    this.write(serverHelloCompleteMessageToBuffer());
                } break;
                case V3MessageType.ENTRY_ASSIGNMENT: {
                    this.emit("entryAssignment", lastMessage);
                } break;
                case V3MessageType.ENTRY_UPDATE: {
                    this.emit("entryUpdate", lastMessage);
                } break;
                case V3MessageType.ENTRY_FLAGS_UPDATE: {
                    this.emit("entryFlagsUpdate", lastMessage);
                } break;
                case V3MessageType.ENTRY_DELETE: {
                    this.emit("entryDelete", lastMessage);
                }
                case V3MessageType.CLEAR_ALL_ENTRIES: {
                    this.emit("clearAllEntries", lastMessage);
                } break;
                case V3MessageType.RPC_EXECUTE: {
                    this.emit("rpcExecute", lastMessage);
                } break;
                case V3MessageType.KEEP_ALIVE:
                    break;
                default: {
                    console.log(`Dropping ${V3MessageTypeToString.get(lastMessage.type)} message (not handled)`);
                }
            }
        }
    }
}

export default class V3NTServer extends NTServer {
    private _connections: NTClientConnection[] = [];

    private _entryNameToId: Map<string, number> = new Map<string, number>();
    private _entries: Map<number, NTEntry> = new Map<number, NTEntry>();

    private _rpcDefinitions: Map<number, V3RPCDefinition> = new Map<number, V3RPCDefinition>();

    private _nextId = 0;

    constructor(options?: V3ServerOptions) {
        super({ major: 3, minor: 0 }, options);
    }

    public setBoolean(key: string, val: boolean): boolean {
        const newEntry: NTEntry = {
            type: NTEntryType.BOOLEAN,
            name: key,
            value: {
                bool: val
            },
            id: 0xFFFF,
            seq: 0,
        };

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
        };

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
        };

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
        };

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
        };

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
        };

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
        };

        return this._setEntryData(newEntry);
    }

    public getRaw(key: string): Buffer {
        return this._getEntry(key, NTEntryType.RAW).value.raw;
    }

    public deleteEntry(key: string): boolean {
        if (this._entryNameToId.has(key)) {
            const entryId = this._entryNameToId.get(key);
            const entry = this._entries.get(entryId);

            this._entries.delete(entryId);
            this._entryNameToId.delete(key);

            this._broadcast(null, entryDeleteMessageToBuffer({
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

            this._broadcast(null, entryFlagsUpdateMessageToBuffer({
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

    protected _onSocketConnected(socket: Socket) {
        const conn = new NTClientConnection(socket, this._identifier, this._entries);
        this._connections.push(conn);

        conn.on("connectionClosed", () => {
            for (let i = 0; i < this._connections.length; i++) {
                if (this._connections[i] === conn) {
                    this._connections.splice(i, 1);
                    break;
                }
            }
        });

        conn.on("entryAssignment", (msg: V3EntryAssignmentMessage) => {
            if (msg.entryId === 0xFFFF) {
                const entryId = this._nextId;
                this._nextId++;

                msg.entryId = entryId;
                msg.entrySeq = 0;

                this._entries.set(entryId, {
                    name: msg.entryName,
                    id: entryId,
                    type: V3toNTEntryType.get(msg.entryType),
                    value: msg.entryValue,
                    seq: 0,
                    flags: msg.entryFlags
                });
                this._entryNameToId.set(msg.entryName, entryId);

                // Broadcast
                this._broadcast(null, entryAssignmentMessageToBuffer(msg));

                // Emit the entryAdded event
                this.emit("entryAdded", {
                    source: NTEventUpdateSource.REMOTE,
                    entry: {...this._entries.get(entryId)}
                });
            }
        });

        conn.on("entryUpdate", (msg: V3EntryUpdateMessage) => {
            if (this._entries.has(msg.entryId)) {
                const entry = this._entries.get(msg.entryId);

                if (msg.entrySeq <= entry.seq) {
                    // the client sequence number is less than ours. reject this
                    return;
                }
                
                // Update the sequence number
                entry.seq = msg.entrySeq;
                
                if (entry.type !== V3toNTEntryType.get(msg.entryType)) {
                    return;
                }

                entry.value = {...msg.entryValue};
                this._broadcast(conn, entryUpdateMessageToBuffer({
                    type: V3MessageType.ENTRY_UPDATE,
                    entryId: entry.id,
                    entrySeq: entry.seq,
                    entryType: NTtoV3EntryType.get(entry.type),
                    entryValue: entry.value
                }));

                this.emit("entryUpdated", {
                    source: NTEventUpdateSource.REMOTE,
                    entry: {...entry}
                });
            }
        });

        conn.on("entryFlagsUpdate", (msg: V3EntryFlagsUpdateMessage) => {
            if (this._entries.has(msg.entryId)) {
                const entry = this._entries.get(msg.entryId);
                entry.flags = {...msg.entryFlags};

                this._broadcast(conn, entryFlagsUpdateMessageToBuffer(msg));

                this.emit("entryFlagsUpdated", {
                    source: NTEventUpdateSource.REMOTE,
                    entry: {...entry}
                });
            }
        });

        conn.on("entryDelete", (msg: V3EntryDeleteMessage) => {
            if (this._entries.has(msg.entryId)) {
                const entry = this._entries.get(msg.entryId);

                this._entries.delete(msg.entryId);
                this._entryNameToId.delete(entry.name);

                this._broadcast(conn, entryDeleteMessageToBuffer(msg));

                this.emit("entryDeleted", {
                    source: NTEventUpdateSource.REMOTE,
                    entry: {...entry}
                });
            }
        });

        conn.on("clearAllEntries", () => {
            this._entries.clear();
            this._entryNameToId.clear();
            this._rpcDefinitions.clear();

            this._nextId = 0;

            this._broadcast(conn, clearAllEntriesMessageToBuffer());
        });

        conn.on("rpcExecute", (msg: V3RPCExecuteMessage) => {
            // TODO Implement
        });
    }

    private _broadcast(excludedConn: NTClientConnection | null, data: Buffer) {
        for (let i = 0; i < this._connections.length; i++) {
            const conn = this._connections[i];
            if (conn !== excludedConn) {
                conn.write(data);
            }
        }
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
                return true;
            }

            newEntry.id = currEntryId;
            newEntry.seq = currEntry.seq + 1;
            newEntry.flags = currEntry.flags;

            this._entries.set(currEntryId, newEntry);

            // Broadcast
            this._broadcast(null, entryUpdateMessageToBuffer({
                type: V3MessageType.ENTRY_UPDATE,
                entryType: NTtoV3EntryType.get(newEntry.type),
                entryId: newEntry.id,
                entrySeq: newEntry.seq,
                entryValue: newEntry.value
            }));

            this.emit("entryUpdated", {
                source: NTEventUpdateSource.LOCAL,
                entry: {...newEntry}
            });
        }
        else {
            // This is a new field
            const entryId = this._nextId;
            this._nextId++;

            newEntry.id = entryId;
            newEntry.seq = 0;

            this._entries.set(entryId, newEntry);
            this._entryNameToId.set(newEntry.name, entryId);

            this._broadcast(null, entryAssignmentMessageToBuffer({
                type: V3MessageType.ENTRY_ASSIGNMENT,
                entryType: NTtoV3EntryType.get(newEntry.type),
                entryId: newEntry.id,
                entrySeq: newEntry.seq,
                entryName: newEntry.name,
                entryFlags: newEntry.flags ? newEntry.flags : V3_DEFAULT_FLAGS,
                entryValue: newEntry.value
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
                throw new NTEntryTypeMismatchError("Could not convert types");
            }

            return {...currEntry};
        }

        throw new NTEntryNotFoundError(`Could not find entry with key "${key}"`);
    }
}
