import { V3EntryType, V3MessageType, V3RPCDefinition } from "../../protocol/v3/v3-types";
import { clearAllEntriesMessageFromBuffer, clearAllEntriesMessageToBuffer, clientHelloCompleteMessageFromBuffer, clientHelloCompleteMessageToBuffer, clientHelloMessageFromBuffer, clientHelloMessageToBuffer, entryAssignmentMessageFromBuffer, entryAssignmentMessageToBuffer, entryDeleteMessageFromBuffer, entryDeleteMessageToBuffer, entryFlagsUpdateMessageFromBuffer, entryFlagsUpdateMessageToBuffer, entryUpdateMessageFromBuffer, entryUpdateMessageToBuffer, keepAliveMessageFromBuffer, keepAliveMessageToBuffer, protoVersionUnsupportedMessageFromBuffer, protoVersionUnsupportedMessageToBuffer, serverHelloCompleteMessageFromBuffer, serverHelloCompleteMessageToBuffer, serverHelloMessageFromBuffer, serverHelloMessageToBuffer, V3ClientHelloMessage, V3EntryAssignmentMessage, V3EntryDeleteMessage, V3EntryDeleteMessageWrapper, V3EntryFlagsUpdateMessage, V3EntryUpdateMessage, V3ProtoVersionUnsupportedMessage, V3ServerHelloMessage } from "../../protocol/v3/v3-messages";

describe("NT V3 Messages", () => {
    it("should encode/decode KEEP ALIVE messages correctly", () => {
        const keepAliveBuf = keepAliveMessageToBuffer();
        const keepAliveMsg = keepAliveMessageFromBuffer(keepAliveBuf);

        expect(keepAliveMsg.newOffset).toBe(keepAliveBuf.length);
    });

    it("should encode/decode CLIENT HELLO messages correctly", () => {
        const expected: V3ClientHelloMessage = {
            type: V3MessageType.CLIENT_HELLO,
            protocolMajor: 3,
            protocolMinor: 0,
            clientIdent: "foobar"
        };

        const clientHelloBuf = clientHelloMessageToBuffer(expected);
        const result = clientHelloMessageFromBuffer(clientHelloBuf);

        expect(result.message).toEqual(expected);
        expect(result.newOffset).toBe(clientHelloBuf.length);
    });

    it("should encode/decode PROTOCOL UNSUPPORTED messages correctly", () => {
        const expected: V3ProtoVersionUnsupportedMessage = {
            type: V3MessageType.PROTO_VERSION_UNSUPPORTED,
            serverSupportedProtocolMinor: 3,
            serverSupportedProtocolMajor: 0
        };

        const protoUnsupportedBuf = protoVersionUnsupportedMessageToBuffer(expected);
        const result = protoVersionUnsupportedMessageFromBuffer(protoUnsupportedBuf);

        expect(result.message).toEqual(expected);
        expect(result.newOffset).toBe(protoUnsupportedBuf.length);
    });

    it("should encode/decode SERVER HELLO COMPLETE messages correctly", () => {
        const serverHelloCompleteBuf = serverHelloCompleteMessageToBuffer();
        const serverHelloCompleteMsg = serverHelloCompleteMessageFromBuffer(serverHelloCompleteBuf);

        expect(serverHelloCompleteMsg.newOffset).toBe(serverHelloCompleteBuf.length);
    });

    it ("should encode/decode SERVER HELLO messages correctly", () => {
        const expected: V3ServerHelloMessage = {
            type: V3MessageType.SERVER_HELLO,
            clientPreviouslySeen: true,
            serverIdentity: "super cool NT server"
        };

        const serverHelloBuf = serverHelloMessageToBuffer(expected);
        const result = serverHelloMessageFromBuffer(serverHelloBuf);

        expect(result.message).toEqual(expected);
        expect(result.newOffset).toBe(serverHelloBuf.length);
    });

    it("should encode/decode CLIENT HELLO COMPLETE messages correctly", () => {
        const clientHelloCompleteBuf = clientHelloCompleteMessageToBuffer();
        const clientHelloCompleteMsg = clientHelloCompleteMessageFromBuffer(clientHelloCompleteBuf);

        expect(clientHelloCompleteMsg.newOffset).toBe(clientHelloCompleteBuf.length);
    });

    describe("EntryAssignment Messages", () => {
        it("should encode/decode BOOLEAN EntryAssignment messages correctly", () => {
            const expected: V3EntryAssignmentMessage = {
                type: V3MessageType.ENTRY_ASSIGNMENT,
                entryName: "/My/Super/Cool/Entry",
                entryType: V3EntryType.BOOLEAN,
                entryId: 1234,
                entrySeq: 64,
                entryFlags: {
                    persistent: true
                },
                entryValue: {
                    bool: true
                }
            };

            const msgBuf = entryAssignmentMessageToBuffer(expected);
            const result = entryAssignmentMessageFromBuffer(msgBuf);

            expect(result.message).toEqual(expected);
            expect(result.newOffset).toBe(msgBuf.length);
        });

        it("should encode/decode DOUBLE EntryAssignment messages correctly", () => {
            const expected: V3EntryAssignmentMessage = {
                type: V3MessageType.ENTRY_ASSIGNMENT,
                entryName: "/My/Super/Cool/Entry",
                entryType: V3EntryType.DOUBLE,
                entryId: 1234,
                entrySeq: 64,
                entryFlags: {
                    persistent: true
                },
                entryValue: {
                    double: 1.234
                }
            };

            const msgBuf = entryAssignmentMessageToBuffer(expected);
            const result = entryAssignmentMessageFromBuffer(msgBuf);

            expect(result.message).toEqual(expected);
            expect(result.newOffset).toBe(msgBuf.length);
        });

        it("should encode/decode STRING EntryAssignment messages correctly", () => {
            const expected: V3EntryAssignmentMessage = {
                type: V3MessageType.ENTRY_ASSIGNMENT,
                entryName: "/My/Super/Cool/Entry",
                entryType: V3EntryType.STRING,
                entryId: 1234,
                entrySeq: 64,
                entryFlags: {
                    persistent: true
                },
                entryValue: {
                    str: "The quick brown fox"
                }
            };

            const msgBuf = entryAssignmentMessageToBuffer(expected);
            const result = entryAssignmentMessageFromBuffer(msgBuf);

            expect(result.message).toEqual(expected);
            expect(result.newOffset).toBe(msgBuf.length);
        });

        it("should encode/decode BOOLEAN ARRAY EntryAssignment messages correctly", () => {
            const expected: V3EntryAssignmentMessage = {
                type: V3MessageType.ENTRY_ASSIGNMENT,
                entryName: "/My/Super/Cool/Entry",
                entryType: V3EntryType.BOOLEAN_ARRAY,
                entryId: 1234,
                entrySeq: 64,
                entryFlags: {
                    persistent: true
                },
                entryValue: {
                    bool_array: [true, false, true, false, false, true]
                }
            };

            const msgBuf = entryAssignmentMessageToBuffer(expected);
            const result = entryAssignmentMessageFromBuffer(msgBuf);

            expect(result.message).toEqual(expected);
            expect(result.newOffset).toBe(msgBuf.length);
        });

        it("should encode/decode DOUBLE ARRAY EntryAssignment messages correctly", () => {
            const expected: V3EntryAssignmentMessage = {
                type: V3MessageType.ENTRY_ASSIGNMENT,
                entryName: "/My/Super/Cool/Entry",
                entryType: V3EntryType.DOUBLE_ARRAY,
                entryId: 1234,
                entrySeq: 64,
                entryFlags: {
                    persistent: true
                },
                entryValue: {
                    double_array: [1.234, 2, 1, 3.14]
                }
            };

            const msgBuf = entryAssignmentMessageToBuffer(expected);
            const result = entryAssignmentMessageFromBuffer(msgBuf);

            expect(result.message).toEqual(expected);
            expect(result.newOffset).toBe(msgBuf.length);
        });

        it("should encode/decode STRING ARRAY EntryAssignment messages correctly", () => {
            const expected: V3EntryAssignmentMessage = {
                type: V3MessageType.ENTRY_ASSIGNMENT,
                entryName: "/My/Super/Cool/Entry",
                entryType: V3EntryType.STRING_ARRAY,
                entryId: 1234,
                entrySeq: 64,
                entryFlags: {
                    persistent: true
                },
                entryValue: {
                    str_array: ["the", "quick brown", "", "fox"]
                }
            };

            const msgBuf = entryAssignmentMessageToBuffer(expected);
            const result = entryAssignmentMessageFromBuffer(msgBuf);

            expect(result.message).toEqual(expected);
            expect(result.newOffset).toBe(msgBuf.length);
        });

        it("should encode/decode RAW EntryAssignment messages correctly", () => {
            const expected: V3EntryAssignmentMessage = {
                type: V3MessageType.ENTRY_ASSIGNMENT,
                entryName: "/My/Super/Cool/Entry",
                entryType: V3EntryType.RAW,
                entryId: 1234,
                entrySeq: 64,
                entryFlags: {
                    persistent: true
                },
                entryValue: {
                    raw: Buffer.from([1, 2, 3, 4, 0xDE, 0xAD, 0xBE, 0xEF])
                }
            };

            const msgBuf = entryAssignmentMessageToBuffer(expected);
            const result = entryAssignmentMessageFromBuffer(msgBuf);

            expect(result.message).toEqual(expected);
            expect(result.newOffset).toBe(msgBuf.length);
        });

        // TODO need to tweak the RPC stuff
        it("should encode/decode RPC EntryAssignment messages correctly", () => {
            const rpcDef: V3RPCDefinition = {
                name: "My RPC",
                parameters: [
                    {
                        name: "Param1",
                        type: V3EntryType.BOOLEAN,
                        value: {
                            bool: false
                        }
                    },
                    {
                        name: "Param2",
                        type: V3EntryType.STRING,
                        value: {
                            str: "FooBar"
                        }
                    }
                ],
                results: [
                    {
                        name: "Result1",
                        type: V3EntryType.DOUBLE,
                        value: {}
                    }
                ]
            };

            const expected: V3EntryAssignmentMessage = {
                type: V3MessageType.ENTRY_ASSIGNMENT,
                entryName: "/My/Super/Cool/Entry",
                entryType: V3EntryType.RPC,
                entryId: 1234,
                entrySeq: 64,
                entryFlags: {
                    persistent: true
                },
                entryValue: {
                    rpc: rpcDef
                }
            };

            const msgBuf = entryAssignmentMessageToBuffer(expected);
            const result = entryAssignmentMessageFromBuffer(msgBuf);

            expect(result.message).toEqual(expected);
            expect(result.newOffset).toBe(msgBuf.length);
        });
    });

    describe("EntryUpdate Messages", () => {
        it("should encode/decode BOOLEAN EntryUpdate messages correctly", () => {
            const expected: V3EntryUpdateMessage = {
                type: V3MessageType.ENTRY_UPDATE,
                entryId: 4321,
                entrySeq: 128,
                entryType: V3EntryType.BOOLEAN,
                entryValue: {
                    bool: false
                }
            };

            const msgBuf = entryUpdateMessageToBuffer(expected);
            const result = entryUpdateMessageFromBuffer(msgBuf);

            expect(result.message).toEqual(expected);
            expect(result.newOffset).toBe(msgBuf.length);
        });

        it("should encode/decode DOUBLE EntryUpdate messages correctly", () => {
            const expected: V3EntryUpdateMessage = {
                type: V3MessageType.ENTRY_UPDATE,
                entryId: 4321,
                entrySeq: 128,
                entryType: V3EntryType.DOUBLE,
                entryValue: {
                    double: 3.14
                }
            };

            const msgBuf = entryUpdateMessageToBuffer(expected);
            const result = entryUpdateMessageFromBuffer(msgBuf);

            expect(result.message).toEqual(expected);
            expect(result.newOffset).toBe(msgBuf.length);
        });

        it("should encode/decode STRING EntryUpdate messages correctly", () => {
            const expected: V3EntryUpdateMessage = {
                type: V3MessageType.ENTRY_UPDATE,
                entryId: 4321,
                entrySeq: 128,
                entryType: V3EntryType.STRING,
                entryValue: {
                    str: "foo to the bar"
                }
            };

            const msgBuf = entryUpdateMessageToBuffer(expected);
            const result = entryUpdateMessageFromBuffer(msgBuf);

            expect(result.message).toEqual(expected);
            expect(result.newOffset).toBe(msgBuf.length);
        });

        it("should encode/decode BOOLEAN ARRAY EntryUpdate messages correctly", () => {
            const expected: V3EntryUpdateMessage = {
                type: V3MessageType.ENTRY_UPDATE,
                entryId: 4321,
                entrySeq: 128,
                entryType: V3EntryType.BOOLEAN_ARRAY,
                entryValue: {
                    bool_array: [true, false, false, true]
                }
            };

            const msgBuf = entryUpdateMessageToBuffer(expected);
            const result = entryUpdateMessageFromBuffer(msgBuf);

            expect(result.message).toEqual(expected);
            expect(result.newOffset).toBe(msgBuf.length);
        });

        it("should encode/decode DOUBLE ARRAY EntryUpdate messages correctly", () => {
            const expected: V3EntryUpdateMessage = {
                type: V3MessageType.ENTRY_UPDATE,
                entryId: 4321,
                entrySeq: 128,
                entryType: V3EntryType.DOUBLE_ARRAY,
                entryValue: {
                    double_array: [3.14, 0, 1.25, 2.456]
                }
            };

            const msgBuf = entryUpdateMessageToBuffer(expected);
            const result = entryUpdateMessageFromBuffer(msgBuf);

            expect(result.message).toEqual(expected);
            expect(result.newOffset).toBe(msgBuf.length);
        });

        it("should encode/decode STRING ARRAY EntryUpdate messages correctly", () => {
            const expected: V3EntryUpdateMessage = {
                type: V3MessageType.ENTRY_UPDATE,
                entryId: 4321,
                entrySeq: 128,
                entryType: V3EntryType.STRING_ARRAY,
                entryValue: {
                    str_array: ["", "meow", "my cat is weird"]
                }
            };

            const msgBuf = entryUpdateMessageToBuffer(expected);
            const result = entryUpdateMessageFromBuffer(msgBuf);

            expect(result.message).toEqual(expected);
            expect(result.newOffset).toBe(msgBuf.length);
        });

        it("should encode/decode RAW EntryUpdate messages correctly", () => {
            const expected: V3EntryUpdateMessage = {
                type: V3MessageType.ENTRY_UPDATE,
                entryId: 4321,
                entrySeq: 128,
                entryType: V3EntryType.RAW,
                entryValue: {
                    raw: Buffer.from([0xDE, 0xAD, 0xBE, 0xEF, 12, 34, 56])
                }
            };

            const msgBuf = entryUpdateMessageToBuffer(expected);
            const result = entryUpdateMessageFromBuffer(msgBuf);

            expect(result.message).toEqual(expected);
            expect(result.newOffset).toBe(msgBuf.length);
        });
    });

    it("should encode/decode ENTRY FLAGS UPDATE messages correctly", () => {
        const expected: V3EntryFlagsUpdateMessage = {
            type: V3MessageType.ENTRY_FLAGS_UPDATE,
            entryId: 2456,
            entryFlags: {
                persistent: false
            }
        };

        const msgBuf = entryFlagsUpdateMessageToBuffer(expected);
        const result = entryFlagsUpdateMessageFromBuffer(msgBuf);

        expect(result.message).toEqual(expected);
        expect(result.newOffset).toBe(msgBuf.length);
    });

    it("should encode/decode DELETE ENTRY messages correctly", () => {
        const expected: V3EntryDeleteMessage = {
            type: V3MessageType.ENTRY_DELETE,
            entryId: 2468
        };

        const msgBuf = entryDeleteMessageToBuffer(expected);
        const result = entryDeleteMessageFromBuffer(msgBuf);

        expect(result.message).toEqual(expected);
        expect(result.newOffset).toBe(msgBuf.length);
    });

    it("should encode/decode CLEAR ALL ENTRIES messages correctly", () => {
        const msgBuf = clearAllEntriesMessageToBuffer();
        const result = clearAllEntriesMessageFromBuffer(msgBuf);

        expect(result.newOffset).toBe(msgBuf.length);
    });
});
