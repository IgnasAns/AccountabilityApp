import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { env, validateEnv } from '../config/env';
import { createRateLimiter, rateLimiters } from '../utils/rateLimiter';

// Validate environment at module load
const envValidation = validateEnv();
if (!envValidation.valid) {
    console.error('[Supabase] Environment validation failed:', envValidation.errors);
    // In development, show a clear error. In production, this should prevent app start.
    if (env.appEnv === 'production') {
        throw new Error(`Missing required environment variables: ${envValidation.errors.join(', ')}`);
    }
}

// Create Supabase client with secure configuration
export const supabase: SupabaseClient = createClient(
    env.supabaseUrl || 'https://placeholder.supabase.co', // Fallback prevents crash in dev
    env.supabaseAnonKey || 'placeholder-key',
    {
        auth: {
            storage: AsyncStorage,
            autoRefreshToken: true,     // Automatically refresh tokens before expiry
            persistSession: true,        // Persist session across app restarts
            detectSessionInUrl: false,   // Not needed for mobile
            flowType: 'pkce',           // Use PKCE flow for enhanced security
        },
        global: {
            headers: {
                'X-Client-Info': 'accountability-app',
            },
        },
        db: {
            schema: 'public',
        },
        realtime: {
            params: {
                eventsPerSecond: 10, // Limit realtime events to prevent abuse
            },
        },
    }
);

// Track auth state changes for token refresh
let authStateListener: { data: { subscription: { unsubscribe: () => void } } } | null = null;

/**
 * Initialize auth state listener for token refresh monitoring.
 * Call this once at app startup.
 */
export function initAuthListener(): void {
    if (authStateListener) return;

    authStateListener = supabase.auth.onAuthStateChange((event, session) => {
        if (!env.enableDebugLogs) {
            return;
        }

        if (event === 'TOKEN_REFRESHED') {
            console.log('[Auth] Token refreshed successfully');
        } else if (event === 'SIGNED_OUT') {
            console.log('[Auth] User signed out');
        } else if (event === 'USER_UPDATED') {
            console.log('[Auth] User data updated');
        }

        // Handle refresh token errors
        if (event === 'SIGNED_OUT' && session === null) {
            // Could be due to refresh token expiry
            // The app will redirect to login via the auth hook
        }
    });
}

/**
 * Clean up auth listener
 */
export function cleanupAuthListener(): void {
    if (authStateListener) {
        authStateListener.data.subscription.unsubscribe();
        authStateListener = null;
    }
}

/**
 * Wrapper to check if user is authenticated before making requests
 */
export async function ensureAuthenticated(): Promise<string> {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
        throw new Error('Authentication required. Please log in again.');
    }

    // Check if token is about to expire (within 5 minutes)
    const expiresAt = session.expires_at;
    if (expiresAt) {
        const expiryTime = expiresAt * 1000;
        const fiveMinutes = 5 * 60 * 1000;
        if (Date.now() + fiveMinutes > expiryTime) {
            // Attempt to refresh
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
                throw new Error('Session expired. Please log in again.');
            }
        }
    }

    return session.user.id;
}

// ============ Penalty & Transaction Functions ============

interface LogFailureResult {
    transactions_created: number;
    total_debt: number;
    failure_id: string;
}

/**
 * Log a failure for the authenticated user in a group.
 * Uses server-side RPC for secure penalty calculation.
 */
export async function logFailure(
    groupId: string,
    description?: string,
    proofPhotoUrl?: string
): Promise<LogFailureResult> {
    // Rate limit check
    if (!rateLimiters.logFailure.canProceed()) {
        throw new Error('Too many requests. Please wait a moment before trying again.');
    }

    const userId = await ensureAuthenticated();

    // Use server-side RPC function for secure penalty calculation
    const { data, error } = await supabase.rpc('log_failure', {
        p_group_id: groupId,
        p_description: description || null,
        p_proof_photo_url: proofPhotoUrl || null,
    });

    if (error) {
        // Fallback for when RPC doesn't exist - still validate on client
        if (error.message.includes('does not exist')) {
            return await logFailureFallback(groupId, description, proofPhotoUrl);
        }
        throw new Error(error.message);
    }

    return data as LogFailureResult;
}

/**
 * Fallback failure logging when RPC is not available.
 * WARNING: This should not be used in production. The server-side RPC must be set up.
 * Financial operations are always performed server-side via the RPC function.
 */
async function logFailureFallback(
    groupId: string,
    description?: string,
    proofPhotoUrl?: string
): Promise<LogFailureResult> {
    throw new Error('Server-side log_failure function is not configured. Please run the database setup SQL (full_setup.sql) in your Supabase dashboard.');
}

/**
 * Mark a transaction as settled.
 * Uses server-side RPC for secure settlement with proper authorization.
 * Only the creditor (to_user) can confirm payment received.
 */
export async function settleDebt(transactionId: string): Promise<void> {
    if (!rateLimiters.settleDebt.canProceed()) {
        throw new Error('Too many requests. Please wait a moment.');
    }

    await ensureAuthenticated();

    // Use server-side RPC for secure settlement
    const { data, error } = await supabase.rpc('settle_debt', {
        p_transaction_id: transactionId,
    });

    if (error) {
        throw new Error(error.message || 'Failed to settle debt');
    }

    if (data && typeof data === 'object' && 'success' in data && !data.success) {
        throw new Error((data as { error?: string }).error || 'Failed to settle debt');
    }
}

/**
 * Get the current user's net balance across all groups.
 */
export async function getNetBalance(): Promise<number> {
    const userId = await ensureAuthenticated();

    const { data, error } = await supabase
        .from('group_members')
        .select('current_balance')
        .eq('user_id', userId);

    if (error) throw new Error(error.message);

    return (data || []).reduce(
        (sum: number, member: { current_balance: number }) => sum + (member.current_balance || 0),
        0
    );
}

/**
 * Get user profile by ID (for displaying other users' info)
 */
export async function getUserProfile(userId: string) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) throw new Error(error.message);
    return data;
}

/**
 * Update current user's profile
 */
export async function updateProfile(updates: {
    name?: string;
    avatar_url?: string | null;
    payment_link?: string | null;
}) {
    await ensureAuthenticated();

    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', (await supabase.auth.getUser()).data.user?.id);

    if (error) throw new Error(error.message);
}
