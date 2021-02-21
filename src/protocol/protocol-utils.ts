import fastDeepEqual from "fast-deep-equal";
import { NTEntryValue } from "./nt-entry";

export interface NetworkEndpointInfo {
    address: string;
    port: number;
}

export function parseNetworkEndpointInfo(address: string, port: number): NetworkEndpointInfo {
    // Prepend the protocol if there isn't one
    if (!(/:\/\/\w/).test(address)) {
        address = "tcp://" + address;
    }

    const parsedURL = new URL(address);
    const parsedHostname = parsedURL.hostname;
    let parsedPort = parseInt(parsedURL.port, 10);
    if (isNaN(parsedPort)) {
        parsedPort = port;
    }

    return {
        address: parsedHostname,
        port: parsedPort
    };
}

export function toUnsignedLEB128(num: number): Buffer {
    let n = num;
    let result: number[] = [];

    while (true) {
        const byte = n & 0x7F;
        n >>= 7;
        if ((n === 0 && (byte & 0x40) === 0) || (n === -1 && (byte & 0x40) !== 0)) {
            result.push(byte);
            break;
        }
        else {
            result.push(byte | 0x80);
        }
    }

    return Buffer.from(result);
}

export interface LEB128Result {
    value: number;
    offset: number;
}

export function fromUnsignedLEB128(buf: Buffer, offset: number): LEB128Result {
    let result = 0;
    let shift = 0;
    while (true) {
        const byte = buf[offset];
        offset++;
        result |= (byte & 0x7F) << shift;
        shift += 7;
        if ((byte & 0x80) === 0) {
            if (shift < 32 && (byte & 0x40) !== 0) {
                result |= (~0 << shift);
                break;
            }
            break;
        }
    }

    return {
        value: result,
        offset
    };
}

export class BufferLengthError extends Error {}
export class InvalidMessageTypeError extends Error {}
export class InvalidEntryValueError extends Error {}
export class InvalidEntryTypeError extends Error {}

export function checkBufferLength(buf: Buffer, offset: number, bytesToRead: number = 1) {
    if (offset + bytesToRead > buf.length) {
        throw new BufferLengthError(`Cannot read ${bytesToRead} byte(s) starting at ${offset}. Buffer length: ${buf.length}`);
    }
}

export function encodeLEB128String(msg: string): Buffer {
    return Buffer.concat([
        toUnsignedLEB128(msg.length),
        Buffer.from(msg, "utf-8")
    ]);
}

export interface LEB128StringResult {
    value: string;
    offset: number;
}

export function decodeLEB128String(buf: Buffer, offset: number = 0): LEB128StringResult {
    let decodeResult = fromUnsignedLEB128(buf, offset);
    const end = decodeResult.offset + decodeResult.value;

    checkBufferLength(buf, decodeResult.offset, decodeResult.value);

    return {
        offset: end,
        value: buf.slice(decodeResult.offset, end).toString("utf-8")
    }
}

export function ntValueIsEqual(a: NTEntryValue, b: NTEntryValue) {
    return fastDeepEqual(a, b);
}