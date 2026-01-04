import { Platform } from 'react-native';
// Only load the polyfill on native platforms. On Web, the browser's native implementation is better.
if (Platform.OS !== 'web') {
    require('react-native-url-polyfill/auto');
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

// Supabase Project URL (public)
const supabaseUrl = 'https://bftyuzhigydeuabzkfvs.supabase.co';

// ------------------------------------------------------------------
// SUPABASE ANON KEY - SECURITY NOTE:
// This is the PUBLIC "anon" key, NOT a secret key.
// It is designed to be exposed in client-side apps.
// Security is enforced via Row Level Security (RLS) policies.
// See: https://supabase.com/docs/guides/database/postgres/row-level-security
// ------------------------------------------------------------------
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmdHl1emhpZ3lkZXVhYnprZnZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0MzU3OTQsImV4cCI6MjA4MzAxMTc5NH0.-y6wjwq2QeXfpLzBj_ejEUkFVV_BBdjBRvhLba6iOT4';

const supabaseAnonKey = SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
    console.warn('Supabase Anon Key is missing.');
}

// Default to a placeholder if key is missing to prevent crash
const safeKey = supabaseAnonKey || '';

// Custom storage wrapper for web that provides async-compatible interface
const webStorage = {
    getItem: (key: string): string | null => {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    },
    setItem: (key: string, value: string): void => {
        try {
            localStorage.setItem(key, value);
        } catch {
            // Ignore storage errors
        }
    },
    removeItem: (key: string): void => {
        try {
            localStorage.removeItem(key);
        } catch {
            // Ignore storage errors
        }
    },
};

// Use appropriate storage based on platform
const storage = Platform.OS === 'web' ? webStorage : AsyncStorage;

// Enable persistence only on native platforms (web has issues)
const isNative = Platform.OS !== 'web';

export const supabase = createClient(supabaseUrl, safeKey, {
    auth: {
        storage: storage as any,
        autoRefreshToken: isNative,  // Only on native
        persistSession: isNative,    // Only on native - web has hanging issues
        detectSessionInUrl: false,
    },
});

// RPC result types
interface LogFailureResult {
    success: boolean;
    transactions_created: number;
    total_debt: number;
}

interface JoinGroupResult {
    success: boolean;
    group_id?: string;
    error?: string;
}

// Helper function to call the log_failure RPC
export async function logFailure(
    groupId: string,
    description?: string,
    proofPhotoUrl?: string
): Promise<LogFailureResult | null> {
    const { data, error } = await supabase.rpc('log_failure', {
        p_group_id: groupId,
        p_description: description ?? null,
        p_proof_photo_url: proofPhotoUrl ?? null,
    });

    if (error) throw error;
    return data as LogFailureResult | null;
}

// Helper function to call the settle_debt RPC
export async function settleDebt(transactionId: string) {
    const { data, error } = await supabase.rpc('settle_debt', {
        p_transaction_id: transactionId,
    });

    if (error) throw error;
    return data;
}

// Helper function to get net balance
export async function getNetBalance(): Promise<number> {
    const { data, error } = await supabase.rpc('get_net_balance');

    if (error) throw error;
    return (data as number) || 0;
}

// Helper function to join group by invite code
export async function joinGroupByCode(inviteCode: string): Promise<JoinGroupResult> {
    const { data, error } = await supabase.rpc('join_group_by_code', {
        p_invite_code: inviteCode,
    });

    if (error) throw error;
    return data as JoinGroupResult;
}
