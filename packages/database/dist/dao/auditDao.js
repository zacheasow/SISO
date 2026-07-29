"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditDao = void 0;
const node_crypto_1 = require("node:crypto");
class AuditDao {
    db;
    constructor(db) {
        this.db = db;
    }
    async log(action, actorDeviceId, details) {
        const id = (0, node_crypto_1.randomUUID)();
        const detailsStr = details ? JSON.stringify(details) : null;
        await this.db.run('INSERT INTO audit_log (id, action, actor_device_id, details) VALUES (?, ?, ?, ?)', [id, action, actorDeviceId || null, detailsStr]);
    }
    async getRecentLogs(limit = 200) {
        return this.db.all('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?', [limit]);
    }
}
exports.AuditDao = AuditDao;
