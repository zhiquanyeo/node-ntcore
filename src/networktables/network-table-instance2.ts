import { v4 as uuidv4 } from "uuid";
import NTParticipant from "../protocol/nt-participant";
import NTEntry from "../protocol/nt-entry";
import V3NTClient from "../protocol/v3/v3-nt-client";
import { NTConnectionState, NTEntryEvent } from "../protocol/nt-types";
import V3NTServer from "../protocol/v3/v3-nt-server";
import NetworkTableEntry from "./network-table-entry2";

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

export interface NTEntryInfo {
    entry: NTEntry,
    lastUpdate: number;
}

export default class NetworkTableInstance {


    // INSTANCE METHODS AND PROPERTIES

    // Stores all the registered raw NTEntry objects
    // These represent actual, live data
    private _ntEntries: Map<string, NTEntryInfo> = new Map<string, NTEntryInfo>();

    // Map from NTEntry key => guid
    private _entryGuidMap: Map<string, string> = new Map<string, string>();
    private _pendingEntryGuids: Map<string, string> = new Map<string, string>();

    // Cache of NetworkTableEntry-s
    private _entries: Map<string, NetworkTableEntry> = new Map<string, NetworkTableEntry>();

    private _ntParticipant: NTParticipant | null = null;
    private _netIdentity: string = "NetworkTable";

    private _opMode: OperatingMode = OperatingMode.UNCONFIGURED;
    private _connState: ConnectionState = ConnectionState.OFFLINE;

    constructor() {

    }

    public setNetworkIdentity(ident: string) {
        this._netIdentity = ident;

        if (this._ntParticipant) {
            this._ntParticipant.identifier = this._netIdentity;
        }
    }

    public getEntry(key: string): NetworkTableEntry {
        if (this._entryGuidMap.has(key)) {
            // We have a previously cached NetworkTableEntry
            const entryGuid = this._entryGuidMap.get(key);
            return this._entries.get(entryGuid);
        }
        else if (this._pendingEntryGuids.has(key)) {
            // We have a previously cached PENDING NetworkTableEntry
            const entryGuid = this._pendingEntryGuids.get(key);
            return this._entries.get(entryGuid);
        }
        else {
            // Create the entry accessor anyway
            const entryGuid = uuidv4();
            const newEntry = new NetworkTableEntry(this, key, this._entryAccessor.bind(this));

            this._entries.set(entryGuid, newEntry);

            if (this._ntEntries.has(key)) {
                // If this is a live record, add the map from key to guid
                this._entryGuidMap.set(key, entryGuid);
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

    private _entryAccessor(key: string): NTEntryInfo | null {
        console.log("Looking up ", key);
        if (this._ntEntries.has(key)) {
            console.log("ENTRY FOUND!");
            return this._ntEntries.get(key);
        }

        return null;
    }
}
