"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const server_js_1 = require("./server.js");
const node_path_1 = __importDefault(require("node:path"));
async function start() {
    const PORT = Number(process.env.PORT) || 3000;
    const HOST = process.env.HOST || '0.0.0.0';
    // When launched as a Tauri sidecar, DATABASE_DIR points to the app's
    // persistent data directory (e.g. %APPDATA%/com.kumon-siso.desktop/).
    // Otherwise, fall back to the default ./data/ relative path.
    const databaseDir = process.env.DATABASE_DIR || './data';
    const dbPath = node_path_1.default.join(databaseDir, 'kumon_siso.sqlite');
    console.log(`[Kumon SISO] Database path: ${dbPath}`);
    console.log(`[Kumon SISO] Sidecar mode: ${process.env.DATABASE_DIR ? 'YES' : 'NO'}`);
    const { fastify } = await (0, server_js_1.createServer)(dbPath);
    try {
        const address = await fastify.listen({ port: PORT, host: HOST });
        console.log(`[Kumon SISO Local Server] Running on ${address}`);
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}
start();
