import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase project credentials
// Replace these with your actual Supabase project credentials
// Fallback to hardcoded values if env vars fail to load (Debugging fallback)
const HARDCODED_URL = 'https://bftyuzhigydeuabzkfvs.supabase.co'; // Inferred from logs
const HARDCODED_KEY = 'sb_publishable__rEZKiEg8XNctM5xW'; // Inferred from logs

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || HARDCODED_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || HARDCODED_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('CRITICAL: Supabase credentials are still missing.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
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
export async function logFailure(groupId: string, description?: string): Promise<LogFailureResult | null> {
    const { data, error } = await supabase.rpc('log_failure', {
        p_group_id: groupId,
        p_description: description ?? null,
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
