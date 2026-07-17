import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';
import { Goal, GoalCompletion, GoalWithCompletions, GoalStatus, GoalCategory, Profile } from '../types/database';
import { DEFAULT_PAGE_SIZE } from '../constants';

export function useGoals(groupId: string) {
    const { user } = useAuth();
    const [goals, setGoals] = useState<GoalWithCompletions[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [overdueProcessed, setOverdueProcessed] = useState(false);

    // Process overdue goals (auto-failure at midnight check)
    const processOverdueGoals = useCallback(async () => {
        if (!user || !groupId) return;

        try {
            const { data, error: rpcError } = await supabase.rpc('process_overdue_goals', {
                p_group_id: groupId,
            });

            if (rpcError) {
                // Function might not exist yet - that's OK, just skip
                return;
            }

            if (data?.failures_processed > 0) {
                // Will trigger a refetch below
                return data;
            }
        } catch (err) {
            // Silently fail - this is a background operation
        }
        return null;
    }, [user, groupId]);

    const fetchGoals = useCallback(async () => {
        if (!user || !groupId) return;

        try {
            setLoading(true);
            setError(null);

            // First, process any overdue goals (only once per session)
            if (!overdueProcessed) {
                await processOverdueGoals();
                setOverdueProcessed(true);
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
            // Merge completions into goals
            const goalsWithCompletions: GoalWithCompletions[] = (goalsData || []).map((goal: Goal & { creator?: Profile }) => ({
                ...goal,
                completions: completionsData.filter(c => c.goal_id === goal.id),
            }));

            setGoals(goalsWithCompletions);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load goals');
        } finally {
            setLoading(false);
        }
    }, [user, groupId, overdueProcessed, processOverdueGoals]);

    useEffect(() => {
        fetchGoals();
    }, [fetchGoals]);

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
                name,
                emoji,
                description,
                goal_type: goalType,
                goal_mode: goalMode,
                frequency_days: frequencyDays,
                target_per_week: targetPerWeek,
                penalty_amount: penaltyAmount,
                created_by: user.id,
                category,
                tags,
                requires_proof: requiresProof,
                penalty_escalation_enabled: penaltyEscalationEnabled,
                penalty_escalation_rate: penaltyEscalationRate,
            })
            .select()
            .single();

        if (createError) throw createError;

        await fetchGoals();
        return data;
    }

    // Log a goal completion
    async function logCompletion(goalId: string, proofPhotoUrl?: string, notes?: string) {
        if (!user) throw new Error('Not authenticated');

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

        await fetchGoals();
        return data;
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

        return {
            goal_id: goal.id,
            user_id: user?.id || '',
            last_completion: lastCompletion?.completed_at || null,
            next_deadline: nextDeadline.toISOString(),
            is_overdue: isOverdue,
            days_remaining: daysRemaining,
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

        // Use RPC if available, otherwise direct insert
        try {
            const { data, error: rpcError } = await supabase.rpc('log_negative_occurrence', {
                p_goal_id: goalId,
                p_count: count,
            });

            if (rpcError) {
                // If function doesn't exist, fallback to direct insert
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
        } catch (err) {
            // Fallback to direct insert
            const { error: insertError } = await supabase
                .from('goal_completions')
                .insert({
                    goal_id: goalId,
                    user_id: user.id,
                    occurrence_count: count,
                });
            if (insertError) throw insertError;
            await fetchGoals();
        }
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

            await fetchGoals();
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

    return {
        goals,
        loading,
        error,
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
