import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';
import { Goal, GoalCompletion, GoalWithCompletions, GoalStatus } from '../types/database';

export function useGoals(groupId: string) {
    const { user } = useAuth();
    const [goals, setGoals] = useState<GoalWithCompletions[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [overdueProcessed, setOverdueProcessed] = useState(false);

    // Process overdue goals (auto-failure at midnight check)
    const processOverdueGoals = useCallback(async () => {
        if (!user || !groupId || user.id === 'guest_user_id') return;

        try {
            const { data, error: rpcError } = await supabase.rpc('process_overdue_goals', {
                p_group_id: groupId,
            });

            if (rpcError) {
                // Function might not exist yet - that's OK, just skip
                if (!rpcError.message.includes('does not exist')) {
                    console.warn('Overdue processing error:', rpcError.message);
                }
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

        // Guest mode support
        if (user.id === 'guest_user_id') {
            setLoading(false);
            setGoals([]);
            return;
        }

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
            const goalIds = (goalsData || []).map((g: any) => g.id);

            let completionsData: GoalCompletion[] = [];
            if (goalIds.length > 0) {
                const { data: completions, error: completionsError } = await supabase
                    .from('goal_completions')
                    .select('*')
                    .in('goal_id', goalIds)
                    .order('completed_at', { ascending: false });

                if (completionsError) throw completionsError;
                completionsData = completions || [];
            }

            // Merge completions into goals
            const goalsWithCompletions: GoalWithCompletions[] = (goalsData || []).map((goal: any) => ({
                ...goal,
                completions: completionsData.filter(c => c.goal_id === goal.id),
            }));

            setGoals(goalsWithCompletions);
        } catch (err: any) {
            setError(err.message);
            console.error('Error fetching goals:', err);
        } finally {
            setLoading(false);
        }
    }, [user, groupId, overdueProcessed, processOverdueGoals]);

    useEffect(() => {
        fetchGoals();
    }, [fetchGoals]);

    // Create a new goal
    async function createGoal(
        name: string,
        emoji: string,
        frequencyDays: number,
        penaltyAmount: number,
        description?: string,
        goalType: 'frequency' | 'daily' | 'weekly' = 'frequency',
        goalMode: 'positive' | 'negative' = 'positive',
        targetPerWeek?: number | null
    ) {
        if (!user) throw new Error('Not authenticated');

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
                target_per_week: targetPerWeek || null,
                penalty_amount: penaltyAmount,
                created_by: user.id,
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
        const daysRemaining = Math.ceil((nextDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

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

    return {
        goals,
        loading,
        error,
        createGoal,
        logCompletion,
        logNegativeOccurrence,
        deleteCompletion,
        deleteGoal,
        getGoalStatus,
        getCompletionsForDate,
        getLast7DaysStats,
        refetch: fetchGoals,
    };
}
