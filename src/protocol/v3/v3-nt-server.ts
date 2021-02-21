import StrictEventEmitter from "strict-event-emitter-types";
import { EventEmitter } from "events";
import { Socket } from "net";
import { V3ServerHandshakeState } from "./v3-types";
import { NTProtocolVersion } from "../nt-types";
import NTEntry from "../nt-entry";
import NTServer from "../nt-server";
import { V3Message } from "./v3-messages";

interface HandshakeManagerEvents {
    stateChange: (oldState: V3ServerHandshakeState, newState: V3ServerHandshakeState) => void;
    handshakeComplete: () => void;
    handshakeError: () => void;
}
type HandshakeManagerEventEmitter = StrictEventEmitter<EventEmitter, HandshakeManagerEvents>;

export class V3ServerHandshakeManager extends (EventEmitter as new () => HandshakeManagerEventEmitter) {
    private _state: V3ServerHandshakeState.AWAIT_CLIENT_HELLO;

    private _writeFunc: (data: Buffer) => Promise<void>;
    private _ident: string;

    private _protocolVersion: NTProtocolVersion = { major: 3, minor: 0 };

    private _clientSideEntries: Map<string, NTEntry> = new Map<string, NTEntry>();

    constructor(serverIdent: string, writeFunc: (data: Buffer) => Promise<void>) {
        super();
        this._writeFunc = writeFunc;
        this._ident = serverIdent;
    }

    public get protocolVersion(): NTProtocolVersion {
        return this._protocolVersion;
    }

    public set protocolVersion(val: NTProtocolVersion) {
        this._protocolVersion = val;
    }

    
}

export class NTClientConnection extends EventEmitter {
    private _socket: Socket;

    constructor(socket: Socket) {
        super();
        
        this._socket = socket;
    }
}

export default class V3NTServer extends NTServer {
    private _connections: NTClientConnection[] = [];

    private _entryNameToId: Map<string, number> = new Map<string, number>();
    private _entries: Map<number, NTEntry> = new Map<number, NTEntry>();

    public setBoolean(key: string, val: boolean): boolean {
        throw new Error("Method not implemented.");
    }
    public getBoolean(key: string): boolean {
        throw new Error("Method not implemented.");
    }
    public setDouble(key: string, val: number): boolean {
        throw new Error("Method not implemented.");
    }
    public getDouble(key: string): number {
        throw new Error("Method not implemented.");
    }
    public setString(key: string, val: string): boolean {
        throw new Error("Method not implemented.");
    }
    public getString(key: string): string {
        throw new Error("Method not implemented.");
    }
    public setBooleanArray(key: string, val: boolean[]): boolean {
        throw new Error("Method not implemented.");
    }
    public getBooleanArray(key: string): boolean[] {
        throw new Error("Method not implemented.");
    }
    public setDoubleArray(key: string, val: number[]): boolean {
        throw new Error("Method not implemented.");
    }
    public getDoubleArray(key: string): number[] {
        throw new Error("Method not implemented.");
    }
    public setStringArray(key: string, val: string[]): boolean {
        throw new Error("Method not implemented.");
    }
    public getStringArray(key: string): string[] {
        throw new Error("Method not implemented.");
    }
    public setRaw(key: string, val: Buffer): boolean {
        throw new Error("Method not implemented.");
    }
    public getRaw(key: string): Buffer {
        throw new Error("Method not implemented.");
    }

    protected _onSocketConnected(socket: Socket) {
        // Create a new NTClientConnection

        const conn = new NTClientConnection(socket);
        this._connections.push(conn);
    }

    protected _connectionHandshake(socket: Socket): Promise<string> {
        throw new Error("Method not implemented.");
    }
    protected _handleSocketData(socket: Socket, data: Buffer): void {
        throw new Error("Method not implemented.");
    }
}