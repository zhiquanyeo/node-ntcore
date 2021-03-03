import { EventEmitter } from "events";
import { Socket } from "net";
import Logger from "../utils/logger";
import { NetworkEndpointInfo } from "./transport-types";

export interface RRSocketOptions {
    address?: string;
    port?: number;
    reconnectDelay?: number;
    ident?: string;
}

export interface AddressPortInfo {
    address: string;
    port: number;
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

    private _logger: Logger;

    private _reconnectCount = 0;

    constructor(options?: RRSocketOptions, logger?: Logger) {
        super();

        if (logger) {
            this._logger = logger;
        }
        else {
            this._logger = new Logger("RRSocket");
        }

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

    public setNetworkEndpoint(endpoint: NetworkEndpointInfo, forceReconnect: boolean = false): void {
        if (forceReconnect || endpoint.address !== this._address || endpoint.port !== this._port) {
            this._address = endpoint.address;
            this._port = endpoint.port;

            if (this._socketConnected) {
                this.disconnect();
                this.connect();
            }
        }
    }

    public connect() {
        if (this._socketConnected) {
            return;
        }

        if (this._socket) {
            this._socket.removeAllListeners();
        }

        this._socket = new Socket();
        this._hookupEvents();

        this._doConnect();
    }

    public disconnect() {
        clearTimeout(this._reconnectTimeoutHandle);

        if (!this._socketConnected) {
            this._logger.info(`[${this._ident}] socket not connected during disconnect`);
            return;
        }

        if (this._socket) {
            this._socket.removeAllListeners();
            this._socket.end(() => {
                this._logger.info("TCP Socket disconnected");
            });
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
            if (err.message.indexOf("ECONNREFUSED") !== -1 ||
                err.message.indexOf("ECONNRESET") !== -1) {
                this._attemptReconnect();
            }
        });

        this._socket.on("end", () => {
            this._socket.end();
            this._socketConnected = false;

            this._attemptReconnect();
        });
    }

    private _attemptReconnect() {
        clearTimeout(this._reconnectTimeoutHandle);
        this._reconnectTimeoutHandle = setTimeout(() => {
            this._reconnectCount++;
            this._logger.debug(`[${this._ident}] Reconnecting to ${this._address}:${this._port} (Socket Closed)`);

            if (this._reconnectCount % 10 === 0) {
                this._logger.info(`[${this._ident}] ${this._reconnectCount} reconnect attempt(s) so far...`);
            }

            this.emit("reconnectAttempt");
            this.connect();
        }, this._reconnectTimeoutDelayMs);
    }

    private _doConnect() {
        this._socket.connect(this._port, this._address, () => {
            this._socketConnected = true;
            this._logger.info(`[${this._ident}] Connected to ${this._address}:${this._port}`);
            this.emit("connected");
            this._reconnectCount = 0;
        });
    }
}
