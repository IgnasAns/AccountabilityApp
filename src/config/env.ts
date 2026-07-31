/**
 * Environment Configuration
 * All sensitive configuration is loaded from environment variables.
 * NEVER commit actual credentials to source control.
 */

import { Platform } from 'react-native';

// For Expo, environment variables are accessed via Constants.expoConfig.extra
// or process.env when using react-native-dotenv
// This module provides typed access with fallbacks for development

interface EnvConfig {
    supabaseUrl: string;
    supabaseAnonKey: string;
    appEnv: 'development' | 'staging' | 'production';
    enableAnalytics: boolean;
    enableDebugLogs: boolean;
    apiTimeoutMs: number;
    maxImageSizeBytes: number;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
}

// Every EXPO_PUBLIC_* variable must be read as a *static* member expression.
// babel-preset-expo inlines `process.env.EXPO_PUBLIC_FOO` at build time; a
// computed lookup like `process.env[key]` is invisible to that transform and
// resolves to undefined in a release bundle. Listing them here keeps the rest of
// the module free to use string keys.
const RAW_ENV: Record<string, string | undefined> = {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
    EXPO_PUBLIC_ENABLE_ANALYTICS: process.env.EXPO_PUBLIC_ENABLE_ANALYTICS,
    EXPO_PUBLIC_ENABLE_DEBUG: process.env.EXPO_PUBLIC_ENABLE_DEBUG,
    EXPO_PUBLIC_API_TIMEOUT_MS: process.env.EXPO_PUBLIC_API_TIMEOUT_MS,
    EXPO_PUBLIC_MAX_IMAGE_SIZE: process.env.EXPO_PUBLIC_MAX_IMAGE_SIZE,
    EXPO_PUBLIC_RATE_LIMIT_WINDOW_MS: process.env.EXPO_PUBLIC_RATE_LIMIT_WINDOW_MS,
    EXPO_PUBLIC_RATE_LIMIT_MAX: process.env.EXPO_PUBLIC_RATE_LIMIT_MAX,
};

function getEnvVar(key: string, fallback: string = ''): string {
    return RAW_ENV[key] || fallback;
}

export const env: EnvConfig = {
    supabaseUrl: getEnvVar('EXPO_PUBLIC_SUPABASE_URL'),
    supabaseAnonKey: getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
    // Default off __DEV__, not a literal 'development'. .env does not set this,
    // so the old literal meant a release build reported itself as development
    // and skipped the startup guard in services/supabase.ts.
    appEnv: (getEnvVar('EXPO_PUBLIC_APP_ENV', __DEV__ ? 'development' : 'production') as EnvConfig['appEnv']),
    enableAnalytics: getEnvVar('EXPO_PUBLIC_ENABLE_ANALYTICS', 'false') === 'true',
    enableDebugLogs: getEnvVar('EXPO_PUBLIC_ENABLE_DEBUG', __DEV__ ? 'true' : 'false') === 'true',
    apiTimeoutMs: parseInt(getEnvVar('EXPO_PUBLIC_API_TIMEOUT_MS', '30000'), 10),
    maxImageSizeBytes: parseInt(getEnvVar('EXPO_PUBLIC_MAX_IMAGE_SIZE', '5242880'), 10), // 5MB
    rateLimitWindowMs: parseInt(getEnvVar('EXPO_PUBLIC_RATE_LIMIT_WINDOW_MS', '60000'), 10), // 1 minute
    rateLimitMaxRequests: parseInt(getEnvVar('EXPO_PUBLIC_RATE_LIMIT_MAX', '60'), 10), // 60 per minute
};

/**
 * Validate that all required environment variables are present.
 * Call this at app startup to fail fast if misconfigured.
 */
export function validateEnv(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!env.supabaseUrl) {
        errors.push('EXPO_PUBLIC_SUPABASE_URL is not set');
    }
    if (!env.supabaseAnonKey) {
        errors.push('EXPO_PUBLIC_SUPABASE_ANON_KEY is not set');
    }

    // Validate URL format
    if (env.supabaseUrl && !env.supabaseUrl.startsWith('https://')) {
        errors.push('EXPO_PUBLIC_SUPABASE_URL must start with https://');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Log environment status (debug only)
 */
export function logEnvStatus(): void {
    if (!env.enableDebugLogs) return;

    console.log('[Env] Configuration:', {
        appEnv: env.appEnv,
        supabaseConfigured: !!env.supabaseUrl && !!env.supabaseAnonKey,
        platform: Platform.OS,
        apiTimeout: env.apiTimeoutMs,
        rateLimit: `${env.rateLimitMaxRequests} req / ${env.rateLimitWindowMs}ms`,
    });
}
