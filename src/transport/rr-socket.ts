import { EventEmitter } from "events";
import { Socket } from "net";

export interface RRSocketOptions {
    address?: string;
    port?: number;
    reconnectDelay?: number;
    ident?: string;
}

/**
 * Re-targetable, Re-connecting Socket
 *
 * This socket wrapper allows re-targetting (having the same socket object
 * but connecting to a different endpoint), and re-connection (tries to
 * connect over and over)
 */
export default class RRSocket extends EventEmitter {
    private _socket: Socket;
    private _socketConnected: boolean = false;
    private _ident: string = "";

    private _reconnectTimeoutDelayMs: number = 1000;
    private _reconnectTimeoutHandle: NodeJS.Timeout;

    private _address: string = "";
    private _port: number = 0;

    constructor(options?: RRSocketOptions) {
        super();

        if (options) {
            if (options.address !== undefined) {
                this._address = options.address;
            }

            if (options.port !== undefined) {
                this._port = options.port;
            }

            if (options.reconnectDelay !== undefined) {
                this._reconnectTimeoutDelayMs = options.reconnectDelay;
            }

            if (options.ident !== undefined) {
                this._ident = options.ident;
            }
        }
    }

    public get address(): string {
        return this._address;
    }

    public set address(val: string) {
        if (val !== this._address) {
            this._address = val;
            if (this._socketConnected) {
                this.disconnect();
                this.connect();
            }
        }
    }

    public get port(): number {
        return this._port;
    }

    public set port(val: number) {
        if (val !== this._port) {
            this._port = val;

            if (this._socketConnected) {
                this.disconnect();
                this.connect();
            }
        }
    }

    public get connected(): boolean {
        return this._socketConnected;
    }

    public connect() {
        if (this._socketConnected) {
            return;
        }

        this._socket = new Socket();
        this._hookupEvents();

        this._doConnect();
    }

    public disconnect() {
        clearTimeout(this._reconnectTimeoutHandle);

        if (!this._socketConnected) {
            console.log(`[${this._ident}] socket not connected during disconnect`);
            return;
        }

        if (this._socket) {
            this._socket.removeAllListeners();
            this._socket.end();
            this._socketConnected = false;
            this.emit("close", false);

            this._socket = undefined;
            this._socketConnected = false;
        }
    }

    public write(data: Buffer): Promise<void> {
        if (!this._socketConnected) {
            return Promise.resolve();
        }

        return new Promise(resolve => {
            this._socket.write(data, () => {
                resolve();
            });
        });
    }

    private _hookupEvents() {
        this._socket.on("data", data => {
            this.emit("data", data);
        });

        this._socket.on("close", (hadError: boolean) => {
            if (this._socketConnected) {
                // We were previously connected, therefore this must
                // be a disconnection and we should try to reconnect
                this._attemptReconnect();
            }

            this._socketConnected = false;
        });

        this._socket.on("error", err => {
            if (err.message.indexOf("ECONNREFUSED") !== -1) {
                this._attemptReconnect();
            }
        });

        this._socket.on("end", () => {
            this._socket.end();
            this._socketConnected = false;

            this._attemptReconnect();
        })
    }

    private _attemptReconnect() {
        clearTimeout(this._reconnectTimeoutHandle);
        this._reconnectTimeoutHandle = setTimeout(() => {
            console.log(`[${this._ident}] Reconnecting to ${this._address}:${this._port} (Socket Closed)`);
            this.emit("reconnectAttempt");
            this.connect();
        }, this._reconnectTimeoutDelayMs);
    }

    private _doConnect() {
        this._socket.connect(this._port, this._address, () => {
            this._socketConnected = true;
            console.log(`[${this._ident}] Connected to ${this._address}:${this._port}`);
            this.emit("connected");
        });
    }
}
