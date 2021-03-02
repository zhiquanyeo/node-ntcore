import { EventEmitter } from "events";
import { Socket } from "net";
import Logger from "../utils/logger";
import StrictEventEmitter from "strict-event-emitter-types/types/src";

const DS_INTERFACE_PORT = 1742;

export interface ServerIPAddressInfo {
    asUInt32: number;
    asArray: number[];
    asString: string;
}

interface DSClientEvents {
    connected: void;
    disconnected: void;
    ipChanged: (addrInfo: ServerIPAddressInfo) => void;
}
type DSClientEventEmitter = StrictEventEmitter<EventEmitter, DSClientEvents>;

export default class DSClient extends (EventEmitter as new () => DSClientEventEmitter) {
    private _socket: Socket;
    private _connected: boolean = false;

    private _bufferStr: string;

    private _logger: Logger

    constructor(logger?: Logger) {
        super();
        this._socket = new Socket();

        if (logger) {
            this._logger = logger;
        }
        else {
            this._logger = new Logger("DSClient");
        }

        this._socket.on("data", (data: Buffer) => {
            if (!this._bufferStr) {
                this._bufferStr = data.toString();
            }
            else {
                this._bufferStr = this._bufferStr + data.toString();
            }

            this._handleData();
        });

        this._socket.on("close", () => {
            this._connected = false;
            this.emit("disconnected");
        })
    }

    public start() {
        if (!this._connected) {
            this._socket.connect({
                host: "localhost",
                port: DS_INTERFACE_PORT
            },
            () => {
                this._connected = true;
                this.emit("connected");
            });
        }
    }

    public stop() {
        this._socket.end(() => {
            this._connected = false;
            this.emit("disconnected")
        });
    }

    private _handleData() {
        // Split on newlines
        const newlineRegexp = /\n/;

        let match: RegExpExecArray;
        while ((match = newlineRegexp.exec(this._bufferStr))) {
            const str = this._bufferStr.substring(0, match.index);

            try {
                const obj: any = JSON.parse(str);
                if (obj.robotIP !== undefined) {
                    const ipUInt32: number = obj.robotIP;
                    const buf = Buffer.alloc(4);
                    buf.writeUInt32BE(ipUInt32);
                    const ipArr = [...buf];
                    this.emit("ipChanged", {
                        asUInt32: ipUInt32,
                        asArray: ipArr,
                        asString: ipArr.join(".")
                    });
                }
            }
            catch (err) {
                this._logger.error("Failed to parse JSON: ", err);
            }
            this._bufferStr = this._bufferStr.substring(match.index + 1);
        }
    }
}
