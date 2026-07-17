/**
 * Input Sanitization Utilities
 *
 * All user-facing text inputs should be sanitized before:
 * 1. Storing in the database
 * 2. Displaying to other users
 *
 * These functions prevent XSS, injection attacks, and ensure data quality.
 */

/**
 * Strip HTML tags and potentially dangerous characters
 */
function stripHtml(input: string): string {
    return input
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, ''); // Remove event handlers
}

/**
 * Normalize whitespace (collapse multiple spaces, trim)
 */
function normalizeWhitespace(input: string): string {
    return input.replace(/\s+/g, ' ').trim();
}

/**
 * Remove control characters (except common ones like newlines/tabs)
 */
function removeControlChars(input: string): string {
    // eslint-disable-next-line no-control-regex
    return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Sanitize general text input (for chat messages, descriptions, comments)
 *
 * @param input - Raw user input
 * @param maxLength - Maximum allowed length (default: 1000)
 * @returns Sanitized string, or empty string if input is invalid
 */
export function sanitizeText(input: string | null | undefined, maxLength: number = 1000): string {
    if (!input || typeof input !== 'string') return '';

    let sanitized = input;
    sanitized = removeControlChars(sanitized);
    sanitized = stripHtml(sanitized);
    sanitized = normalizeWhitespace(sanitized);

    // Truncate to max length
    if (sanitized.length > maxLength) {
        sanitized = sanitized.slice(0, maxLength).trim();
    }

    return sanitized;
}

/**
 * Sanitize a name input (user names, group names)
 * More restrictive than general text - no special characters
 *
 * @param input - Raw name input
 * @param maxLength - Maximum allowed length (default: 50)
 * @returns Sanitized name, or empty string if invalid
 */
export function sanitizeName(input: string | null | undefined, maxLength: number = 50): string {
    if (!input || typeof input !== 'string') return '';

    let sanitized = input;
    sanitized = removeControlChars(sanitized);
    sanitized = stripHtml(sanitized);

    // Allow letters, numbers, spaces, and common punctuation
    sanitized = sanitized.replace(/[^\p{L}\p{N}\s\-_.,!?'"]/gu, '');

    // Collapse whitespace
    sanitized = normalizeWhitespace(sanitized);

    // Truncate
    if (sanitized.length > maxLength) {
        sanitized = sanitized.slice(0, maxLength).trim();
    }

    return sanitized;
}

/**
 * Sanitize invite code (alphanumeric only, uppercase)
 *
 * @param input - Raw invite code input
 * @returns Sanitized uppercase alphanumeric code
 */
export function sanitizeInviteCode(input: string | null | undefined): string {
    if (!input || typeof input !== 'string') return '';

    return input
        .replace(/[^A-Za-z0-9]/g, '') // Only alphanumeric
        .toUpperCase()
        .slice(0, 8); // Max 8 characters
}

/**
 * Sanitize and validate a number input
 *
 * @param input - Raw number input (string or number)
 * @param min - Minimum allowed value (inclusive)
 * @param max - Maximum allowed value (inclusive)
 * @param defaultValue - Default value if input is invalid
 * @returns Sanitized number
 */
export function sanitizeNumber(
    input: string | number | null | undefined,
    min: number = 0,
    max: number = Number.MAX_SAFE_INTEGER,
    defaultValue: number = 0
): number {
    if (input === null || input === undefined || input === '') {
        return defaultValue;
    }

    const num = typeof input === 'string' ? parseFloat(input) : input;

    if (isNaN(num) || !isFinite(num)) {
        return defaultValue;
    }

    // Clamp to range
    return Math.min(max, Math.max(min, num));
}

/**
 * Sanitize email input
 *
 * @param input - Raw email input
 * @returns Sanitized lowercase email, or empty string if invalid format
 */
export function sanitizeEmail(input: string | null | undefined): string {
    if (!input || typeof input !== 'string') return '';

    const sanitized = input.toLowerCase().trim();

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitized)) {
        return '';
    }

    // Length check
    if (sanitized.length > 254) {
        return '';
    }

    return sanitized;
}

/**
 * Sanitize URL input
 *
 * @param input - Raw URL input
 * @returns Sanitized URL, or empty string if invalid
 */
export function sanitizeUrl(input: string | null | undefined): string {
    if (!input || typeof input !== 'string') return '';

    let sanitized = input.trim();

    // Only allow http/https protocols
    if (sanitized && !sanitized.match(/^https?:\/\//)) {
        sanitized = 'https://' + sanitized;
    }

    try {
        const url = new URL(sanitized);
        // Only allow http/https
        if (!['http:', 'https:'].includes(url.protocol)) {
            return '';
        }
        const hostname = url.hostname.toLowerCase();
        const isLocalhost = hostname === 'localhost';
        const hasValidDomain = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(hostname);
        if (!isLocalhost && !hasValidDomain) {
            return '';
        }
        return url.toString();
    } catch {
        return '';
    }
}

/**
 * Sanitize search/query input
 * For use in search bars and filters
 *
 * @param input - Raw search input
 * @param maxLength - Maximum length (default: 100)
 * @returns Sanitized search query
 */
export function sanitizeSearchQuery(input: string | null | undefined, maxLength: number = 100): string {
    if (!input || typeof input !== 'string') return '';

    let sanitized = input;
    sanitized = removeControlChars(sanitized);
    sanitized = stripHtml(sanitized);

    // Don't collapse whitespace for search (users might search multi-word)
    sanitized = sanitized.trim();

    if (sanitized.length > maxLength) {
        sanitized = sanitized.slice(0, maxLength).trim();
    }

    return sanitized;
}

/**
 * Check if a string contains potentially harmful content
 * Used for additional validation beyond sanitization
 *
 * @param input - String to check
 * @returns Object with isSafe flag and reason if not safe
 */
export function checkContentSafety(input: string): { isSafe: boolean; reason?: string } {
    if (!input) return { isSafe: true };

    // Check for excessive length
    if (input.length > 5000) {
        return { isSafe: false, reason: 'Content exceeds maximum length' };
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
        /data:\s*text\/html/i,     // Data URLs with HTML
        /<script/i,                 // Script tags
        /javascript\s*:/i,         // JavaScript protocol
        /vbscript\s*:/i,           // VBScript protocol
        /on\w+\s*=\s*['"]/i,      // Event handler attributes
    ];

    for (const pattern of suspiciousPatterns) {
        if (pattern.test(input)) {
            return { isSafe: false, reason: 'Content contains disallowed patterns' };
        }
    }

    return { isSafe: true };
}

/**
 * Batch sanitize multiple fields of an object
 *
 * @param obj - Object with string fields
 * @param schema - Map of field names to their sanitization functions
 * @returns New object with sanitized fields
 */
export function sanitizeObject<T extends Record<string, unknown>>(
    obj: T,
    schema: Partial<Record<keyof T, (value: unknown) => unknown>>
): Partial<T> {
    const result: Partial<T> = {};

    for (const [key, sanitizer] of Object.entries(schema)) {
        if (key in obj && sanitizer) {
            (result as Record<string, unknown>)[key] = sanitizer(obj[key]);
        }
    }

    return result;
}

// Export sanitization presets for common use cases
export const sanitizers = {
    chatMessage: (input: string) => sanitizeText(input, 500),
    groupName: (input: string) => sanitizeName(input, 100),
    userName: (input: string) => sanitizeName(input, 50),
    goalName: (input: string) => sanitizeName(input, 100),
    description: (input: string) => sanitizeText(input, 500),
    comment: (input: string) => sanitizeText(input, 300),
    penalty: (input: string | number) => sanitizeNumber(input, 0.01, 10000, 1),
    inviteCode: (input: string) => sanitizeInviteCode(input),
    email: (input: string) => sanitizeEmail(input),
    paymentLink: (input: string) => sanitizeUrl(input),
};
