import { NetworkEndpointInfo } from "../transport/transport-types";
import RRSocket from "../transport/rr-socket";
import NTParticipant, { NTParticipantOptions } from "./nt-participant";
import { NTConnectionState, NTProtocolVersion, NTProtocolVersionUnsupportedError } from "./nt-types";

export interface NTClientOptions extends NTParticipantOptions {
    address: string;
    port: number;
}

export default abstract class NTClient extends NTParticipant {
    protected _socket: RRSocket;
    
    protected constructor(version: NTProtocolVersion, options: NTClientOptions = { address: "localhost", port: 1735}) {
        super(options);

        this._version = version;

        this._socket = new RRSocket({
            address: options.address,
            port: options.port
        });

        // Hookup events
        this._socket.on("connected", async () => {
            // The "connected" event represents that the transport layer
            // (i.e. TCP) is now connected. We can initiate handshaking
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

    public setServerEndpoint(endpoint: NetworkEndpointInfo) {
        this._socket.setNetworkEndpoint(endpoint);
    }

    public start() {
        this._socket.connect();
    }

    public stop() {
        this._setConnectionState(NTConnectionState.NTCONN_NOT_CONNECTED);
        this._socket.disconnect();
    }

    protected _write(data: Buffer, immediate: boolean = false): Promise<void> {
        // TODO Buffer
        return this._socket.write(data);
    }

    

    protected abstract _handshake(): Promise<void>;
    protected abstract _handleData(data: Buffer): void;
}
