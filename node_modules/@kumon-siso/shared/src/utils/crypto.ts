import { createHash, randomBytes } from 'node:crypto';

/**
 * Hash a PIN with SHA-256 and a salt for secure local PIN storage.
 */
export function hashPin(pin: string, salt = 'kumon-siso-local-salt'): string {
  return createHash('sha256').update(`${salt}:${pin}`).digest('hex');
}

/**
 * Compare plain text PIN against stored hash.
 */
export function verifyPin(pin: string, storedHash: string, salt = 'kumon-siso-local-salt'): boolean {
  return hashPin(pin, salt) === storedHash;
}

/**
 * Generate a cryptographically secure random token (e.g. for QR identifiers or parent session links).
 */
export function generateSecureToken(length = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Hash a raw token string (e.g., parent link token) so raw tokens are never stored in DB.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
