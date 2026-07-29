"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_js_1 = require("./server.js");
async function start() {
    const PORT = Number(process.env.RELAY_PORT) || 3001;
    const server = await (0, server_js_1.createRelayServer)();
    try {
        const address = await server.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`[Kumon SISO Parent Ack Relay] Running on ${address}`);
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
}
start();
