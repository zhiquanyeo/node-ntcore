// The maximal set of all NT Entry types supported
export enum NTEntryType {
    BOOLEAN,
    DOUBLE,
    STRING,
    BOOLEAN_ARRAY,
    DOUBLE_ARRAY,
    STRING_ARRAY,
    RAW,
    RPC
}

// Maximal set of all NT Entry Values supported
export interface NTEntryValue {
    bool?: boolean;
    double?: number;
    str?: string;
    raw?: Buffer;
    bool_array?: boolean[];
    double_array?: number[];
    str_array?: string[];
    rpc?: any; // TODO proper spec?
}

export interface NTEntryFlags {}

// Minimal set of fields that make up an NT Entry
export default interface NTEntry {
    name: string;
    type: NTEntryType;
    id: number;
    value: NTEntryValue;
    seq: number;
    flags: NTEntryFlags
}
