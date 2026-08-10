import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';
import { track } from '../services/track';

/**
 * Public challenges — the cold-start growth mechanic. A solo user taps JOIN
 * on a challenge card in the Explore tab and is dropped into a SHARED group
 * for that challenge (other participants, leaderboard, streaks, penalties)
 * with no invites required. All writes go through the SECURITY DEFINER RPC
 * `join_public_challenge` so the shared group + membership + auto-goal are
 * created atomically and idempotently; reads go through the `get_challenge_stats`
 * RPC (catalog + live participant counts + caller join state in one call).
 */

export interface PublicChallenge {
    slug: string;
    name: string;
    emoji: string;
    description: string;
    goal_name: string;
    goal_emoji: string;
    penalty_amount: number;
    frequency_days: number;
    starts_at: string;
    ends_at: string;
    participant_cap: number;
    participant_count: number;
    joined: boolean;
    /** The caller's shared group for this challenge, when joined. */
    group_id: string | null;
}

export interface JoinChallengeResult {
    groupId: string;
    inviteCode: string;
}

interface JoinChallengeResponse {
    success: boolean;
    error?: string | null;
    group_id?: string;
    invite_code?: string;
}

export function usePublicChallenges() {
    const [challenges, setChallenges] = useState<PublicChallenge[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [joiningSlug, setJoiningSlug] = useState<string | null>(null);

    const fetchChallenges = useCallback(async (opts?: { silent?: boolean }): Promise<void> => {
        try {
            if (!opts?.silent) {
                setLoading(true);
            }
            setError(null);

            const { data, error: rpcError } = await supabase.rpc('get_challenge_stats');

            if (rpcError) throw rpcError;

            setChallenges((data as PublicChallenge[] | null) || []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load challenges');
        } finally {
            if (!opts?.silent) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchChallenges();
    }, [fetchChallenges]);

    /**
     * Join a public challenge. Idempotent server-side: joining twice returns
     * the same shared group. On success the caller is a member of the
     * challenge group and the auto-goal exists (or was already there).
     */
    const joinChallenge = useCallback(async (slug: string): Promise<JoinChallengeResult> => {
        setJoiningSlug(slug);
        try {
            const { data, error: rpcError } = await supabase.rpc('join_public_challenge', {
                p_challenge_slug: slug,
            });

            if (rpcError) throw rpcError;

            const result = data as JoinChallengeResponse | null;
            if (!result?.success) {
                throw new Error(result?.error || 'Failed to join challenge');
            }
            if (!result.group_id) {
                throw new Error('Failed to join challenge');
            }

            track('public_challenge_joined', { slug, group_id: result.group_id });

            await fetchChallenges({ silent: true });

            return {
                groupId: result.group_id,
                inviteCode: result.invite_code || '',
            };
        } finally {
            setJoiningSlug(null);
        }
    }, [fetchChallenges]);

    return {
        challenges,
        loading,
        error,
        joiningSlug,
        joinChallenge,
        refetch: fetchChallenges,
    };
}

export interface ChallengeTag {
    slug: string;
    name: string;
    emoji: string;
}

/**
 * Tells GroupDetail whether the current group is a public-challenge group the
 * caller joined. Queries the caller's OWN challenge_participants row (RLS
 * allows that) joined to the challenge catalog (readable by authenticated).
 * Used to render the small "Public challenge" tag on the group header.
 */
export function useChallengeMembership(groupId: string) {
    const { user } = useAuth();
    const [challenge, setChallenge] = useState<ChallengeTag | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchMembership = useCallback(async () => {
        if (!user || !groupId) {
            setLoading(false);
            return;
        }

        try {
            const { data, error: queryError } = await supabase
                .from('challenge_participants')
                .select('challenge:public_challenges(slug, name, emoji)')
                .eq('user_id', user.id)
                .eq('group_id', groupId)
                .maybeSingle();

            if (queryError) throw queryError;

            const row = data as { challenge: ChallengeTag | null } | null;
            setChallenge(row?.challenge ?? null);
        } catch {
            // Non-challenge groups are the common case — stay quiet.
            setChallenge(null);
        } finally {
            setLoading(false);
        }
    }, [user, groupId]);

    useEffect(() => {
        fetchMembership();
    }, [fetchMembership]);

    return {
        challenge,
        loading,
        refetch: fetchMembership,
    };
}
