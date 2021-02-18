import NTEntry, { NTEntryType } from "../nt-entry";

export enum V3EntryType {
    BOOLEAN = 0x00,
    DOUBLE = 0x01,
    STRING = 0x02,
    RAW = 0x03,
    BOOLEAN_ARRAY = 0x10,
    DOUBLE_ARRAY = 0x11,
    STRING_ARRAY = 0x12,
    RPC = 0x20
}

export const ByteToV3EntryType = {
    0x00: V3EntryType.BOOLEAN,
    0x01: V3EntryType.DOUBLE,
    0x02: V3EntryType.STRING,
    0x03: V3EntryType.RAW,
    0x10: V3EntryType.BOOLEAN_ARRAY,
    0x11: V3EntryType.DOUBLE_ARRAY,
    0x12: V3EntryType.STRING_ARRAY,
    0x20: V3EntryType.RPC
}

// Set up the map of V3EntryType to NTEntryType
export const V3toNTEntryType: Map<V3EntryType, NTEntryType> = new Map<V3EntryType, NTEntryType>();
V3toNTEntryType.set(V3EntryType.BOOLEAN, NTEntryType.BOOLEAN);
V3toNTEntryType.set(V3EntryType.DOUBLE, NTEntryType.DOUBLE);
V3toNTEntryType.set(V3EntryType.STRING, NTEntryType.STRING);
V3toNTEntryType.set(V3EntryType.DOUBLE_ARRAY, NTEntryType.DOUBLE_ARRAY);
V3toNTEntryType.set(V3EntryType.STRING_ARRAY, NTEntryType.STRING_ARRAY);
V3toNTEntryType.set(V3EntryType.BOOLEAN_ARRAY, NTEntryType.BOOLEAN_ARRAY);
V3toNTEntryType.set(V3EntryType.RAW, NTEntryType.RAW);
V3toNTEntryType.set(V3EntryType.RPC, NTEntryType.RPC);

// Set up the map of NTEntryType to V3EntryType
export const NTtoV3EntryType: Map<NTEntryType, V3EntryType> = new Map<NTEntryType, V3EntryType>();
NTtoV3EntryType.set(NTEntryType.BOOLEAN, V3EntryType.BOOLEAN);
NTtoV3EntryType.set(NTEntryType.DOUBLE, V3EntryType.DOUBLE);
NTtoV3EntryType.set(NTEntryType.STRING, V3EntryType.STRING);
NTtoV3EntryType.set(NTEntryType.DOUBLE_ARRAY, V3EntryType.DOUBLE_ARRAY);
NTtoV3EntryType.set(NTEntryType.STRING_ARRAY, V3EntryType.STRING_ARRAY);
NTtoV3EntryType.set(NTEntryType.BOOLEAN_ARRAY, V3EntryType.BOOLEAN_ARRAY);
NTtoV3EntryType.set(NTEntryType.RAW, V3EntryType.RAW);
NTtoV3EntryType.set(NTEntryType.RPC, V3EntryType.RPC);

export enum V3MessageType {
    KEEP_ALIVE = 0x00,
    CLIENT_HELLO = 0x01,
    PROTO_VERSION_UNSUPPORTED = 0x02,
    SERVER_HELLO_COMPLETE = 0x03,
    SERVER_HELLO = 0x04,
    CLIENT_HELLO_COMPLETE = 0x05,
    ENTRY_ASSIGNMENT = 0x10,
    ENTRY_UPDATE = 0x11,
    ENTRY_FLAGS_UPDATE = 0x12,
    ENTRY_DELETE = 0x13,
    CLEAR_ALL_ENTRIES = 0x14,
    RPC_EXECUTE = 0x20,
    RPC_RESPONSE = 0x21,
}

export const CLEAR_ALL_ENTRIES_MAGIC_VALUE = 0xD06CB27A;

export const ByteToV3MessageType = {
    0x00: V3MessageType.KEEP_ALIVE,
    0x01: V3MessageType.CLIENT_HELLO,
    0x02: V3MessageType.PROTO_VERSION_UNSUPPORTED,
    0x03: V3MessageType.SERVER_HELLO_COMPLETE,
    0x04: V3MessageType.SERVER_HELLO,
    0x05: V3MessageType.CLIENT_HELLO_COMPLETE,
    0x10: V3MessageType.ENTRY_ASSIGNMENT,
    0x11: V3MessageType.ENTRY_UPDATE,
    0x12: V3MessageType.ENTRY_FLAGS_UPDATE,
    0x13: V3MessageType.ENTRY_DELETE,
    0x14: V3MessageType.CLEAR_ALL_ENTRIES,
    0x20: V3MessageType.RPC_EXECUTE,
    0x21: V3MessageType.RPC_RESPONSE
}

// States for the Client-side handshake state machine
export enum V3ClientHandshakeState {
    V3HS_NOT_CONNECTED,
    V3HS_AWAIT_SERVER_HELLO,
    V3HS_AWAIT_SERVER_ENTRIES,
    V3HS_SERVER_HELLO_COMPLETE,
    V3HS_AWAIT_ENTRY_SYNC,
    V3HS_COMPLETE
}

export interface V3EntryFlags {
    persistent: boolean;
}

// Extra fields that the V3 entry needs
export interface V3NTEntry extends NTEntry {
    flags: V3EntryFlags;
    persistent: boolean;
}
