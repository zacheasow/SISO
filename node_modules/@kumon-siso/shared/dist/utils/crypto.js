"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPin = hashPin;
exports.verifyPin = verifyPin;
exports.generateSecureToken = generateSecureToken;
exports.hashToken = hashToken;
const node_crypto_1 = require("node:crypto");
/**
 * Hash a PIN with SHA-256 and a salt for secure local PIN storage.
 */
function hashPin(pin, salt = 'kumon-siso-local-salt') {
    return (0, node_crypto_1.createHash)('sha256').update(`${salt}:${pin}`).digest('hex');
}
/**
 * Compare plain text PIN against stored hash.
 */
function verifyPin(pin, storedHash, salt = 'kumon-siso-local-salt') {
    return hashPin(pin, salt) === storedHash;
}
/**
 * Generate a cryptographically secure random token (e.g. for QR identifiers or parent session links).
 */
function generateSecureToken(length = 32) {
    return (0, node_crypto_1.randomBytes)(length).toString('hex');
}
/**
 * Hash a raw token string (e.g., parent link token) so raw tokens are never stored in DB.
 */
function hashToken(token) {
    return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
}
