import NTParticipant from "../protocol/nt-participant";
import NTEntry from "../protocol/nt-entry";
import V3NTClient from "../protocol/v3/v3-nt-client";
import { NTConnectionState, NTEntryEvent } from "../protocol/nt-types";
import { NT_DEFAULT_PORT } from "./network-table-instance";
import V3NTServer from "../protocol/v3/v3-nt-server";

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

export default class NetworkTableInstance {


    // INSTANCE METHODS AND PROPERTIES

    // Stores all the registered raw NTEntry objects
    // These represent actual, live data
    private _ntEntries: Map<string, NTEntry> = new Map<string, NTEntry>();

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

    // Start this instance as a client
    public startClient(hostAddr: string, port: number = DEFAULT_NT_PORT) {

        if (this._opMode !== OperatingMode.UNCONFIGURED && this._connState !== ConnectionState.OFFLINE) {
            return;
        }

        if (this._opMode !== OperatingMode.CLIENT) {
            if (this._ntParticipant) {
                this._ntParticipant.removeAllListeners();
            }

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

    public startServer(persistFile: string, port: number = NT_DEFAULT_PORT) {
        if (this._opMode !== OperatingMode.UNCONFIGURED && this._connState !== ConnectionState.OFFLINE) {
            return;
        }

        if (this._opMode !== OperatingMode.SERVER) {
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
        // Add this to our collection
        if (this._ntEntries.has(evt.entry.name)) {
            // TODO what happens now?
        }

        this._ntEntries.set(evt.entry.name, evt.entry);
    }

    private _onEntryUpdated(evt: NTEntryEvent) {
        if (this._ntEntries.has(evt.entry.name)) {
            this._ntEntries.set(evt.entry.name, {...evt.entry});
        }
    }

    private _onEntryFlagsUpdated(evt: NTEntryEvent) {
        if (this._ntEntries.has(evt.entry.name)) {
            const entry = this._ntEntries.get(evt.entry.name);
            entry.flags = {...evt.entry.flags};
        }
    }

    private _onEntryDeleted(evt: NTEntryEvent) {
        this._ntEntries.delete(evt.entry.name);

        // Broadcast
    }
}
