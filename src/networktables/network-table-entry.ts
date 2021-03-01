import NetworkTableInstance from "./network-table-instance";

export interface NTEntryFunctions {
    getLastChange(key: string): number;

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
}
