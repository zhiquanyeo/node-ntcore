import { V3ClientHandshakeState, V3EntryType, V3MessageType } from "../../protocol/v3/v3-types";
import { clientHelloMessageToBuffer, entryAssignmentMessageToBuffer, serverHelloCompleteMessageToBuffer, serverHelloMessageToBuffer, V3EntryAssignmentMessage, V3ServerHelloCompleteMessage, V3ServerHelloMessage } from "../../protocol/v3/v3-messages";
import { V3ClientHandshakeManager } from "../../protocol/v3/v3-nt-client";
import Logger from "../../utils/logger";

describe("V3 Client Handshake Manager", () => {
    it("should perform the handshake correctly", async (done) => {
        let serverBuffers: Buffer[] = [];

        function toServer(data: Buffer): Promise<void> {
            serverBuffers.push(data);
            return Promise.resolve();
        }

        const handshakeManager: V3ClientHandshakeManager = new V3ClientHandshakeManager("foo", toServer, new Logger("TEST"));

        handshakeManager.beginHandshake();
        expect(serverBuffers.length).toBe(1);
        expect(serverBuffers[0]).toEqual(clientHelloMessageToBuffer({
            type: V3MessageType.CLIENT_HELLO,
            clientIdent: "foo",
            protocolMajor: 3,
            protocolMinor: 0
        }));

        // Get rid of the existing buffer
        serverBuffers.shift();

        const waitForServerHello = new Promise<void>(resolve => {
            console.log("Setting up event listener");
            const handler = (oldState: V3ClientHandshakeState, newState: V3ClientHandshakeState) => {
                if (newState === V3ClientHandshakeState.V3HS_AWAIT_SERVER_ENTRIES) {
                    handshakeManager.off("stateChange", handler);
                    resolve();
                }
            }

            handshakeManager.on("stateChange", handler);
        });

        let serverHelloMsg: V3ServerHelloMessage = {
            type: V3MessageType.SERVER_HELLO,
            serverIdentity: "foo-server",
            clientPreviouslySeen: false
        };
        handshakeManager.handleMessage(serverHelloMsg);

        await waitForServerHello;

        const entryAssignmentMsg1: V3EntryAssignmentMessage = {
            type: V3MessageType.ENTRY_ASSIGNMENT,
            entryName: "/my/awesome/boolean field",
            entryId: 1234,
            entrySeq: 1,
            entryFlags: { persistent: false },
            entryType: V3EntryType.BOOLEAN,
            entryValue: {
                bool: true
            }
        };
        handshakeManager.handleMessage(entryAssignmentMsg1);

        const entryAssignmentMsg2: V3EntryAssignmentMessage = {
            type: V3MessageType.ENTRY_ASSIGNMENT,
            entryName: "/my/awesome/double array field",
            entryId: 1234,
            entrySeq: 1,
            entryFlags: { persistent: false },
            entryType: V3EntryType.DOUBLE_ARRAY,
            entryValue: {
                double_array: [1, 2, 3.14, 4.89]
            }
        };
        handshakeManager.handleMessage(entryAssignmentMsg2);

        // Set up the wait for SERVER HELLO COMPLETE
        const waitForServerHelloComplete = new Promise<void>(resolve => {
            const handler = (oldState: V3ClientHandshakeState, newState: V3ClientHandshakeState) => {
                if (newState === V3ClientHandshakeState.V3HS_COMPLETE) {
                    handshakeManager.off("stateChange", handler);
                    resolve();
                }
            }

            handshakeManager.on("stateChange", handler);
        });

        const serverHelloCompleteMsg: V3ServerHelloCompleteMessage = {
            type: V3MessageType.SERVER_HELLO_COMPLETE
        };

        handshakeManager.handleMessage(serverHelloCompleteMsg);

        await waitForServerHelloComplete;

        done();
    });
});
