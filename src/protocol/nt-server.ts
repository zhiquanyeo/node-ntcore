import net, { Server, Socket } from "net";
import NTParticipant, { NTParticipantOptions } from "./nt-participant";
import { NTConnectionState, NTProtocolVersion } from "./nt-types";

export interface NTServerOptions extends NTParticipantOptions {
    port: number;
}

export interface NTClientSocket {
    identifier: string;
    socket: Socket;
}

export default abstract class NTServer extends NTParticipant {
    protected _server: Server;
    private _options: NTServerOptions;

    protected constructor(version: NTProtocolVersion, options: NTServerOptions = { port: 1735 }) {
        super(options);
        
        this._options = options;
        this._version = version;

        this._server = net.createServer(async (socket) => {
            this._onSocketConnected(socket);

            // // When a socket connects, we should run through the handshake procedure
            // try {
            //     const identifier = await this._connectionHandshake(socket);
            //     // If we got past the handshake, add this to our list

            //     this._connections.push({
            //         identifier,
            //         socket
            //     });

            //     // Hook up events
            //     socket.on("data", (data: Buffer) => {
            //         this._handleSocketData(socket, data);
            //     });

            //     socket.on("close", () => {
            //         for (let i = 0; i < this._connections.length; i++) {
            //             if (this._connections[i].socket === socket) {
            //                 console.log(`Removing Socket ${this._connections[i].identifier} from list`);
            //                 this._connections.splice(i, 1);
            //                 break;
            //             }
            //         }
            //     });
            // }
            // catch (err) {
            //     socket.destroy();
            // }
        });
    }

    public start() {
        this._server.listen(this._options.port, () => {
            console.log(`NT Server [${this._options.identifier}] listening on port ${this._options.port}`);
            this._setConnectionState(NTConnectionState.NTCONN_CONNECTED);
        });
    }

    public stop() {
        this._server.close(() => {
            this._setConnectionState(NTConnectionState.NTCONN_NOT_CONNECTED);
        });
    }

    protected abstract _onSocketConnected(socket: Socket): void;
    protected abstract _connectionHandshake(socket: Socket): Promise<string>;
    protected abstract _handleSocketData(socket: Socket, data: Buffer): void;
}