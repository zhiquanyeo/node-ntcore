import V3NTServer from "./v3-nt-server";

const serverV3: V3NTServer = new V3NTServer({
    port: 1735,
    identifier: "My Cool NT Server"
});

serverV3.start();

let val = false;
setInterval(() => {
    serverV3.setBoolean("/ZQ/Storage/Flag", val);
    val = !val;
}, 1000);
