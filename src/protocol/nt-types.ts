import NTEntry from "./nt-entry";

export enum NTConnectionState {
    NTCONN_NOT_CONNECTED,
    NTCONN_CONNECTING,
    NTCONN_CONNECTED
}

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

export class NTEntryNotFoundError extends Error {}
export class NTEntryTypeMismatchError extends Error{}

export enum NTEventUpdateSource {
    LOCAL = 0x01,
    REMOTE = 0x02
}

export interface NTEntryEvent {
    source: NTEventUpdateSource;
    entry: NTEntry;
    metadata?: {
        [key: string]: any
    }
}