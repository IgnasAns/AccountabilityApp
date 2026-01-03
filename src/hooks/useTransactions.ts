import { useEffect, useState, useCallback } from 'react';
import { supabase, logFailure, settleDebt } from '../services/supabase';
import { useAuth } from './useAuth';
import { Transaction, TransactionWithProfiles, Profile } from '../types/database';

export function useTransactions(groupId?: string) {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<TransactionWithProfiles[]>([]);
    const [pendingDebts, setPendingDebts] = useState<TransactionWithProfiles[]>([]);
    const [pendingCredits, setPendingCredits] = useState<TransactionWithProfiles[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTransactions = useCallback(async () => {
        if (!user) return;

        try {
            setLoading(true);
            setError(null);

            let query = supabase
                .from('transactions')
                .select(`
          *,
          from_user:profiles!transactions_from_user_id_fkey (*),
          to_user:profiles!transactions_to_user_id_fkey (*)
        `)
                .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
                .order('created_at', { ascending: false });

            if (groupId) {
                query = query.eq('group_id', groupId);
            }

            const { data, error: fetchError } = await query;

            if (fetchError) throw fetchError;

            const typedData = (data || []) as TransactionWithProfiles[];
            setTransactions(typedData);

            // Filter debts (user owes) and credits (user is owed)
            setPendingDebts(
                typedData.filter(
                    (t) => t.from_user_id === user.id && t.status === 'pending'
                )
            );
            setPendingCredits(
                typedData.filter(
                    (t) => t.to_user_id === user.id && t.status === 'pending'
                )
            );
        } catch (err: any) {
            setError(err.message);
            console.error('Error fetching transactions:', err);
        } finally {
            setLoading(false);
        }
    }, [user, groupId]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    async function handleLogFailure(targetGroupId: string, description?: string) {
        try {
            const result = await logFailure(targetGroupId, description);
            await fetchTransactions();
            return result;
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    }

    async function handleSettleDebt(transactionId: string) {
        try {
            const result = await settleDebt(transactionId);
            await fetchTransactions();
            return result;
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    }

    // Calculate balance summary with a specific user
    function getBalanceWithUser(otherUserId: string): number {
        if (!user) return 0;

        const userOwes = transactions
            .filter(
                (t) =>
                    t.from_user_id === user.id &&
                    t.to_user_id === otherUserId &&
                    t.status === 'pending'
            )
            .reduce((sum, t) => sum + t.amount, 0);

        const userIsOwed = transactions
            .filter(
                (t) =>
                    t.to_user_id === user.id &&
                    t.from_user_id === otherUserId &&
                    t.status === 'pending'
            )
            .reduce((sum, t) => sum + t.amount, 0);

        return userIsOwed - userOwes; // Positive = user is owed, Negative = user owes
    }

    return {
        transactions,
        pendingDebts,
        pendingCredits,
        loading,
        error,
        logFailure: handleLogFailure,
        settleDebt: handleSettleDebt,
        getBalanceWithUser,
        refetch: fetchTransactions,
    };
}
