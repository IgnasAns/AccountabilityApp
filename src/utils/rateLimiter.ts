/**
 * Client-Side Rate Limiter
 *
 * Prevents abuse by limiting the frequency of API calls.
 * This is a CLIENT-SIDE measure only - server-side rate limiting
 * should also be implemented via Supabase Edge Functions or database policies.
 *
 * Note: Client-side rate limiting can be bypassed by determined users.
 * It primarily protects against accidental rapid-fire requests and
 * provides a better UX by preventing spam.
 */

interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
}

interface RequestRecord {
    count: number;
    resetTime: number;
}

class RateLimiter {
    private limits: Map<string, RequestRecord> = new Map();
    private maxRequests: number;
    private windowMs: number;

    constructor(config: RateLimitConfig) {
        this.maxRequests = config.maxRequests;
        this.windowMs = config.windowMs;
    }

    /**
     * Check if a request can proceed under the given key.
     * Returns true if allowed, false if rate limited.
     */
    canProceed(key: string = 'default'): boolean {
        const now = Date.now();
        const record = this.limits.get(key);

        if (!record || now > record.resetTime) {
            // Start new window
            this.limits.set(key, {
                count: 1,
                resetTime: now + this.windowMs,
            });
            return true;
        }

        if (record.count >= this.maxRequests) {
            return false;
        }

        record.count++;
        return true;
    }

    /**
     * Get remaining requests in current window
     */
    getRemaining(key: string = 'default'): number {
        const now = Date.now();
        const record = this.limits.get(key);

        if (!record || now > record.resetTime) {
            return this.maxRequests;
        }

        return Math.max(0, this.maxRequests - record.count);
    }

    /**
     * Get time until rate limit resets (in ms)
     */
    getResetTime(key: string = 'default'): number {
        const now = Date.now();
        const record = this.limits.get(key);

        if (!record || now > record.resetTime) {
            return 0;
        }

        return record.resetTime - now;
    }

    /**
     * Reset rate limit for a key
     */
    reset(key: string = 'default'): void {
        this.limits.delete(key);
    }

    /**
     * Clear all rate limits
     */
    clearAll(): void {
        this.limits.clear();
    }
}

// Pre-configured rate limiters for different operations
// These are conservative limits to prevent abuse while allowing normal usage

/** Actions that modify financial data - very strict limits */
const financialLimiter = new RateLimiter({
    maxRequests: 10,
    windowMs: 60 * 1000, // 10 requests per minute
});

/** Message sending - moderate limits */
const messagingLimiter = new RateLimiter({
    maxRequests: 30,
    windowMs: 60 * 1000, // 30 messages per minute
});

/** General API calls - relaxed limits */
const generalLimiter = new RateLimiter({
    maxRequests: 60,
    windowMs: 60 * 1000, // 60 requests per minute
});

/** Auth-related operations - strict limits */
const authLimiter = new RateLimiter({
    maxRequests: 5,
    windowMs: 60 * 1000, // 5 auth attempts per minute
});

/** Image upload - strict limits */
const uploadLimiter = new RateLimiter({
    maxRequests: 10,
    windowMs: 60 * 1000, // 10 uploads per minute
});

export const rateLimiters = {
    logFailure: {
        canProceed: () => financialLimiter.canProceed('logFailure'),
        getRemaining: () => financialLimiter.getRemaining('logFailure'),
    },
    settleDebt: {
        canProceed: () => financialLimiter.canProceed('settleDebt'),
        getRemaining: () => financialLimiter.getRemaining('settleDebt'),
    },
    sendMessage: {
        canProceed: () => messagingLimiter.canProceed('sendMessage'),
        getRemaining: () => messagingLimiter.getRemaining('sendMessage'),
    },
    general: {
        canProceed: (key: string = 'general') => generalLimiter.canProceed(key),
        getRemaining: (key: string = 'general') => generalLimiter.getRemaining(key),
    },
    auth: {
        canProceed: () => authLimiter.canProceed('auth'),
        getRemaining: () => authLimiter.getRemaining('auth'),
    },
    upload: {
        canProceed: () => uploadLimiter.canProceed('upload'),
        getRemaining: () => uploadLimiter.getRemaining('upload'),
    },
};

/**
 * Create a custom rate limiter
 */
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
    return new RateLimiter(config);
}

/**
 * HOF to wrap an async function with rate limiting
 */
export function withRateLimit<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    limiter: RateLimiter,
    key: string = 'default'
): T {
    return (async (...args: unknown[]) => {
        if (!limiter.canProceed(key)) {
            const resetTime = limiter.getResetTime(key);
            const seconds = Math.ceil(resetTime / 1000);
            throw new Error(`Rate limit exceeded. Please wait ${seconds} seconds.`);
        }
        return fn(...args);
    }) as T;
}

export { RateLimiter };
export type { RateLimitConfig };
