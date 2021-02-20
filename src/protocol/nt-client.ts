import { EventEmitter } from "events";
import RRSocket from "../transport/rr-socket";

// A NetworkTablesConnection manages the lifetime of a connection to a
// NT server. Essentially, it handles connect/reconnects and the
// appropriate handshake with the server

// Subclasses might have more fine grained states
export enum NTConnectionState {
    NTCONN_NOT_CONNECTED,
    NTCONN_CONNECTING,
    NTCONN_CONNECTED
}

export interface NTClientOptions {
    address: string;
    port: number;
}


// TODO this should be moved into a nt-types file at some point
export class NTProtocolVersionUnsupportedError extends Error {
    private _serverSupportedVersion: NTProtocolVersion;

    constructor(serverSupportedVersion: NTProtocolVersion, msg?: string) {
        super(msg);

        this._serverSupportedVersion = serverSupportedVersion;
    }

    public get serverSupportedVersion(): NTProtocolVersion {
        return this._serverSupportedVersion;
    }
}

export interface NTProtocolVersion {
    major: number;
    minor: number;
}


export default abstract class NTClient extends EventEmitter {
    protected _socket: RRSocket;
    private _currState: NTConnectionState = NTConnectionState.NTCONN_NOT_CONNECTED;
    private _version: NTProtocolVersion = { major: -1, minor: -1};

    protected constructor(version: NTProtocolVersion, options: NTClientOptions = { address: "localhost", port: 1735}) {
        super();

        this._version = version;

        this._socket = new RRSocket({
            address: options.address,
            port: options.port
        });

        // Hookup events
        this._socket.on("connected", async () => {
            // The "connected" event represents that the transport layer
            // (i.e. TCP) is now connected. We can initiate handshaking
            // Hand off to the handshake
            try {
                this._setConnectionState(NTConnectionState.NTCONN_CONNECTING);
                await this._handshake();
                this._setConnectionState(NTConnectionState.NTCONN_CONNECTED);
            }
            catch(err) {
                this._setConnectionState(NTConnectionState.NTCONN_NOT_CONNECTED);
                if (err instanceof NTProtocolVersionUnsupportedError) {
                    console.log(`Unsupported version requested. Server supports ${err.serverSupportedVersion.major}.${err.serverSupportedVersion.minor}`);
                }

                // Re-throw the error
                throw err;
            }
        });

        this._socket.on("data", (data: Buffer) => {
            this._handleData(data);
        });

        this._socket.on("close", () => {
            this._setConnectionState(NTConnectionState.NTCONN_NOT_CONNECTED);
        });
    }

    public get connected(): boolean {
        return this._currState === NTConnectionState.NTCONN_CONNECTED;
    }

    public set address(val: string) {
        this._socket.address = val;
    }

    public get address(): string {
        return this._socket.address;
    }

    public set port(val: number) {
        this._socket.port = val;
    }

    public get port(): number {
        return this._socket.port;
    }

    public connect() {
        this._socket.connect();
    }

    public disconnect() {
        this._setConnectionState(NTConnectionState.NTCONN_NOT_CONNECTED);
        this._socket.disconnect();
    }

    // PUBLIC API FOR CLIENTS


    protected _write(data: Buffer, immediate: boolean = false): Promise<void> {
        // TODO Buffer
        return this._socket.write(data);
    }

    private _setConnectionState(state: NTConnectionState) {
        if (this._currState !== state) {
            this.emit("connectionStateChanged", {
                oldState: this._currState,
                newState: state
            });
            this._currState = state;
        }

    }

    protected abstract _handshake(): Promise<void>;
    protected abstract _handleData(data: Buffer): void;
}
