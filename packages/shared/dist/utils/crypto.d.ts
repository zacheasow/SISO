/**
 * Hash a PIN with SHA-256 and a salt for secure local PIN storage.
 */
export declare function hashPin(pin: string, salt?: string): string;
/**
 * Compare plain text PIN against stored hash.
 */
export declare function verifyPin(pin: string, storedHash: string, salt?: string): boolean;
/**
 * Generate a cryptographically secure random token (e.g. for QR identifiers or parent session links).
 */
export declare function generateSecureToken(length?: number): string;
/**
 * Hash a raw token string (e.g., parent link token) so raw tokens are never stored in DB.
 */
export declare function hashToken(token: string): string;
