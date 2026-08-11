import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';

/**
 * Premium entitlement state, read live from profiles.premium_until /
 * premium_plan (the server is the source of truth — the store is only the
 * payment rail). Call refresh() after a purchase or restore to pick up the
 * new entitlement immediately.
 */
export function usePremium() {
    const { user } = useAuth();
    const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
    const [plan, setPlan] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const loadPremium = useCallback(async () => {
        if (!user) {
            setPremiumUntil(null);
            setPlan(null);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('premium_until, premium_plan')
                .eq('id', user.id)
                .maybeSingle();

            if (error) {
                console.error('[Premium] Failed to load premium state:', error);
                return;
            }

            setPremiumUntil(data?.premium_until ?? null);
            setPlan(data?.premium_plan ?? null);
        } catch (err) {
            console.error('[Premium] Failed to load premium state:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        setLoading(true);
        loadPremium();
    }, [loadPremium]);

    const isPremium = premiumUntil !== null && new Date(premiumUntil).getTime() > Date.now();

    return {
        premiumUntil,
        plan,
        isPremium,
        loading,
        refresh: loadPremium,
    };
}
