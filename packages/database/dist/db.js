"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const schema_js_1 = require("./schema.js");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
class Database {
    db;
    constructor(dbPath) {
        const dir = node_path_1.default.dirname(dbPath);
        if (dir && dir !== '.' && !node_fs_1.default.existsSync(dir)) {
            node_fs_1.default.mkdirSync(dir, { recursive: true });
        }
        this.db = new sqlite3_1.default.Database(dbPath);
        this.db.serialize(() => {
            this.db.run('PRAGMA foreign_keys = ON;');
        });
    }
    async init() {
        return new Promise((resolve, reject) => {
            this.db.exec(schema_js_1.INITIAL_SCHEMA_SQL, (err) => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
    }
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err)
                    return reject(err);
                resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err)
                    return reject(err);
                resolve(row);
            });
        });
    }
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err)
                    return reject(err);
                resolve(rows);
            });
        });
    }
    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
    }
}
exports.Database = Database;
