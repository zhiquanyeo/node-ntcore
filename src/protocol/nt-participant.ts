import StrictEventEmitter from "strict-event-emitter-types";
import { EventEmitter } from "events";
import { NTConnectionState, NTEntryEvent, NTProtocolVersion } from "./nt-types";

export interface NTParticipantOptions {
    identifier?: string;
}

interface NTAccessorEvents {
    connectionStateChanged: (oldState: NTConnectionState, newState: NTConnectionState) => void;
    entryAdded: (entryEvent: NTEntryEvent) => void;
    entryUpdated: (entryEvent: NTEntryEvent) => void;
    entryFlagsUpdated: (entryEvent: NTEntryEvent) => void;
    entryDeleted: (entryEvent: NTEntryEvent) => void;
}
type NTAccessorEventEmitter = StrictEventEmitter<EventEmitter, NTAccessorEvents>;

/**
 * Abstract class representing a Network Table Participant (NTParticipant)
 * 
 * A NTParticipant could be either a server or a client, and represents a node in
 * the NetworkTables network.
 */
export default abstract class NTParticipant extends (EventEmitter as new () => NTAccessorEventEmitter) {
    protected _version: NTProtocolVersion = { major: -1, minor: -1 };
    protected _identifier: string = "";
    protected _currState: NTConnectionState = NTConnectionState.NTCONN_NOT_CONNECTED;

    constructor(options: NTParticipantOptions = {}) {
        super();
        
        if (options.identifier) {
            this._identifier = options.identifier;
        }
        else {
            this._identifier = `NTAccessor-${Date.now()}`;
        }
    }

    public get version(): NTProtocolVersion {
        return {...this._version};
    }

    public get identifier(): string {
        return this._identifier;
    }

    public abstract start(): void;
    public abstract stop(): void;

    public abstract setBoolean(key: string, val: boolean): boolean;
    public abstract getBoolean(key: string): boolean;

    public abstract setDouble(key: string, val: number): boolean;
    public abstract getDouble(key: string): number;

    public abstract setString(key: string, val: string): boolean;
    public abstract getString(key: string): string;

    public abstract setBooleanArray(key: string, val: boolean[]): boolean;
    public abstract getBooleanArray(key: string): boolean[];

    public abstract setDoubleArray(key: string, val: number[]): boolean;
    public abstract getDoubleArray(key: string): number[];

    public abstract setStringArray(key: string, val: string[]): boolean;
    public abstract getStringArray(key: string): string[];

    public abstract setRaw(key: string, val: Buffer): boolean;
    public abstract getRaw(key: string): Buffer;
    // TODO RPC

    protected _setConnectionState(state: NTConnectionState) {
        if (this._currState !== state) {
            this.emit("connectionStateChanged", 
                this._currState,
                state
            );
            this._currState = state;
        }
    }
}