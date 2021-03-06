import NetworkTableInstance, { NetworkTableType } from "./network-table-instance";
import NetworkTableValue from "./network-table-value";

export enum NetworkTableEntryFlags {
    UNASSIGNED = 0x00,
    PERSISTENT = 0x01
}

export interface NTEntryFunctions {
    getLastChange(key: string): number;
    getType(key: string): NetworkTableType;
    getValue(key: string): NetworkTableValue;

    getBoolean(key: string, defaultVal: boolean): boolean;
    getString(key: string, defaultVal: string): string;
    getDouble(key: string, defaultVal: number): number;
    getBooleanArray(key: string, defaultVal: boolean[]): boolean[];
    getStringArray(key: string, defaultVal: string[]): string[];
    getDoubleArray(key: string, defaultVal: number[]): number[];
    getRaw(key: string, defaultVal: Buffer): Buffer;

    setBoolean(key: string, val: boolean): boolean;
    setString(key: string, val: string): boolean;
    setDouble(key: string, val: number): boolean;
    setBooleanArray(key: string, val: boolean[]): boolean;
    setStringArray(key: string, val: string[]): boolean;
    setDoubleArray(key: string, val: number[]): boolean;
    setRaw(key: string, val: Buffer): boolean;

    delete(key: string): boolean;
    exists(key: string): boolean;

    getFlags(key: string): NetworkTableEntryFlags;
    setFlags(key: string, flags: NetworkTableEntryFlags): void;

}

/**
 * NetworkTableEntry accessor
 *
 * A NetworkTableEntry provides a handle to a particular NT entry.
 * This NT entry could be real (exists on the server/network) or
 * pseudo (is pending transmission to the network)
 */
export default class NetworkTableEntry {
    private _instance: NetworkTableInstance;
    private _funcs: NTEntryFunctions;
    private _guid: string;
    private _key: string;

    constructor(inst: NetworkTableInstance, key: string, guid: string, funcs: NTEntryFunctions) {
        this._instance = inst;
        this._funcs = funcs;
        this._guid = guid;
        this._key = key;
    }

    public getName(): string {
        return this._key;
    }

    public getLastChange(): number {
        return this._funcs.getLastChange(this._key);
    }

    public getType(): NetworkTableType {
        return this._funcs.getType(this._key);
    }

    public getValue(): NetworkTableValue {
        return this._funcs.getValue(this._key);
    }

    public getBoolean(defaultVal: boolean): boolean {
        return this._funcs.getBoolean(this._key, defaultVal);
    }

    public getDouble(defaultVal: number): number {
        return this._funcs.getDouble(this._key, defaultVal);
    }

    public getString(defaultVal: string): string {
        return this._funcs.getString(this._key, defaultVal);
    }

    public getBooleanArray(defaultVal: boolean[]): boolean[] {
        return this._funcs.getBooleanArray(this._key, defaultVal);
    }

    public getDoubleArray(defaultVal: number[]): number[] {
        return this._funcs.getDoubleArray(this._key, defaultVal);
    }

    public getStringArray(defaultVal: string[]): string[] {
        return this._funcs.getStringArray(this._key, defaultVal);
    }

    public getRaw(defaultVal: Buffer): Buffer {
        return this._funcs.getRaw(this._key, defaultVal);
    }

    public setBoolean(val: boolean): boolean {
        return this._funcs.setBoolean(this._key, val);
    }

    public setDouble(val: number): boolean {
        return this._funcs.setDouble(this._key, val);
    }

    public setString(val: string): boolean {
        return this._funcs.setString(this._key, val);
    }

    public setBooleanArray(val: boolean[]): boolean {
        return this._funcs.setBooleanArray(this._key, val);
    }

    public setDoubleArray(val: number[]): boolean {
        return this._funcs.setDoubleArray(this._key, val);
    }

    public setStringArray(val: string[]): boolean {
        return this._funcs.setStringArray(this._key, val);
    }

    public setRaw(val: Buffer): boolean {
        return this._funcs.setRaw(this._key, val);
    }

    public exists(): boolean {
        return this._funcs.exists(this._key);
    }

    public delete(): boolean {
        return this._funcs.delete(this._key);
    }

    public getFlags(): NetworkTableEntryFlags {
        return this._funcs.getFlags(this._key);
    }

    public setFlags(flags: NetworkTableEntryFlags): void {
        this._funcs.setFlags(this._key, this.getFlags() | flags)
    }

    public clearFlags(flags: NetworkTableEntryFlags): void {
        this._funcs.setFlags(this._key, this.getFlags() & ~flags);
    }

    public setPersistent(): void {
        this.setFlags(NetworkTableEntryFlags.PERSISTENT);
    }

    public clearPersistent(): void {
        this.clearFlags(NetworkTableEntryFlags.PERSISTENT);
    }

    public isPersistent(): boolean {
        return (this.getFlags() & NetworkTableEntryFlags.PERSISTENT) !== 0;
    }
}
