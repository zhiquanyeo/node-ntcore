import { v4 as uuidv4 } from "uuid";
import NTParticipant from "../protocol/nt-participant";
import NTEntry, { NTEntryType } from "../protocol/nt-entry";
import V3NTClient from "../protocol/v3/v3-nt-client";
import { NTConnectionState, NTEntryEvent } from "../protocol/nt-types";
import V3NTServer from "../protocol/v3/v3-nt-server";
import NetworkTableEntry, { NTEntryFunctions } from "./network-table-entry";
import NetworkTableValue from "./network-table-value2";

const DEFAULT_NT_PORT = 1735;

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

export interface NetworkTableValueInfo {
    value: NetworkTableValue,
    key: string;
    isPending: boolean;
}

export default class NetworkTableInstance {


    // INSTANCE METHODS AND PROPERTIES

    // Stores all the registered raw NTEntry objects
    // These represent actual, live data
    private _ntEntries: Map<string, RawNTEntryInfo> = new Map<string, RawNTEntryInfo>();

    // Keyed from NT key to object
    private _ntValues: Map<string, NetworkTableValueInfo> = new Map<string, NetworkTableValueInfo>();


    // Map from NTEntry key => guid
    private _entryGuidMap: Map<string, string> = new Map<string, string>();
    private _pendingEntryGuids: Map<string, string> = new Map<string, string>();

    // Cache of NetworkTableEntry-s
    private _entries: Map<string, NetworkTableEntryInfo> = new Map<string, NetworkTableEntryInfo>();

    private _ntParticipant: NTParticipant | null = null;
    private _netIdentity: string = "NetworkTable";

    private _opMode: OperatingMode = OperatingMode.UNCONFIGURED;
    private _connState: ConnectionState = ConnectionState.OFFLINE;


    private _entryFuncs: NTEntryFunctions;

    constructor() {
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
            setRaw: this._entrySetRaw.bind(this)
        }
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
        if (this._ntEntries.has(key)) {
            const ntEntryInfo = this._ntEntries.get(key);
            return ntEntryInfo.lastUpdate;
        }
        return 0;
    }

    private _entryGetBoolean(key: string, defaultVal: boolean): boolean {
        if (this._ntEntries.has(key)) {
            const entryInfo = this._ntEntries.get(key);

            if (entryInfo.entry.type === NTEntryType.BOOLEAN) {
                return entryInfo.entry.value.bool;
            }
        }
        return defaultVal;
    }

    private _entryGetString(key: string, defaultVal: string): string {
        if (this._ntEntries.has(key)) {
            const entryInfo = this._ntEntries.get(key);

            if (entryInfo.entry.type === NTEntryType.STRING) {
                return entryInfo.entry.value.str;
            }
        }
        return defaultVal;
    }

    private _entryGetDouble(key: string, defaultVal: number): number {
        if (this._ntEntries.has(key)) {
            const entryInfo = this._ntEntries.get(key);

            if (entryInfo.entry.type === NTEntryType.DOUBLE) {
                return entryInfo.entry.value.double;
            }
        }
        return defaultVal;
    }

    private _entryGetBooleanArray(key: string, defaultVal: boolean[]): boolean[] {
        if (this._ntEntries.has(key)) {
            const entryInfo = this._ntEntries.get(key);

            if (entryInfo.entry.type === NTEntryType.BOOLEAN_ARRAY) {
                return entryInfo.entry.value.bool_array;
            }
        }
        return defaultVal;
    }

    private _entryGetStringArray(key: string, defaultVal: string[]): string[] {
        if (this._ntEntries.has(key)) {
            const entryInfo = this._ntEntries.get(key);

            if (entryInfo.entry.type === NTEntryType.STRING_ARRAY) {
                return entryInfo.entry.value.str_array;
            }
        }
        return defaultVal;
    }

    private _entryGetDoubleArray(key: string, defaultVal: number[]): number[] {
        if (this._ntEntries.has(key)) {
            const entryInfo = this._ntEntries.get(key);

            if (entryInfo.entry.type === NTEntryType.DOUBLE_ARRAY) {
                return entryInfo.entry.value.double_array;
            }
        }
        return defaultVal;
    }

    private _entryGetRaw(key: string, defaultVal: Buffer): Buffer {
        if (this._ntEntries.has(key)) {
            const entryInfo = this._ntEntries.get(key);

            if (entryInfo.entry.type === NTEntryType.RAW) {
                return entryInfo.entry.value.raw;
            }
        }
        return defaultVal;
    }

    private _entrySetBoolean(key: string, val: boolean): boolean {
        if (!this._ntParticipant) {
            return false;
        }
        return this._ntParticipant.setBoolean(key, val);
    }

    private _entrySetString(key: string, val: string): boolean {
        if (!this._ntParticipant) {
            return false;
        }
        return this._ntParticipant.setString(key, val);
    }

    private _entrySetDouble(key: string, val: number): boolean {
        if (!this._ntParticipant) {
            return false;
        }
        return this._ntParticipant.setDouble(key, val);
    }

    private _entrySetBooleanArray(key: string, val: boolean[]): boolean {
        if (!this._ntParticipant) {
            return false;
        }
        return this._ntParticipant.setBooleanArray(key, val);
    }

    private _entrySetStringArray(key: string, val: string[]): boolean {
        if (!this._ntParticipant) {
            return false;
        }
        return this._ntParticipant.setStringArray(key, val);
    }

    private _entrySetDoubleArray(key: string, val: number[]): boolean {
        if (!this._ntParticipant) {
            return false;
        }
        return this._ntParticipant.setDoubleArray(key, val);
    }

    private _entrySetRaw(key: string, val: Buffer): boolean {
        if (!this._ntParticipant) {
            return false;
        }
        return this._ntParticipant.setRaw(key, val);
    }
}
