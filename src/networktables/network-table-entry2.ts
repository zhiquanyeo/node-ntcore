import { NTEntryType } from "../protocol/nt-entry";
import NetworkTableInstance, { NTEntryInfo } from "./network-table-instance2";

export type NTEntryInfoAccessor = (key: string) => NTEntryInfo | null;
export type NTEntryWriter = (key: string, value: any) => string;

export default class NetworkTableEntry {
    private _instance: NetworkTableInstance;
    private _accessor: NTEntryInfoAccessor;
    private _guid: string;
    private _key: string;

    constructor(inst: NetworkTableInstance, key: string, accessor: NTEntryInfoAccessor) {
        this._instance = inst;
        this._accessor = accessor;
        this._key = key;
    }

    public exists(): boolean {
        return this._getEntryInfo() !== null;
    }

    public getName(): string {
        const entryInfo = this._getEntryInfo();
        if (!entryInfo) {
            return "";
        }

        return entryInfo.entry.name;
    }

    public getLastChange(): number {
        const entryInfo = this._getEntryInfo();
        if (!entryInfo) {
            return 0;
        }

        return entryInfo.lastUpdate;
    }

    public getBoolean(defaultVal: boolean): boolean {
        const entryInfo = this._getEntryInfo();
        if (!entryInfo || entryInfo.entry.type !== NTEntryType.BOOLEAN) {
            return defaultVal;
        }

        return entryInfo.entry.value.bool;
    }

    public getDouble(defaultVal: number): number {
        const entryInfo = this._getEntryInfo();
        if (!entryInfo || entryInfo.entry.type !== NTEntryType.DOUBLE) {
            return defaultVal;
        }

        return entryInfo.entry.value.double;
    }

    public getString(defaultVal: string): string {
        const entryInfo = this._getEntryInfo();
        if (!entryInfo || entryInfo.entry.type !== NTEntryType.STRING) {
            return defaultVal;
        }

        return entryInfo.entry.value.str;
    }

    public getBooleanArray(defaultVal: boolean[]): boolean[] {
        const entryInfo = this._getEntryInfo();
        if (!entryInfo || entryInfo.entry.type !== NTEntryType.BOOLEAN_ARRAY) {
            return defaultVal;
        }

        return entryInfo.entry.value.bool_array;
    }

    public getDoubleArray(defaultVal: number[]): number[] {
        const entryInfo = this._getEntryInfo();
        if (!entryInfo || entryInfo.entry.type !== NTEntryType.DOUBLE_ARRAY) {
            return defaultVal;
        }

        return entryInfo.entry.value.double_array;
    }

    public getStringArray(defaultVal: string[]): string[] {
        const entryInfo = this._getEntryInfo();
        if (!entryInfo || entryInfo.entry.type !== NTEntryType.STRING_ARRAY) {
            return defaultVal;
        }

        return entryInfo.entry.value.str_array;
    }

    public getRaw(defaultVal: Buffer): Buffer {
        const entryInfo = this._getEntryInfo();
        if (!entryInfo || entryInfo.entry.type !== NTEntryType.RAW) {
            return defaultVal;
        }

        return entryInfo.entry.value.raw;
    }

    private _getEntryInfo(): NTEntryInfo {
        return this._accessor(this._key);
    }
}