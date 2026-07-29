"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevOutboxAdapter = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
class DevOutboxAdapter {
    name = 'Development Local Outbox';
    outboxPath;
    constructor(outboxDir = './sms_outbox') {
        this.outboxPath = outboxDir;
        if (!node_fs_1.default.existsSync(this.outboxPath)) {
            node_fs_1.default.mkdirSync(this.outboxPath, { recursive: true });
        }
    }
    async sendSms(to, message) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `sms_${timestamp}_${Math.random().toString(36).substring(2, 7)}.json`;
        const filePath = node_path_1.default.join(this.outboxPath, filename);
        const payload = {
            timestamp: new Date().toISOString(),
            to,
            message,
        };
        node_fs_1.default.writeFileSync(filePath, JSON.stringify(payload, null, 2));
        return {
            success: true,
            messageId: filename,
        };
    }
}
exports.DevOutboxAdapter = DevOutboxAdapter;
