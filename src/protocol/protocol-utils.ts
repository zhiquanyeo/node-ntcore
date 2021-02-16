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

export function toLEB128(num: number): Buffer {
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

export function fromLEB128(buf: Buffer, offset: number): LEB128Result {
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
