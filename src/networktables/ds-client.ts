import { EventEmitter } from "events";
import { Socket } from "net";

const DS_INTERFACE_PORT = 1742;

export default class DSClient extends EventEmitter {
    private _socket: Socket;
    private _connected: boolean = false;

    private _buffer: Buffer;

    constructor() {
        super();
        this._socket = new Socket();

        this._socket.on("data", (data: Buffer) => {
            if (!this._buffer) {
                this._buffer = data;
            }
            else {
                this._buffer = Buffer.concat([this._buffer, data]);
            }

            this._handleData();
        });
    }

    public start() {
        if (!this._connected) {
            this._socket.connect({
                host: "localhost",
                port: DS_INTERFACE_PORT
            },
            () => {
                this._connected = true;
            });
        }
    }

    public stop() {
        this._socket.end(() => {
            this._connected = false;
        });
    }

    private _handleData() {

    }
}