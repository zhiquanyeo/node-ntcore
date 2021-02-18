import NTClient, { NTClientOptions } from "../nt-client";
import { EventEmitter } from "events";
import { V3ClientHandshakeState } from "./v3-types";

export interface V3ClientOptions extends NTClientOptions {

}

class V3ClientHandshakeManager extends EventEmitter {
    private _state: V3ClientHandshakeState = V3ClientHandshakeState.V3HS_NOT_CONNECTED;
    private _client: V3NTClient;

    constructor(client: V3NTClient) {
        super();
        this._client = client;
    }

    public beginHandshake() {
    }
}

export default class V3NTClient extends NTClient {
    // Handler for handshake data
    private _handshakeDataHandler: (data: Buffer) => void;

    private _clientIdent: string;

    // Remaining un-processed data
    private _remainingData: Buffer;
    private _remainingDataOffset: number = 0;

    constructor(options?: V3ClientOptions) {
        super(3, options);

        // TODO handle additional options, if present
    }

    protected _handshake(): Promise<void> {
        return new Promise((resolve, reject) => {

        });
    }
    protected _handleData(data: Buffer): void {
        throw new Error("Method not implemented.");
    }

    protected _handleNonConnectedData(data: Buffer): void {
        if (this._handshakeDataHandler) {
            this._handshakeDataHandler(data);
        }
    }
}
