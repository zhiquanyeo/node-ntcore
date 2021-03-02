import { NTEntryValue } from "../protocol/nt-entry";
import { NetworkTableType } from "./network-table-instance";

export class ClassCastError extends Error {}

export default class NetworkTableValue {
    // STATIC METHODS
    public static makeBoolean(val: boolean, time: number = Date.now()): NetworkTableValue {
        return new NetworkTableValue(NetworkTableType.BOOLEAN, { bool: val}, time);
    }

    public static makeDouble(val: number, time: number = Date.now()): NetworkTableValue {
        return new NetworkTableValue(NetworkTableType.DOUBLE, { double: val}, time);
    }

    public static makeString(val: string, time: number = Date.now()): NetworkTableValue {
        return new NetworkTableValue(NetworkTableType.STRING, { str: val}, time);
    }

    public static makeRaw(val: Buffer, time: number = Date.now()): NetworkTableValue {
        return new NetworkTableValue(NetworkTableType.RAW, { raw: val}, time);
    }

    public static makeBooleanArray(val: boolean[], time: number = Date.now()): NetworkTableValue {
        return new NetworkTableValue(NetworkTableType.BOOLEAN_ARRAY, { bool_array: val}, time);
    }

    public static makeDoubleArray(val: number[], time: number = Date.now()): NetworkTableValue {
        return new NetworkTableValue(NetworkTableType.DOUBLE_ARRAY, { double_array: val}, time);
    }

    public static makeStringArray(val: string[], time: number = Date.now()): NetworkTableValue {
        return new NetworkTableValue(NetworkTableType.STRING_ARRAY, { str_array: val}, time);
    }

    public static makeUnassigned(time: number = Date.now()): NetworkTableValue {
        return new NetworkTableValue(NetworkTableType.UNASSIGNED, {}, time);
    }

    // INSTANCE METHODS
    private _type: NetworkTableType;
    private _value: NTEntryValue;
    private _time: number;

    private constructor(type: NetworkTableType, value: NTEntryValue, time: number = Date.now()) {
        this._type = type;
        this._value = value;
        this._time = time;
    }

    public getType(): NetworkTableType {
        return this._type;
    }

    public getTime(): number {
        return this._time;
    }

    public isValid(): boolean {
        return this._type !== NetworkTableType.UNASSIGNED;
    }

    public isBoolean(): boolean {
        return this._type === NetworkTableType.BOOLEAN;
    }

    public isBooleanArray(): boolean {
        return this._type === NetworkTableType.BOOLEAN_ARRAY;
    }

    public isDouble(): boolean {
        return this._type === NetworkTableType.DOUBLE;
    }

    public isDoubleArray(): boolean {
        return this._type === NetworkTableType.DOUBLE_ARRAY;
    }

    public isString(): boolean {
        return this._type === NetworkTableType.STRING;
    }

    public isStringArray(): boolean {
        return this._type === NetworkTableType.STRING_ARRAY;
    }

    public isRaw(): boolean {
        return this._type === NetworkTableType.RAW;
    }

    public isRPC(): boolean {
        return this._type === NetworkTableType.RPC;
    }

    public getBoolean(): boolean {
        if (this._type !== NetworkTableType.BOOLEAN) {
            throw new ClassCastError("Cannot convert to BOOLEAN");
        }

        return this._value.bool;
    }

    public getBooleanArray(): boolean[] {
        if (this._type !== NetworkTableType.BOOLEAN_ARRAY) {
            throw new ClassCastError("Cannot convert to BOOLEAN_ARRAY");
        }

        return this._value.bool_array;
    }

    public getDouble(): number {
        if (this._type !== NetworkTableType.DOUBLE) {
            throw new ClassCastError("Cannot convert to DOUBLE");
        }

        return this._value.double;
    }

    public getDoubleArray(): number[] {
        if (this._type !== NetworkTableType.DOUBLE_ARRAY) {
            throw new ClassCastError("Cannot convert to DOUBLE_ARRAY");
        }

        return this._value.double_array;
    }

    public getString(): string {
        if (this._type !== NetworkTableType.STRING) {
            throw new ClassCastError("Cannot convert to STRING");
        }

        return this._value.str;
    }

    public getStringArray(): string[] {
        if (this._type !== NetworkTableType.STRING_ARRAY) {
            throw new ClassCastError("Cannot convert to STRING_ARRAY");
        }

        return this._value.str_array;
    }

    public getRaw(): Buffer {
        if (this._type !== NetworkTableType.RAW) {
            throw new ClassCastError("Cannot convert to RAW");
        }

        return this._value.raw;
    }
}