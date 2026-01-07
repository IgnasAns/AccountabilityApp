/**
 * Input sanitization utilities for user-provided data.
 * Use these before sending data to the API.
 */

/**
 * Sanitize a text input by trimming whitespace and limiting length.
 * @param input - The raw user input
 * @param maxLength - Maximum allowed length (default: 500)
 * @returns Sanitized string
 */
export const sanitizeText = (input: string, maxLength: number = 500): string => {
    if (!input || typeof input !== 'string') return '';
    return input.trim().slice(0, maxLength);
};

/**
 * Sanitize a name field (stricter rules)
 * @param name - The raw name input  
 * @param maxLength - Maximum allowed length (default: 100)
 * @returns Sanitized name
 */
export const sanitizeName = (name: string, maxLength: number = 100): string => {
    if (!name || typeof name !== 'string') return '';
    // Remove excessive whitespace, trim, and limit length
    return name.replace(/\s+/g, ' ').trim().slice(0, maxLength);
};

/**
 * Sanitize an email address
 * @param email - The raw email input
 * @returns Sanitized email (lowercase, trimmed)
 */
export const sanitizeEmail = (email: string): string => {
    if (!email || typeof email !== 'string') return '';
    return email.trim().toLowerCase();
};

/**
 * Sanitize a URL input
 * @param url - The raw URL input
 * @returns Sanitized URL or empty string if invalid
 */
export const sanitizeUrl = (url: string): string => {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    // Basic URL validation
    if (trimmed && !trimmed.match(/^https?:\/\//i) && trimmed.length > 0) {
        return `https://${trimmed}`;
    }
    return trimmed;
};

/**
 * Sanitize a numeric input
 * @param value - The raw value (string or number)
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param defaultValue - Value to return if invalid
 * @returns Sanitized number
 */
export const sanitizeNumber = (
    value: string | number,
    min: number = 0,
    max: number = Number.MAX_SAFE_INTEGER,
    defaultValue: number = 0
): number => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return defaultValue;
    return Math.min(Math.max(num, min), max);
};

/**
 * Sanitize an invite code (uppercase, alphanumeric only)
 * @param code - The raw invite code
 * @returns Sanitized invite code
 */
export const sanitizeInviteCode = (code: string): string => {
    if (!code || typeof code !== 'string') return '';
    return code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
};
