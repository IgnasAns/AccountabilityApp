import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Goal, GoalCompletion, GoalWithCompletions, GoalStatus, GoalCategory, Profile } from '../types/database';
import { DEFAULT_PAGE_SIZE } from '../constants';
import { sanitizeName, sanitizeText, sanitizeNumber } from '../utils/sanitize';
import { maybeRequestReview } from '../services/reviewPrompt';

// Streak milestones worth celebrating. Mirrors the server's streak_achieved
// activity event thresholds (7/30/100/365), minus 365 which the app never
// shows (a year-long streak needs no nudge).
const STREAK_MILESTONES = [7, 30, 100] as const;

/**
 * Overdue processing is a group-level concern, but useGoals is instantiated
 * per screen section (GroupDetailScreen + GoalsSection both mount it for the
 * same group). These module-level sets make sure the RPC runs once per app
 * session per group and that the "N missed deadlines" alert fires at most
 * once — regardless of how many instances mount or in what order their
 * effects run.
 */
const overdueProcessedGroups = new Set<string>();
const autoFailureNotifiedGroups = new Set<string>();

export interface AutoFailureInfo {
    count: number;
    totalPenalty: number;
}

export interface CompletionResult {
    data: GoalCompletion;
    /** Set when this completion pushed the streak to a 7/30/100 milestone. */
    milestone: { days: number; goalName: string } | null;
}

export function useGoals(groupId: string) {
    const { user } = useAuth();
    const [goals, setGoals] = useState<GoalWithCompletions[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [autoFailures, setAutoFailures] = useState<AutoFailureInfo | null>(null);
    // Current goal ids for this group — kept in a ref so realtime handlers can
    // check membership without re-subscribing on every fetch.
    const goalIdsRef = useRef<string[]>([]);

    // Process overdue goals (auto-failure at midnight check)
    const processOverdueGoals = useCallback(async (): Promise<AutoFailureInfo | null> => {
        if (!user || !groupId) return null;

        try {
            const { data, error: rpcError } = await supabase.rpc('process_overdue_goals', {
                p_group_id: groupId,
            });

            if (rpcError) {
                // Function might not exist yet - that's OK, just skip
                return null;
            }

            if (data?.failures_processed > 0) {
                const info: AutoFailureInfo = {
                    count: data.failures_processed,
                    totalPenalty: data.total_penalty || 0,
                };

                // Report once per session even if several useGoals instances
                // race to process the same group.
                if (!autoFailureNotifiedGroups.has(groupId)) {
                    autoFailureNotifiedGroups.add(groupId);
                    setAutoFailures(info);
                }
                return info;
            }
        } catch (err) {
            // Silently fail - this is a background operation
        }
        return null;
    }, [user, groupId]);

    /**
     * Fetch goals for this group. Returns the merged rows so callers can
     * inspect post-fetch state (e.g. streak milestones). Pass `{ silent: true }`
     * for background refreshes (realtime, pull-to-refresh) to avoid flashing
     * the loading spinner.
     */
    const fetchGoals = useCallback(async (opts?: { silent?: boolean }): Promise<GoalWithCompletions[] | undefined> => {
        if (!user || !groupId) return undefined;

        try {
            if (!opts?.silent) {
                setLoading(true);
            }
            setError(null);

            // First, process any overdue goals (only once per session per group)
            if (!overdueProcessedGroups.has(groupId)) {
                overdueProcessedGroups.add(groupId);
                await processOverdueGoals();
            }

            // Fetch goals for the group
            const { data: goalsData, error: goalsError } = await supabase
                .from('goals')
                .select(`
                    *,
                    creator:profiles!goals_created_by_fkey(*)
                `)
                .eq('group_id', groupId)
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (goalsError) throw goalsError;

            // Fetch completions for all goals
            const goalIds = (goalsData || []).map((g: { id: string }) => g.id);

            let completionsData: GoalCompletion[] = [];
            if (goalIds.length > 0) {
                const { data: completions, error: completionsError } = await supabase
                    .from('goal_completions')
                    .select('*')
                    .in('goal_id', goalIds)
                    .order('completed_at', { ascending: false })
                    .limit(DEFAULT_PAGE_SIZE);

                if (completionsError) throw completionsError;
                completionsData = completions || [];
            }

            // Merge completions into goals
            const goalsWithCompletions: GoalWithCompletions[] = (goalsData || []).map((goal: Goal & { creator?: Profile }) => ({
                ...goal,
                completions: completionsData.filter(c => c.goal_id === goal.id),
            }));

            goalIdsRef.current = goalIds;
            setGoals(goalsWithCompletions);
            return goalsWithCompletions;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load goals');
            return undefined;
        } finally {
            if (!opts?.silent) {
                setLoading(false);
            }
        }
    }, [user, groupId, processOverdueGoals]);

    useEffect(() => {
        fetchGoals();
    }, [fetchGoals]);

    // Realtime: mirror the useMessages postgres_changes pattern so goals and
    // completions stay fresh when a mate acts while the screen is open.
    // The goals table is filtered to the user's groups (group_id=in.(...));
    // goal_completions has no group_id column, so it is filtered by this
    // group's goal ids instead (and the handler double-checks membership).
    const goalIdsKey = goals.map(g => g.id).sort().join(',');

    useEffect(() => {
        if (!user || !groupId) return;

        let cancelled = false;
        let channel: RealtimeChannel | null = null;

        const setupRealtime = async () => {
            // Group ids for the user's memberships — the in.(...) filter.
            const { data: memberships } = await supabase
                .from('group_members')
                .select('group_id')
                .eq('user_id', user.id);

            if (cancelled) return;
            const groupIds = (memberships || []).map((m: { group_id: string }) => m.group_id);
            if (groupIds.length === 0) return;

            // Rebuild the completion filter whenever this group's goal ids
            // change so brand-new goals are covered by the subscription.
            const { data: goalRows } = await supabase
                .from('goals')
                .select('id')
                .eq('group_id', groupId)
                .eq('is_active', true);

            if (cancelled) return;
            const goalIds = (goalRows || []).map((g: { id: string }) => g.id);
            const completionFilter = goalIds.length > 0 ? `goal_id=in.(${goalIds.join(',')})` : undefined;

            const newChannel = supabase
                .channel(`goals-realtime:${groupId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'goals',
                        filter: `group_id=in.(${groupIds.join(',')})`,
                    },
                    (payload) => {
                        const eventGroupId =
                            (payload.new as Record<string, unknown> | undefined)?.group_id ??
                            (payload.old as Record<string, unknown> | undefined)?.group_id;
                        if (eventGroupId === groupId) {
                            fetchGoals({ silent: true });
                        }
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'goal_completions',
                        filter: completionFilter,
                    },
                    (payload) => {
                        const eventGoalId =
                            (payload.new as Record<string, unknown> | undefined)?.goal_id ??
                            (payload.old as Record<string, unknown> | undefined)?.goal_id;
                        if (eventGoalId && goalIdsRef.current.includes(eventGoalId as string)) {
                            fetchGoals({ silent: true });
                        }
                    }
                )
                .subscribe();

            if (cancelled) {
                supabase.removeChannel(newChannel);
                return;
            }
            channel = newChannel;
        };

        setupRealtime();

        return () => {
            cancelled = true;
            if (channel) {
                supabase.removeChannel(channel);
                channel = null;
            }
        };
    }, [user, groupId, fetchGoals, goalIdsKey]);

    // Create a new goal with enhanced options
    interface CreateGoalOptions {
        name: string;
        emoji: string;
        frequencyDays: number;
        penaltyAmount: number;
        description?: string;
        goalType?: 'frequency' | 'daily' | 'weekly';
        goalMode?: 'positive' | 'negative';
        targetPerWeek?: number | null;
        category?: GoalCategory;
        tags?: string[];
        requiresProof?: boolean;
        penaltyEscalationEnabled?: boolean;
        penaltyEscalationRate?: number;
    }

    async function createGoal(options: CreateGoalOptions) {
        if (!user) throw new Error('Not authenticated');

        const {
            name,
            emoji,
            frequencyDays,
            penaltyAmount,
            description,
            goalType = 'frequency',
            goalMode = 'positive',
            targetPerWeek = null,
            category = 'custom',
            tags = [],
            requiresProof = false,
            penaltyEscalationEnabled = false,
            penaltyEscalationRate = 1.5,
        } = options;

        const { data, error: createError } = await supabase
            .from('goals')
            .insert({
                group_id: groupId,
                name: sanitizeName(name, 100),
                emoji,
                description: description ? sanitizeText(description, 1000) : description,
                goal_type: goalType,
                goal_mode: goalMode,
                frequency_days: frequencyDays,
                target_per_week: targetPerWeek,
                penalty_amount: sanitizeNumber(penaltyAmount, 0, 100000, 0),
                created_by: user.id,
                category,
                tags: (tags || []).slice(0, 20).map((t) => sanitizeText(t, 50)),
                requires_proof: requiresProof,
                penalty_escalation_enabled: penaltyEscalationEnabled,
                penalty_escalation_rate: sanitizeNumber(penaltyEscalationRate, 1, 10, 1.5),
            })
            .select()
            .single();

        if (createError) throw createError;

        await fetchGoals();
        return data;
    }

    // Log a goal completion
    async function logCompletion(goalId: string, proofPhotoUrl?: string, notes?: string): Promise<CompletionResult> {
        if (!user) throw new Error('Not authenticated');

        const previousGoal = goals.find(g => g.id === goalId);
        const previousStreak = previousGoal?.current_streak || 0;

        const { data, error: insertError } = await supabase
            .from('goal_completions')
            .insert({
                goal_id: goalId,
                user_id: user.id,
                proof_photo_url: proofPhotoUrl || null,
                notes: notes || null,
            })
            .select()
            .single();

        if (insertError) throw insertError;

        const freshGoals = await fetchGoals();
        const updatedGoal = freshGoals?.find(g => g.id === goalId);
        const newStreak = updatedGoal?.current_streak || 0;

        // Completing a goal is the one moment the user is reliably pleased with
        // the app, which is the only time worth spending a review prompt on.
        // Fire-and-forget: this must never delay or fail the completion.
        void promptForReviewAfterWin(goalId);

        // Celebrate milestone streaks (7/30/100) exactly when the user's own
        // completion crosses the threshold — the server logs the matching
        // 'streak_achieved' activity event, so this is one-time per milestone.
        const milestone = STREAK_MILESTONES.find(
            (m) => newStreak >= m && previousStreak < m
        );

        return {
            data,
            milestone: milestone
                ? { days: milestone, goalName: updatedGoal?.name || previousGoal?.name || 'your goal' }
                : null,
        };
    }

    /**
     * Decide whether this completion is a good moment to ask for a review.
     * Errors are swallowed — the prompt is a nice-to-have, the completion is not.
     */
    async function promptForReviewAfterWin(goalId: string) {
        if (!user) return;

        try {
            const { count, error: countError } = await supabase
                .from('goal_completions')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id);

            if (countError || count === null) return;

            const goal = goals.find(g => g.id === goalId);

            await maybeRequestReview({
                totalCompletions: count,
                streak: goal?.current_streak ?? undefined,
            });
        } catch {
            // Ignore — never let review logic affect goal tracking.
        }
    }

    // Delete a completion (undo)
    async function deleteCompletion(completionId: string) {
        if (!user) throw new Error('Not authenticated');

        const { error: deleteError } = await supabase
            .from('goal_completions')
            .delete()
            .eq('id', completionId)
            .eq('user_id', user.id);

        if (deleteError) throw deleteError;

        await fetchGoals();
    }

    // Delete a goal
    async function deleteGoal(goalId: string) {
        if (!user) throw new Error('Not authenticated');

        const { error: deleteError } = await supabase
            .from('goals')
            .delete()
            .eq('id', goalId)
            .eq('created_by', user.id);

        if (deleteError) throw deleteError;

        await fetchGoals();
    }

    // Calculate goal status for current user
    function getGoalStatus(goal: GoalWithCompletions): GoalStatus {
        const userCompletions = goal.completions.filter(c => c.user_id === user?.id);
        const lastCompletion = userCompletions[0] || null;

        let nextDeadline: Date;
        if (lastCompletion) {
            nextDeadline = new Date(lastCompletion.completed_at);
            nextDeadline.setDate(nextDeadline.getDate() + goal.frequency_days);
        } else {
            // If no completion, deadline is from now (grace period of frequency_days)
            nextDeadline = new Date();
            nextDeadline.setDate(nextDeadline.getDate() + goal.frequency_days);
        }

        const now = new Date();
        const isOverdue = nextDeadline < now;
        const rawDaysRemaining = Math.ceil((nextDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const daysRemaining = lastCompletion
            ? Math.min(goal.frequency_days, rawDaysRemaining)
            : rawDaysRemaining;

        // Paused goals are exempt from auto-failure pressure: a pause with an
        // elapsed end date is no longer a pause. Note: the server-side
        // process_overdue_goals RPC does not yet honour is_paused, so a pause
        // protects the UI state (no "overdue" warnings) — see the wave-1 report.
        const isPaused = goal.is_paused && (!goal.paused_until || new Date(goal.paused_until) > now);

        return {
            goal_id: goal.id,
            user_id: user?.id || '',
            last_completion: lastCompletion?.completed_at || null,
            next_deadline: nextDeadline.toISOString(),
            is_overdue: isPaused ? false : isOverdue,
            days_remaining: isPaused ? Math.max(1, daysRemaining) : daysRemaining,
            total_completions: userCompletions.length,
        };
    }

    // Get completions for a specific date
    function getCompletionsForDate(date: Date): GoalCompletion[] {
        const dateStr = date.toISOString().split('T')[0];
        return goals.flatMap(g =>
            g.completions.filter(c =>
                c.completed_at.split('T')[0] === dateStr
            )
        );
    }

    // Log a negative occurrence (for habit-breaking goals)
    async function logNegativeOccurrence(goalId: string, count: number = 1) {
        if (!user) throw new Error('Not authenticated');

        const { data, error: rpcError } = await supabase.rpc('log_negative_occurrence', {
            p_goal_id: goalId,
            p_count: count,
        });

        if (rpcError) {
            // Only fall back to a direct insert when the RPC itself is missing.
            // Any other error (including a post-RPC fetchGoals failure) must NOT
            // trigger a second insert — that would double-count the occurrence.
            if (rpcError.message.includes('does not exist')) {
                const { error: insertError } = await supabase
                    .from('goal_completions')
                    .insert({
                        goal_id: goalId,
                        user_id: user.id,
                        occurrence_count: count,
                    });
                if (insertError) throw insertError;
            } else {
                throw rpcError;
            }
        }

        await fetchGoals();
        return data;
    }

    // Get daily counts for the last 7 days (for graphs)
    function getLast7DaysStats(goal: GoalWithCompletions): { date: string; count: number }[] {
        const result: { date: string; count: number }[] = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            const dayCompletions = goal.completions
                .filter(c => c.user_id === user?.id && c.completed_at.split('T')[0] === dateStr);

            const count = dayCompletions.reduce((sum, c) => sum + (c.occurrence_count || 1), 0);
            result.push({ date: dateStr, count });
        }

        return result;
    }

    // Pause/unpause a goal
    async function toggleGoalPause(goalId: string, pause: boolean, pauseUntil?: Date): Promise<boolean> {
        if (!user) throw new Error('Not authenticated');

        try {
            // Try RPC first
            const { data, error: rpcError } = await supabase.rpc('toggle_goal_pause', {
                p_goal_id: goalId,
                p_pause: pause,
                p_until: pauseUntil?.toISOString() || null,
            });

            if (rpcError) {
                // Function might not exist - update directly
                if (rpcError.message.includes('does not exist')) {
                    const { error: updateError } = await supabase
                        .from('goals')
                        .update({
                            is_paused: pause,
                            paused_at: pause ? new Date().toISOString() : null,
                            paused_until: pause && pauseUntil ? pauseUntil.toISOString() : null,
                        })
                        .eq('id', goalId)
                        .eq('created_by', user.id);

                    if (updateError) throw updateError;
                } else {
                    throw rpcError;
                }
            }

            await fetchGoals({ silent: true });
            return true;
        } catch {
            return false;
        }
    }

    // Update a goal
    async function updateGoal(goalId: string, updates: Partial<{
        name: string;
        description: string;
        emoji: string;
        penalty_amount: number;
        frequency_days: number;
        target_per_week: number | null;
        category: GoalCategory;
        tags: string[];
        requires_proof: boolean;
        penalty_escalation_enabled: boolean;
        penalty_escalation_rate: number;
    }>): Promise<boolean> {
        if (!user) throw new Error('Not authenticated');

        try {
            const { error: updateError } = await supabase
                .from('goals')
                .update(updates)
                .eq('id', goalId)
                .eq('created_by', user.id);

            if (updateError) throw updateError;

            await fetchGoals();
            return true;
        } catch {
            return false;
        }
    }

    // Get streak info for a goal
    function getStreakInfo(goal: GoalWithCompletions): { current: number; longest: number; isActive: boolean } {
        return {
            current: goal.current_streak || 0,
            longest: goal.longest_streak || 0,
            isActive: !goal.is_paused && goal.is_active,
        };
    }

    // Check if goal requires proof
    function requiresProof(goal: GoalWithCompletions): boolean {
        return goal.requires_proof || false;
    }

    // Calculate effective penalty (with escalation)
    function getEffectivePenalty(goal: GoalWithCompletions): number {
        if (!goal.penalty_escalation_enabled) {
            return goal.penalty_amount;
        }
        const multiplier = Math.pow(goal.penalty_escalation_rate || 1.5, goal.consecutive_failures || 0);
        return Math.min(goal.penalty_amount * multiplier, goal.penalty_amount * 10); // Cap at 10x
    }

    // Get goals by category
    function getGoalsByCategory(category: GoalCategory): GoalWithCompletions[] {
        return goals.filter(g => g.category === category);
    }

    // Get active (non-paused) goals
    function getActiveGoals(): GoalWithCompletions[] {
        return goals.filter(g => !g.is_paused && g.is_active);
    }

    // Get paused goals
    function getPausedGoals(): GoalWithCompletions[] {
        return goals.filter(g => g.is_paused);
    }

    const clearAutoFailures = useCallback(() => {
        setAutoFailures(null);
    }, []);

    return {
        goals,
        loading,
        error,
        autoFailures,
        clearAutoFailures,
        createGoal,
        updateGoal,
        logCompletion,
        logNegativeOccurrence,
        deleteCompletion,
        deleteGoal,
        toggleGoalPause,
        getGoalStatus,
        getCompletionsForDate,
        getLast7DaysStats,
        getStreakInfo,
        requiresProof,
        getEffectivePenalty,
        getGoalsByCategory,
        getActiveGoals,
        getPausedGoals,
        refetch: fetchGoals,
    };
}
