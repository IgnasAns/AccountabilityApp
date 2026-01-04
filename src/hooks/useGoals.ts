import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';
import { Goal, GoalCompletion, GoalWithCompletions, GoalStatus } from '../types/database';

export function useGoals(groupId: string) {
    const { user } = useAuth();
    const [goals, setGoals] = useState<GoalWithCompletions[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
    }, [user, groupId]);

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
        goalType: 'frequency' | 'daily' | 'weekly' = 'frequency'
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
                frequency_days: frequencyDays,
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

    return {
        goals,
        loading,
        error,
        createGoal,
        logCompletion,
        deleteCompletion,
        deleteGoal,
        getGoalStatus,
        getCompletionsForDate,
        refetch: fetchGoals,
    };
}
