"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhoneNumber = normalizePhoneNumber;
exports.isValidPhoneNumber = isValidPhoneNumber;
exports.maskPhoneNumber = maskPhoneNumber;
/**
 * Normalizes a phone number to standard format (digits with optional leading +).
 * Strips whitespace, parentheses, dashes, and common formatting artifacts.
 */
function normalizePhoneNumber(raw, defaultCountryCode = '1') {
    if (!raw)
        return '';
    let cleaned = raw.replace(/[^\d+]/g, '');
    if (!cleaned)
        return '';
    // Handle US style 10 digit numbers: add default country code if missing
    if (cleaned.length === 10 && !cleaned.startsWith('+')) {
        cleaned = `+${defaultCountryCode}${cleaned}`;
    }
    else if (cleaned.length === 11 && cleaned.startsWith('1')) {
        cleaned = `+${cleaned}`;
    }
    else if (!cleaned.startsWith('+') && cleaned.length > 0) {
        cleaned = `+${cleaned}`;
    }
    return cleaned;
}
/**
 * Validates whether a phone number has at least 7-15 digits.
 */
function isValidPhoneNumber(phone) {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
}
/**
 * Formats a phone number for UI display while masking privacy-sensitive digits.
 * Example: "+15551234567" -> "••• ••• 4567"
 */
function maskPhoneNumber(phone) {
    if (!phone)
        return 'N/A';
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 4) {
        return '•••• ' + digits;
    }
    const lastFour = digits.slice(-4);
    return `••• ••• ${lastFour}`;
}
