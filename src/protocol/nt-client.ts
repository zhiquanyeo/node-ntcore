import { EventEmitter } from "events";
import RRSocket from "../transport/rr-socket";

// A NetworkTablesConnection manages the lifetime of a connection to a
// NT server. Essentially, it handles connect/reconnects and the
// appropriate handshake with the server

// Subclasses might have more fine grained states
export enum NTConnectionState {
    NOT_CONNECTED,
    CONNECTING,
    CONNECTED
}

export interface NTClientOptions {
    address: string;
    port: number;
}

export default abstract class NTClient extends EventEmitter {
    protected _socket: RRSocket;
    private _currState: NTConnectionState = NTConnectionState.NOT_CONNECTED;

    constructor(options: NTClientOptions = { address: "localhost", port: 1735}) {
        super();

        this._socket = new RRSocket({
            address: options.address,
            port: options.port
        });

        // Hookup events
        this._socket.on("connected", async () => {
            // Hand off to the handshake
            try {
                this._setConnectionState(NTConnectionState.CONNECTING);
                await this._handshake();
                this._setConnectionState(NTConnectionState.CONNECTED);
            }
            catch(err) {
                console.log(err);
                this._setConnectionState(NTConnectionState.NOT_CONNECTED);
            }
        });

        this._socket.on("data", (data: Buffer) => {
            if (this._currState === NTConnectionState.CONNECTED) {
                // Hand off to the data handler
                this._handleData(data);
            }
        });

        this._socket.on("close", () => {
            this._setConnectionState(NTConnectionState.NOT_CONNECTED);
        });
    }

    public get connected(): boolean {
        return this._currState === NTConnectionState.CONNECTED;
    }

    public connect() {
        this._socket.connect();
    }

    public disconnect() {
        this._setConnectionState(NTConnectionState.NOT_CONNECTED);
        this._socket.disconnect();
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
