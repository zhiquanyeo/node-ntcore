import net, { Socket } from "net";
import RRSocket from "../transport/rr-socket";

describe("RRSocket", () => {
    it ("should not attempt to connect when setting address/port while disconnected", (done) => {
        const client: RRSocket = new RRSocket();

        client.on("close", () => {
            throw new Error("Should not have fired 'close' event");
        });

        client.address = "localhost";
        client.port = 8080;

        done();
    });

    it("should connect and disconnect cleanly", async (done) => {
        const events: string[] = [];

        let serverPeer: Socket;
        const server = net.createServer(socket => {
            serverPeer = socket;
            events.push("server-connect");
        });

        server.listen(2021);

        const client: RRSocket = new RRSocket({
            address: "localhost",
            port: 2021,
            ident: "test-1"
        });

        client.on("connected", () => {
            events.push("connected");

            // Once we're connected, disconnect
            client.disconnect();
        });

        client.on("data", () => {
            events.push("data");
        });

        client.on("close", () => {
            events.push("close");

            expect(events).toEqual(["server-connect", "connected",  "close"])
            server.close(() => {
                done();
            });
        });

        client.connect();

    });

    it ("should attempt reconnection if the server is unavailable", async (done) => {
        const events: string[] = [];

        const client: RRSocket = new RRSocket({
            address: "localhost",
            port: 2022,
            reconnectDelay: 1000,
            ident: "test-2"
        });

        client.on("connected", () => {
            events.push("connected");
        });

        client.on("close", () => {
            events.push("close");
        });

        client.on("reconnectAttempt", () => {
            events.push("reconnectAttempt");
        });

        client.connect();

        setTimeout(() => {
            client.disconnect();
            expect(events).toEqual(["reconnectAttempt", "reconnectAttempt", "reconnectAttempt"]);
            done();
        }, 3500);
    });

    it ("should attempt reconnection if the server closes the connection", async (done) => {
        const events: string[] = [];

        const client: RRSocket = new RRSocket({
            address: "localhost",
            port: 2023,
            ident: "test-3"
        });

        let numClients = 0;
        const server = net.createServer(socket => {
            events.push("server-connect");
            numClients++;

            if (numClients === 1) {
                // Disconnect the first socket
                socket.destroy();
            }
            else if (numClients === 2) {
                setTimeout(() => {
                    client.disconnect();
                }, 500);

            }
        });

        server.listen(2023);

        client.on("connected", () => {
            events.push("connected");
        });

        client.on("close", () => {
            events.push("close");
            if (numClients === 2) {

                expect(events).toEqual([
                    "server-connect",
                    "connected",
                    "close",
                    "reconnectAttempt",
                    "server-connect",
                    "connected",
                    "close"
                ]);

                server.close(() => {
                    done();
                });
            }
        });

        client.on("reconnectAttempt", () => {
            events.push("reconnectAttempt");
        });

        client.connect();
    });

    it ("should handle reconnects to different servers", async (done) => {
        const events: string[] = [];
        const buffers: Buffer[] = [];

        let numConnections = 0;

        const server1 = net.createServer(socket => {
            events.push("server1-connect");
            socket.write("abc");
        });

        const server2 = net.createServer(socket => {
            events.push("server2-connect");
            socket.write("def");
        })

        server1.listen(2024);
        server2.listen(2025);

        const client: RRSocket = new RRSocket({
            address: "localhost",
            port: 2024,
            ident: "test-4"
        });

        client.on("data", (data: Buffer) => {
            buffers.push(data);
        });

        client.on("connected", () => {
            numConnections++;

            if (numConnections === 1) {
                // Switch ports to the other server
                setTimeout(() => {
                    client.port = 2025;
                }, 500);
            }
            else if (numConnections === 2) {
                setTimeout(() => {
                    client.port = 2024;
                }, 500);
            }
            else if (numConnections === 3) {
                setTimeout(() => {
                    const result = Buffer.concat(buffers);
                    expect(result).toEqual(Buffer.from("abcdefabc"));
                    client.disconnect();
                    server1.close(() => {
                        server2.close(() => {
                            done();
                        });
                    });
                }, 500);

            }
        });

        client.connect();
    });

    it("should connect when a server eventually starts up", async (done) => {
        const client: RRSocket = new RRSocket({
            address: "localhost",
            port: 2026,
            reconnectDelay: 500,
            ident: "test-5"
        });

        const server = net.createServer();

        let reconnectCount = 0;

        client.on("connected", () => {
            client.disconnect();
            server.close(() => {
                expect(reconnectCount).toBeGreaterThan(2);
                done();
            });
        });

        client.on("reconnectAttempt", () => {
            reconnectCount++;
        })

        client.connect();

        setTimeout(() => {
            server.listen(2026);
        }, 3000);
    });
});
