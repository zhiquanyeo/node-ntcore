import DSClient, { ServerIPAddressInfo } from "../networktables/ds-client"
import net from "net";

describe("DSClient", () => {
    it("should emit the correct stream of events", (done) => {
        const dsClient = new DSClient();

        const events: ServerIPAddressInfo[] = [];

        dsClient.on("ipChanged", addrInfo => {
            events.push(addrInfo);
        });

        const ipAddresses: string[] = [
            "192.168.1.1",
            "0.0.0.0",
            "127.0.0.1",
            "10.0.0.2"
        ];

        const expected: ServerIPAddressInfo[] = [];

        ipAddresses.forEach(ipAddr => {
            const strSplit = ipAddr.split(".");
            const ipNumArr: number[] = [];
            strSplit.forEach(part => {
                ipNumArr.push(Number.parseInt(part, 10));
            });

            const buf: Buffer = Buffer.from(ipNumArr);

            expected.push({
                asUInt32: buf.readUInt32BE(),
                asArray: ipNumArr,
                asString: ipAddr
            });
        })

        const server = net.createServer((socket) => {
            expected.forEach(info => {
                const obj = { robotIP: info.asUInt32 };
                socket.write(`${JSON.stringify(obj)}\n`);
            });

            setTimeout(() => {
                dsClient.stop();
                server.close(() => {
                    expect(events).toEqual(expected);
                    done();
                });
            }, 1000);
        });

        server.listen(1742);
        dsClient.start();
    })
})
