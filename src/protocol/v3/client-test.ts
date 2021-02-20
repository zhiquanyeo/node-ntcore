import V3NTClient from "./v3-nt-client";

const clientV3: V3NTClient = new V3NTClient();

clientV3.on("connectionStateChanged", evt => {
    console.log("Connection State Changed: ", evt);
})


clientV3.start();

let val = true;
setInterval(() => {
    clientV3.setBoolean("/My/SuperCool/Variable", val);
    val = !val;
}, 1000);