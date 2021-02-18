import { fromUnsignedLEB128, encodeLEB128String, parseNetworkEndpointInfo, decodeLEB128String, toUnsignedLEB128 } from "../protocol/protocol-utils";

describe("Protocol Utils", () => {
    it ("should obtain NetworkEndpointInfo-s correctly", () => {
        const result1 = parseNetworkEndpointInfo("localhost", 1735);
        expect(result1.address).toBe("localhost");
        expect(result1.port).toBe(1735);

        const result2 = parseNetworkEndpointInfo("tcp://localhost", 1735);
        expect(result2.address).toBe("localhost");
        expect(result2.port).toBe(1735);

        const result3 = parseNetworkEndpointInfo("localhost:8080", 1735);
        expect(result3.address).toBe("localhost");
        expect(result3.port).toBe(8080);

        const result4 = parseNetworkEndpointInfo("127.0.0.1", 1735);
        expect(result4.address).toBe("127.0.0.1");
        expect(result4.port).toBe(1735);

        const result5 = parseNetworkEndpointInfo("127.0.0.1:8080", 1735);
        expect(result5.address).toBe("127.0.0.1");
        expect(result5.port).toBe(8080);
    });

    it("should calculate LEB128 values correctly", () => {
        const number = 624485;
        const expectedBuffer = Buffer.from([0xE5, 0x8E, 0x26]);

        const encodeResult = toUnsignedLEB128(624485);
        expect(encodeResult).toEqual(expectedBuffer);

        const decodeResult = fromUnsignedLEB128(expectedBuffer, 0);
        expect(decodeResult.value).toBe(number);
    });

    it ("should convert strings to/from LEB128 encoding correctly", () => {
        const theString = "the quick brown fox";

        const encodedBuffer = encodeLEB128String(theString);
        const decodedResult = decodeLEB128String(encodedBuffer, 0);

        expect(decodedResult.value).toBe(theString);
    });
})
