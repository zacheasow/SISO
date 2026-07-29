/**
 * Normalizes a phone number to standard format (digits with optional leading +).
 * Strips whitespace, parentheses, dashes, and common formatting artifacts.
 */
export declare function normalizePhoneNumber(raw: string | null | undefined, defaultCountryCode?: string): string;
/**
 * Validates whether a phone number has at least 7-15 digits.
 */
export declare function isValidPhoneNumber(phone: string): boolean;
/**
 * Formats a phone number for UI display while masking privacy-sensitive digits.
 * Example: "+15551234567" -> "••• ••• 4567"
 */
export declare function maskPhoneNumber(phone: string | null | undefined): string;
