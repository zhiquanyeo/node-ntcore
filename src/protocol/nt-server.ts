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

}
