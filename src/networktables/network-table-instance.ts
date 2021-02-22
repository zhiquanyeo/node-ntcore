import NTParticipant from "../protocol/nt-participant";
import { v4 as uuidv4 } from "uuid";
import NetworkTable from "./network-table";
import NetworkTableEntry, { EntryInfo } from "./network-table-entry";
import V3NTServer from "../protocol/v3/v3-nt-server";
import { NTConnectionState } from "../protocol/nt-types";
import { NetworkEndpointInfo } from "../transport/transport-types";
import V3NTClient from "../protocol/v3/v3-nt-client";
import NTClient from "../protocol/nt-client";

export const NT_DEFAULT_PORT: number = 1735;

const NT_DEFAULT_INSTANCE_IDENT: string = "NT_DEFAULT_INSTANCE";

export enum NetworkMode {
    NONE = 0x00,
    SERVER = 0x01,
    CLIENT = 0x02,
    STARTING = 0x04,
    FAILURE = 0x08,
    LOCAL = 0x10
}

export default class NetworkTableInstance {
    // STATIC PROPERTIES AND METHODS
    private static _instances: Map<string, NetworkTableInstance> = new Map<string, NetworkTableInstance>();

    public static getDefault(): NetworkTableInstance {
        if (!this._instances.has(NT_DEFAULT_INSTANCE_IDENT)) {
            this._instances.set(NT_DEFAULT_INSTANCE_IDENT, new NetworkTableInstance(NT_DEFAULT_INSTANCE_IDENT));
        }

        return this._instances.get(NT_DEFAULT_INSTANCE_IDENT);
    }

    public static create(): NetworkTableInstance {
        const guid = uuidv4();
        const instance = new NetworkTableInstance(guid);

        this._instances.set(guid, instance);
        return instance;
    }

    // INSTANCE PROPERTIES AND METHODS
    private _guid: string;

    private _netMode: NetworkMode = NetworkMode.NONE;
    private _ntParticipant: NTParticipant;
    private _tables: Map<string, NetworkTable> = new Map<string, NetworkTable>();

    private _identifier: string;

    // Used for client only
    private _serverAddress: NetworkEndpointInfo;

    private constructor(guid: string) {
        this._guid = guid;
    }

    public get guid(): string {
        return this._guid;
    }

    public getEntry(key: string): NetworkTableEntry {
        throw new Error("Method not implemented");
    }

    public getEntries(prefix: string): NetworkTableEntry[] {
        throw new Error("Method not implemented");
    }

    public getEntryInfo(prefix: string): EntryInfo {
        throw new Error("Method not implemented");
    }

    public getTable(key: String): NetworkTable {
        throw new Error("Method not implemented");
    }

    public deleteAllEntries(): void {
        throw new Error("Method not implemented");
    }

    // TODO Entry Listeners

    public setNetworkIdentity(ident: string) {
        this._identifier = ident;

        if (this._ntParticipant) {
            this._ntParticipant.identifier = ident;
        }
    }

    public getNetworkMode(): NetworkMode {
        return this._netMode;
    }

    public startLocal() {
        throw new Error("Method not implemented");
    }

    public stopLocal() {
        throw new Error("Method not implemented");
    }

    public startServer(persistFile?: string, listenAddress?: string, listenPort?: number) {
        if (this._netMode !== NetworkMode.NONE) {
            // We're already in some other mode, bail out
            return;
        }

        if (!persistFile) {
            persistFile = "networktables.ini";
        }

        if (!listenAddress) {
            listenAddress = "";
        }

        if (!listenPort) {
            listenPort = NT_DEFAULT_PORT;
        }

        this._ntParticipant = new V3NTServer({
            port: listenPort,
            identifier: this._identifier
        });

        this._netMode = NetworkMode.SERVER | NetworkMode.STARTING;

        this._ntParticipant.on("connectionStateChanged", (oldState, newState) => {
            if (newState === NTConnectionState.NTCONN_CONNECTED) {
                this._netMode = NetworkMode.SERVER;
            }
        });

        this._ntParticipant.start();
    }

    public stopServer() {
        if ((this._netMode & NetworkMode.SERVER) !== NetworkMode.SERVER) {
            this._ntParticipant.stop();
            this._ntParticipant.removeAllListeners();
            this._ntParticipant = undefined;

            this._netMode = NetworkMode.NONE;
        }
        else {
            throw new Error("Not in server mode");
        }
    }

    public startClient(serverAddress?: string, port?: number) {
        if (this._netMode !== NetworkMode.NONE) {
            return;
        }

        if (!serverAddress) {
            if (this._serverAddress) {
                serverAddress = this._serverAddress.address;
            }
            else {
                serverAddress = "localhost";
            }
        }

        if (port === undefined) {
            if (this._serverAddress) {
                port = this._serverAddress.port;
            }
            else {
                port = NT_DEFAULT_PORT;
            }
        }

        this._serverAddress = {
            address: serverAddress,
            port
        };

        this._ntParticipant = new V3NTClient({
            identifier: this._identifier,
            address: serverAddress,
            port
        });

        this._netMode = NetworkMode.CLIENT | NetworkMode.STARTING;

        this._ntParticipant.on("connectionStateChanged", (oldState, newState) => {
            if (newState === NTConnectionState.NTCONN_CONNECTED) {
                this._netMode = NetworkMode.CLIENT;
            }
        });

        this._ntParticipant.start();
    }

    public startClientTeam(teamNumber: number) {
        const lower = (teamNumber % 100);
        const upper = (teamNumber - lower) / 100;

        const ipAddr = `10.${upper}.${lower}.2`;

        this.startClient(ipAddr);
    }

    public stopClient() {
        if ((this._netMode & NetworkMode.CLIENT) !== NetworkMode.CLIENT) {
            this._ntParticipant.stop();
            this._ntParticipant.removeAllListeners();
            this._ntParticipant = undefined;

            this._netMode = NetworkMode.NONE;
        }
        else {
            throw new Error("Not in client mode");
        }
    }

    public setServer(serverAddress: string, port?: number) {
        if (port === undefined) {
            port = NT_DEFAULT_PORT;
        }

        this._serverAddress = {
            address: serverAddress,
            port
        };

        if ((this._netMode & NetworkMode.CLIENT) === NetworkMode.CLIENT) {
            (this._ntParticipant as NTClient).setServerEndpoint(this._serverAddress);
        }
    }

    public setServerTeam(teamNumber: number) {
        const lower = (teamNumber % 100);
        const upper = (teamNumber - lower) / 100;

        const ipAddr = `10.${upper}.${lower}.2`;
        this.setServer(ipAddr);
    }

    public startDSClient() {
        // TODO Implement
        // We should be able to start this at any time, but only
        // send messages if we are in client state
    }

    public stopDSClient() {
        // TODO Implement
    }

    public setUpdateRate(updateIntervalSeconds: number) {
        throw new Error("Method not implemented");
    }

    public flush() {
        throw new Error("Method not implemented");
    }
}