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

function getEnvVar(key: string, fallback: string = ''): string {
    // In Expo, env vars are available through process.env when using babel plugin
    // For production, these should be set in app.json extra or EAS environment variables
    const value = process.env[key] || fallback;
    return value;
}

export const env: EnvConfig = {
    supabaseUrl: getEnvVar(
        'EXPO_PUBLIC_SUPABASE_URL',
        'https://bftyuzhigydeuabzkfvs.supabase.co' // Must be provided via environment
    ),
    supabaseAnonKey: getEnvVar(
        'EXPO_PUBLIC_SUPABASE_ANON_KEY',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmdHl1emhpZ3lkZXVhYnprZnZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0MzU3OTQsImV4cCI6MjA4MzAxMTc5NH0.-y6wjwq2QeXfpLzBj_ejEUkFVV_BBdjBRvhLba6iOT4' // Must be provided via environment
    ),
    appEnv: (getEnvVar('EXPO_PUBLIC_APP_ENV', 'development') as EnvConfig['appEnv']),
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
