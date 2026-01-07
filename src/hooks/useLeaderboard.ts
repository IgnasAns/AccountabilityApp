import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';
import { LeaderboardEntry, UserBadge, BadgeType } from '../types/database';

export type LeaderboardPeriod = 'week' | 'month' | 'all';

export function useLeaderboard(groupId: string) {
    const { user } = useAuth();
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [badges, setBadges] = useState<UserBadge[]>([]);
    const [period, setPeriod] = useState<LeaderboardPeriod>('week');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLeaderboard = useCallback(async () => {
        if (!user || !groupId || user.id === 'guest_user_id') {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Try to use RPC function
            const { data, error: rpcError } = await supabase.rpc('get_group_leaderboard', {
                p_group_id: groupId,
                p_period: period,
            });

            if (rpcError) {
                // Function might not exist yet - calculate manually
                if (rpcError.message.includes('does not exist')) {
                    await calculateLeaderboardManually();
                    return;
                }
                throw rpcError;
            }

            setLeaderboard((data || []) as LeaderboardEntry[]);
        } catch (err: any) {
            setError(err.message);
            console.error('Error fetching leaderboard:', err);
        } finally {
            setLoading(false);
        }
    }, [user, groupId, period]);

    // Manual calculation fallback
    const calculateLeaderboardManually = async () => {
        try {
            // Get group members with profiles
            const { data: members } = await supabase
                .from('group_members')
                .select(`
                    *,
                    profile:profiles(*)
                `)
                .eq('group_id', groupId);

            if (!members) {
                setLeaderboard([]);
                return;
            }

            // Get goals for this group
            const { data: goals } = await supabase
                .from('goals')
                .select('id, current_streak')
                .eq('group_id', groupId);

            // Calculate period start date
            const now = new Date();
            let startDate: Date;
            switch (period) {
                case 'week':
                    startDate = new Date(now);
                    startDate.setDate(now.getDate() - now.getDay());
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                default:
                    startDate = new Date(0);
            }

            // Get completions in period
            const goalIds = (goals || []).map(g => g.id);
            let completionCounts: { [userId: string]: number } = {};

            if (goalIds.length > 0) {
                const { data: completions } = await supabase
                    .from('goal_completions')
                    .select('user_id')
                    .in('goal_id', goalIds)
                    .gte('completed_at', startDate.toISOString());

                (completions || []).forEach(c => {
                    completionCounts[c.user_id] = (completionCounts[c.user_id] || 0) + 1;
                });
            }

            // Build leaderboard
            const entries: LeaderboardEntry[] = members.map((member: any) => {
                const completions = completionCounts[member.user_id] || 0;
                const maxStreak = Math.max(0, ...(goals || []).map(g => g.current_streak || 0));
                const score = completions * 10 - member.failure_count * 5;

                return {
                    user_id: member.user_id,
                    user_name: member.profile?.name || 'Unknown',
                    avatar_url: member.profile?.avatar_url || null,
                    completions_count: completions,
                    streak_days: maxStreak,
                    failure_count: member.failure_count || 0,
                    score: score,
                };
            });

            // Sort by score
            entries.sort((a, b) => b.score - a.score);
            setLeaderboard(entries);
        } catch (err: any) {
            console.error('Manual leaderboard calculation error:', err);
            setLeaderboard([]);
        }
    };

    // Fetch badges
    const fetchBadges = useCallback(async () => {
        if (!user || !groupId || user.id === 'guest_user_id') return;

        try {
            const { data, error: fetchError } = await supabase
                .from('user_badges')
                .select('*')
                .eq('group_id', groupId)
                .order('earned_at', { ascending: false });

            if (fetchError) {
                // Table might not exist
                if (!fetchError.message.includes('does not exist')) {
                    console.error('Error fetching badges:', fetchError);
                }
                return;
            }

            setBadges((data || []) as UserBadge[]);
        } catch (err) {
            console.error('Error fetching badges:', err);
        }
    }, [user, groupId]);

    useEffect(() => {
        fetchLeaderboard();
        fetchBadges();
    }, [fetchLeaderboard, fetchBadges]);

    // Get badge display info
    const getBadgeInfo = (badgeType: BadgeType): { emoji: string; label: string; color: string } => {
        switch (badgeType) {
            case 'first_completion':
                return { emoji: '🌟', label: 'First Step', color: '#FFD700' };
            case 'week_streak':
                return { emoji: '🔥', label: '7-Day Streak', color: '#FF6B6B' };
            case 'month_streak':
                return { emoji: '💪', label: '30-Day Streak', color: '#8B5CF6' };
            case 'perfect_week':
                return { emoji: '⭐', label: 'Perfect Week', color: '#10B981' };
            case 'perfect_month':
                return { emoji: '🏆', label: 'Perfect Month', color: '#F59E0B' };
            case 'top_performer':
                return { emoji: '👑', label: 'Top Performer', color: '#EC4899' };
            case 'consistency_king':
                return { emoji: '📈', label: 'Consistency King', color: '#3B82F6' };
            case 'early_bird':
                return { emoji: '🌅', label: 'Early Bird', color: '#F97316' };
            case 'night_owl':
                return { emoji: '🦉', label: 'Night Owl', color: '#6366F1' };
            default:
                return { emoji: '🏅', label: 'Badge', color: '#9CA3AF' };
        }
    };

    // Get user's current rank
    const getUserRank = (): number | null => {
        if (!user) return null;
        const index = leaderboard.findIndex(e => e.user_id === user.id);
        return index >= 0 ? index + 1 : null;
    };

    // Get user's badges
    const getUserBadges = (userId?: string): UserBadge[] => {
        const targetId = userId || user?.id;
        if (!targetId) return [];
        return badges.filter(b => b.user_id === targetId);
    };

    return {
        leaderboard,
        badges,
        period,
        loading,
        error,
        setPeriod,
        refetch: fetchLeaderboard,
        getBadgeInfo,
        getUserRank,
        getUserBadges,
    };
}
