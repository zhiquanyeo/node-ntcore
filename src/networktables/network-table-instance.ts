import { v4 as uuidv4 } from "uuid";
import NTParticipant from "../protocol/nt-participant";
import NTEntry, { NTEntryFlags, NTEntryType, NTEntryValue } from "../protocol/nt-entry";
import V3NTClient from "../protocol/v3/v3-nt-client";
import { NTConnectionState, NTEntryEvent } from "../protocol/nt-types";
import V3NTServer from "../protocol/v3/v3-nt-server";
import NetworkTableEntry, { NetworkTableEntryFlags, NTEntryFunctions } from "./network-table-entry";
import NetworkTable from "./network-table";

const DEFAULT_NT_PORT = 1735;
export const NT_PATH_SEPARATOR = "/";

export enum OperatingMode {
    CLIENT,
    SERVER,
    LOCAL,
    UNCONFIGURED
}

export enum ConnectionState {
    OFFLINE,
    CONNECTING,
    ONLINE
}

export interface RawNTEntryInfo {
    entry: NTEntry;
    lastUpdate: number;
}

export interface NetworkTableEntryInfo {
    entry: NetworkTableEntry;
    key: string;
    isPending?: boolean;
}

export enum NetworkTableType {
    UNASSIGNED = 0x00,
    BOOLEAN = 0x01,
    DOUBLE = 0x02,
    STRING = 0x04,
    RAW = 0x08,
    BOOLEAN_ARRAY = 0x10,
    DOUBLE_ARRAY = 0x20,
    STRING_ARRAY = 0x40,
    RPC = 0x80
};

function toNTEntryType(type: NetworkTableType): NTEntryType {
    switch (type) {
        case NetworkTableType.BOOLEAN:
            return NTEntryType.BOOLEAN;
        case NetworkTableType.BOOLEAN_ARRAY:
            return NTEntryType.BOOLEAN_ARRAY;
        case NetworkTableType.DOUBLE:
            return NTEntryType.DOUBLE;
        case NetworkTableType.DOUBLE_ARRAY:
            return NTEntryType.DOUBLE_ARRAY;
        case NetworkTableType.STRING:
            return NTEntryType.STRING;
        case NetworkTableType.STRING_ARRAY:
            return NTEntryType.STRING_ARRAY;
        case NetworkTableType.RAW:
            return NTEntryType.RAW;
        case NetworkTableType.RPC:
            return NTEntryType.RPC;
        default:
            throw new Error("Invalid conversion");
    }
}

const DEFAULT_INSTANCE_IDENTIFIER = "NTCORE_DEFAULT_INSTANCE";

export default class NetworkTableInstance {
    // STATIC METHODS AND PROPERTIES
    private static s_instances: Map<string, NetworkTableInstance> = new Map<string, NetworkTableInstance>();

    public static getDefault(): NetworkTableInstance {
        if (!this.s_instances.has(DEFAULT_INSTANCE_IDENTIFIER)) {
            this.s_instances.set(DEFAULT_INSTANCE_IDENTIFIER, new NetworkTableInstance(DEFAULT_INSTANCE_IDENTIFIER));
        }

        return this.s_instances.get(DEFAULT_INSTANCE_IDENTIFIER);
    }

    public static create(): NetworkTableInstance {
        const guid = uuidv4();
        const inst = new NetworkTableInstance(guid);

        this.s_instances.set(guid, inst);

        return inst;
    }


    // INSTANCE METHODS AND PROPERTIES
    private _guid: string;

    // Stores all the registered raw NTEntry objects
    // These represent actual, live data
    private _ntEntries: Map<string, RawNTEntryInfo> = new Map<string, RawNTEntryInfo>();
    private _pendingNtEntries: Map<string, RawNTEntryInfo> = new Map<string, RawNTEntryInfo>();

    // Map from NTEntry key => guid
    private _entryGuidMap: Map<string, string> = new Map<string, string>();
    private _pendingEntryGuids: Map<string, string> = new Map<string, string>();

    // Cache of NetworkTableEntry-s
    private _entries: Map<string, NetworkTableEntryInfo> = new Map<string, NetworkTableEntryInfo>();

    // Cache of NetworkTable-s
    private _tables: Map<string, NetworkTable> = new Map<string, NetworkTable>();

    private _ntParticipant: NTParticipant | null = null;
    private _netIdentity: string = "NetworkTable";

    private _opMode: OperatingMode = OperatingMode.UNCONFIGURED;
    private _connState: ConnectionState = ConnectionState.OFFLINE;


    private _entryFuncs: NTEntryFunctions;

    protected constructor(guid: string) {
        this._guid = guid;
        // Set up the NTEntryFunctions

        this._entryFuncs = {
            getLastChange: this._entryGetLastChange.bind(this),
            getBoolean: this._entryGetBoolean.bind(this),
            getBooleanArray: this._entryGetBooleanArray.bind(this),
            getString: this._entryGetString.bind(this),
            getStringArray: this._entryGetStringArray.bind(this),
            getDouble: this._entryGetDouble.bind(this),
            getDoubleArray: this._entryGetDoubleArray.bind(this),
            getRaw: this._entryGetRaw.bind(this),
            setBoolean: this._entrySetBoolean.bind(this),
            setBooleanArray: this._entrySetBooleanArray.bind(this),
            setDouble: this._entrySetDouble.bind(this),
            setDoubleArray: this._entrySetDoubleArray.bind(this),
            setString: this._entrySetString.bind(this),
            setStringArray: this._entrySetStringArray.bind(this),
            setRaw: this._entrySetRaw.bind(this),
            delete: this._entryDelete.bind(this),
            exists: this._entryExists.bind(this),
            getFlags: this._entryGetFlags.bind(this),
            setFlags: this._entrySetFlags.bind(this)
        }
    }

    public get guid(): string {
        return this._guid;
    }

    public setNetworkIdentity(ident: string) {
        this._netIdentity = ident;

        if (this._ntParticipant) {
            this._ntParticipant.identifier = this._netIdentity;
        }
    }

    public getEntry(key: string): NetworkTableEntry {
        if (this._entryGuidMap.has(key)) {
            console.log("Found a previously cached entry for ", key);
            // We have a previously cached NetworkTableEntry
            const entryGuid = this._entryGuidMap.get(key);
            return this._entries.get(entryGuid).entry;
        }
        else if (this._pendingEntryGuids.has(key)) {
            console.log("Found a previously cached entry (pending) for ", key);
            // We have a previously cached PENDING NetworkTableEntry
            const entryGuid = this._pendingEntryGuids.get(key);
            return this._entries.get(entryGuid).entry;
        }
        else {
            console.log("Creating pending entry for ", key);
            // Create the entry accessor anyway
            const entryGuid = uuidv4();
            const newEntry = new NetworkTableEntry(this, key, entryGuid, this._entryFuncs);

            this._entries.set(entryGuid, {
                entry: newEntry,
                key,
                isPending: true
            });

            if (this._ntEntries.has(key)) {
                // If this is a live record, add the map from key to guid
                this._entryGuidMap.set(key, entryGuid);
                const entryInfo = this._entries.get(key);
                entryInfo.isPending = false;
            }
            else {
                // Not a live record yet, add to pending
                this._pendingEntryGuids.set(key, entryGuid);
            }

            return newEntry;
        }
    }

    public getEntries(prefix: string, type: NetworkTableType): NetworkTableEntry[] {
        throw new Error("Not Implmented Yet");
    }

    public getTable(key: string): NetworkTable {
        let theKey: string = "";

        if (key === "" || key === NT_PATH_SEPARATOR) {
            theKey = "";
        }
        else if (key.charAt(0) === NT_PATH_SEPARATOR) {
            theKey = key;
        }
        else {
            theKey = NT_PATH_SEPARATOR + key;
        }

        let table: NetworkTable = this._tables.get(theKey);
        if (!table) {
            table = new NetworkTable(this, theKey);
            this._tables.set(theKey, table);
        }

        return table;
    }

    // Start this instance as a client
    public startClient(hostAddr: string, port: number = DEFAULT_NT_PORT) {

        if (this._opMode !== OperatingMode.UNCONFIGURED && this._connState !== ConnectionState.OFFLINE) {
            console.log("Bailing early");
            return;
        }

        if (this._opMode !== OperatingMode.CLIENT || !this._ntParticipant) {
            if (this._ntParticipant) {
                this._ntParticipant.removeAllListeners();
            }

            console.log("Creating new client");
            this._ntParticipant = new V3NTClient({
                address: hostAddr,
                port,
                identifier: this._netIdentity
            });

            this._hookupNTEvents();
        }

        this._opMode = OperatingMode.CLIENT;
        this._ntParticipant.start();
    }

    public stopClient() {
        if (this._opMode !== OperatingMode.CLIENT || this._connState === ConnectionState.OFFLINE) {
            return;
        }

        this._ntParticipant.stop();

        this._connState = ConnectionState.OFFLINE;
    }

    public startServer(persistFile: string, port: number = DEFAULT_NT_PORT) {
        if (this._opMode !== OperatingMode.UNCONFIGURED && this._connState !== ConnectionState.OFFLINE) {
            return;
        }

        if (this._opMode !== OperatingMode.SERVER || !this._ntParticipant) {
            if (this._ntParticipant) {
                this._ntParticipant.removeAllListeners();
            }

            this._ntParticipant = new V3NTServer({
                port,
                identifier: this._netIdentity
            });

            this._hookupNTEvents();
        }

        this._opMode = OperatingMode.SERVER;
        this._ntParticipant.start();
    }

    public stopServer() {
        if (this._opMode !== OperatingMode.SERVER || this._connState === ConnectionState.OFFLINE) {
            return;
        }

        this._ntParticipant.stop();

        this._connState = ConnectionState.OFFLINE;
    }

    private _hookupNTEvents() {
        if (!this._ntParticipant) {
            return;
        }

        this._ntParticipant.on("connectionStateChanged", (oldState, newState) => {
            if (newState === NTConnectionState.NTCONN_CONNECTED) {
                this._connState = ConnectionState.ONLINE;

                // Flush any pending entries
                this._pendingNtEntries.forEach((value, key) => {
                    switch (value.entry.type) {
                        case NTEntryType.BOOLEAN: {
                            this._ntParticipant.setBoolean(key, value.entry.value.bool);
                        } break;
                        case NTEntryType.BOOLEAN_ARRAY: {
                            this._ntParticipant.setBooleanArray(key, value.entry.value.bool_array);
                        } break;
                        case NTEntryType.DOUBLE: {
                            this._ntParticipant.setDouble(key, value.entry.value.double);
                        } break;
                        case NTEntryType.DOUBLE_ARRAY: {
                            this._ntParticipant.setDoubleArray(key, value.entry.value.double_array);
                        } break;
                        case NTEntryType.STRING: {
                            this._ntParticipant.setString(key, value.entry.value.str);
                        } break;
                        case NTEntryType.STRING_ARRAY: {
                            this._ntParticipant.setStringArray(key, value.entry.value.str_array);
                        } break;
                        case NTEntryType.RAW: {
                            this._ntParticipant.setRaw(key, value.entry.value.raw);
                        } break;
                    }
                });

                this._pendingNtEntries.clear();
            }
            else if (newState === NTConnectionState.NTCONN_CONNECTING) {
                this._connState = ConnectionState.CONNECTING;
            }
            else {
                this._connState = ConnectionState.OFFLINE;
            }
        });

        this._ntParticipant.on("entryAdded", (evt) => {
            this._onEntryAdded(evt);
        });

        this._ntParticipant.on("entryUpdated", (evt) => {
            this._onEntryUpdated(evt);
        });

        this._ntParticipant.on("entryDeleted", (evt) => {
            this._onEntryDeleted(evt);
        });

        this._ntParticipant.on("entryFlagsUpdated", (evt) => {
            this._onEntryFlagsUpdated(evt);
        });
    }

    private _onEntryAdded(evt: NTEntryEvent) {
        console.log("ENTRY ADDED EVENT", evt);
        const key = evt.entry.name;

        // Add this to our collection
        if (this._ntEntries.has(key)) {
            // TODO what happens now?
        }

        this._ntEntries.set(key, {
            entry: {...evt.entry},
            lastUpdate: Date.now()
        });


        if (this._pendingEntryGuids.has(key)) {
            if (this._entryGuidMap.has(key)) {
                // ERROR!
                console.log("Error?? Already have an entry guid for this");
            }
            else {
                console.log("PROMOTING pending entry to full entry");
                this._entryGuidMap.set(key, this._pendingEntryGuids.get(key));
                this._pendingEntryGuids.delete(key);
            }
        }
    }

    private _onEntryUpdated(evt: NTEntryEvent) {
        if (this._ntEntries.has(evt.entry.name)) {
            this._ntEntries.set(evt.entry.name, {
                entry: {...evt.entry},
                lastUpdate: Date.now()
            });
        }
    }

    private _onEntryFlagsUpdated(evt: NTEntryEvent) {
        if (this._ntEntries.has(evt.entry.name)) {
            const entryInfo = this._ntEntries.get(evt.entry.name);
            entryInfo.entry.flags = {...evt.entry.flags};
            entryInfo.lastUpdate = Date.now();
        }
    }

    private _onEntryDeleted(evt: NTEntryEvent) {
        this._ntEntries.delete(evt.entry.name);

        // Broadcast
    }

    // NetworkTableEntry methods
    private _entryGetLastChange(key: string): number {
        let entryInfo: RawNTEntryInfo;
        if (this._ntEntries.has(key)) {
            entryInfo = this._ntEntries.get(key);
        }
        else if (this._pendingNtEntries.has(key)) {
            entryInfo = this._pendingNtEntries.get(key);
        }

        if (entryInfo) {
            return entryInfo.lastUpdate;
        }
        return 0;
    }

    private _entryGetBoolean(key: string, defaultVal: boolean): boolean {
        let entryInfo: RawNTEntryInfo;
        if (this._ntEntries.has(key)) {
            entryInfo = this._ntEntries.get(key);
        }
        else if (this._pendingNtEntries.has(key)) {
            entryInfo = this._pendingNtEntries.get(key);
        }

        if (entryInfo) {
            if (entryInfo.entry.type === NTEntryType.BOOLEAN) {
                return entryInfo.entry.value.bool;
            }
        }
        return defaultVal;
    }

    private _entryGetString(key: string, defaultVal: string): string {
        let entryInfo: RawNTEntryInfo;
        if (this._ntEntries.has(key)) {
            entryInfo = this._ntEntries.get(key);
        }
        else if (this._pendingNtEntries.has(key)) {
            entryInfo = this._pendingNtEntries.get(key);
        }

        if (entryInfo) {
            if (entryInfo.entry.type === NTEntryType.STRING) {
                return entryInfo.entry.value.str;
            }
        }
        return defaultVal;
    }

    private _entryGetDouble(key: string, defaultVal: number): number {
        let entryInfo: RawNTEntryInfo;
        if (this._ntEntries.has(key)) {
            entryInfo = this._ntEntries.get(key);
        }
        else if (this._pendingNtEntries.has(key)) {
            entryInfo = this._pendingNtEntries.get(key);
        }

        if (entryInfo) {
            if (entryInfo.entry.type === NTEntryType.DOUBLE) {
                return entryInfo.entry.value.double;
            }
        }
        return defaultVal;
    }

    private _entryGetBooleanArray(key: string, defaultVal: boolean[]): boolean[] {
        let entryInfo: RawNTEntryInfo;
        if (this._ntEntries.has(key)) {
            entryInfo = this._ntEntries.get(key);
        }
        else if (this._pendingNtEntries.has(key)) {
            entryInfo = this._pendingNtEntries.get(key);
        }

        if (entryInfo) {
            if (entryInfo.entry.type === NTEntryType.BOOLEAN_ARRAY) {
                return entryInfo.entry.value.bool_array;
            }
        }
        return defaultVal;
    }

    private _entryGetStringArray(key: string, defaultVal: string[]): string[] {
        let entryInfo: RawNTEntryInfo;
        if (this._ntEntries.has(key)) {
            entryInfo = this._ntEntries.get(key);
        }
        else if (this._pendingNtEntries.has(key)) {
            entryInfo = this._pendingNtEntries.get(key);
        }

        if (entryInfo) {
            if (entryInfo.entry.type === NTEntryType.STRING_ARRAY) {
                return entryInfo.entry.value.str_array;
            }
        }
        return defaultVal;
    }

    private _entryGetDoubleArray(key: string, defaultVal: number[]): number[] {
        let entryInfo: RawNTEntryInfo;
        if (this._ntEntries.has(key)) {
            entryInfo = this._ntEntries.get(key);
        }
        else if (this._pendingNtEntries.has(key)) {
            entryInfo = this._pendingNtEntries.get(key);
        }

        if (entryInfo) {
            if (entryInfo.entry.type === NTEntryType.DOUBLE_ARRAY) {
                return entryInfo.entry.value.double_array;
            }
        }
        return defaultVal;
    }

    private _entryGetRaw(key: string, defaultVal: Buffer): Buffer {
        let entryInfo: RawNTEntryInfo;
        if (this._ntEntries.has(key)) {
            entryInfo = this._ntEntries.get(key);
        }
        else if (this._pendingNtEntries.has(key)) {
            entryInfo = this._pendingNtEntries.get(key);
        }

        if (entryInfo) {
            if (entryInfo.entry.type === NTEntryType.RAW) {
                return entryInfo.entry.value.raw;
            }
        }
        return defaultVal;
    }

    private _entrySetBoolean(key: string, val: boolean): boolean {
        if (!this._ntParticipant) {
            return this._insertPendingEntry(key, NTEntryType.BOOLEAN, { bool: val });
        }
        return this._ntParticipant.setBoolean(key, val);
    }

    private _entrySetString(key: string, val: string): boolean {
        if (!this._ntParticipant) {
            return this._insertPendingEntry(key, NTEntryType.STRING, { str: val });
        }
        return this._ntParticipant.setString(key, val);
    }

    private _entrySetDouble(key: string, val: number): boolean {
        if (!this._ntParticipant) {
            return this._insertPendingEntry(key, NTEntryType.DOUBLE, { double: val });
        }
        return this._ntParticipant.setDouble(key, val);
    }

    private _entrySetBooleanArray(key: string, val: boolean[]): boolean {
        if (!this._ntParticipant) {
            return this._insertPendingEntry(key, NTEntryType.BOOLEAN_ARRAY, { bool_array: val });
        }
        return this._ntParticipant.setBooleanArray(key, val);
    }

    private _entrySetStringArray(key: string, val: string[]): boolean {
        if (!this._ntParticipant) {
            return this._insertPendingEntry(key, NTEntryType.STRING_ARRAY, { str_array: val });
        }
        return this._ntParticipant.setStringArray(key, val);
    }

    private _entrySetDoubleArray(key: string, val: number[]): boolean {
        if (!this._ntParticipant) {
            return this._insertPendingEntry(key, NTEntryType.DOUBLE_ARRAY, { double_array: val });
        }
        return this._ntParticipant.setDoubleArray(key, val);
    }

    private _entrySetRaw(key: string, val: Buffer): boolean {
        if (!this._ntParticipant) {
            return this._insertPendingEntry(key, NTEntryType.RAW, { raw: val });
        }
        return this._ntParticipant.setRaw(key, val);
    }

    private _entryDelete(key: string): boolean {
        if (!this._ntParticipant) {
            if (this._pendingNtEntries.has(key)) {
                this._pendingNtEntries.delete(key);
                return true;
            }

            return false;
        }

        return this._ntParticipant.deleteEntry(key);
    }

    private _entryExists(key: string): boolean {
        return this._ntEntries.has(key);
    }

    private _entryGetFlags(key: string): NetworkTableEntryFlags {
        if (!this._ntEntries.has(key)) {
            return NetworkTableEntryFlags.UNASSIGNED;
        }

        let result = NetworkTableEntryFlags.UNASSIGNED;

        const entryInfo = this._ntEntries.get(key);

        if (entryInfo.entry.flags) {
            const flags: NTEntryFlags = entryInfo.entry.flags;
            if (flags.persistent) {
                result |= NetworkTableEntryFlags.PERSISTENT;
            }
        }

        return result;
    }

    private _entrySetFlags(key: string, flags: NetworkTableEntryFlags): void {
        if (!this._ntParticipant) {
            return;
        }

        if (!this._ntEntries.has(key)) {
            return;
        }

        const entryFlags: NTEntryFlags = {
            persistent: (flags & NetworkTableEntryFlags.PERSISTENT) !== 0
        }
        this._ntParticipant.updateEntryFlags(key, entryFlags);
    }

    private _insertPendingEntry(key: string, type: NTEntryType, value: NTEntryValue): boolean {
        // Typecheck
        if (!this._typecheckValue(type, value)) {
            return false;
        }

        if (!this._pendingNtEntries.has(key)) {

            this._pendingNtEntries.set(key, {
                lastUpdate: Date.now(),
                entry: {
                    name: key,
                    id: 0xFFFF,
                    seq: 0,
                    type,
                    value
                }
            });

            return true;
        }
        else {
            // There's an existing pending option, check the types
            const entryInfo = this._pendingNtEntries.get(key);
            if (entryInfo.entry.type !== type) {
                return false;
            }

            entryInfo.entry.value = value;
            return true;
        }
    }

    private _typecheckValue(type: NTEntryType, val: NTEntryValue): boolean {
        switch (type) {
            case NTEntryType.BOOLEAN:
                return val.bool !== undefined;
            case NTEntryType.BOOLEAN_ARRAY:
                return val.bool_array !== undefined;
            case NTEntryType.DOUBLE:
                return val.double !== undefined;
            case NTEntryType.DOUBLE_ARRAY:
                return val.double_array !== undefined;
            case NTEntryType.STRING:
                return val.str !== undefined;
            case NTEntryType.STRING_ARRAY:
                return val.str_array !== undefined;
            case NTEntryType.RAW:
                return val.raw !== undefined;
            case NTEntryType.RPC:
                return val.rpc !== undefined;
        }
    }
}
