import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';
import { ActivityLogWithProfile, ActivityEventType } from '../types/database';
import { ACTIVITY_PAGE_SIZE, CURRENCY_SYMBOL } from '../constants';

// Fields that should never be exposed to the client
const SENSITIVE_METADATA_FIELDS = [
    'ip_address',
    'user_agent',
    'device_id',
    'device_info',
    'location',
    'coordinates',
    'session_id',
];

/**
 * Strip sensitive metadata from activity log entries before displaying to client.
 */
function sanitizeActivityMetadata(activity: ActivityLogWithProfile): ActivityLogWithProfile {
    if (!activity.metadata) return activity;

    const sanitized = { ...activity.metadata };
    for (const field of SENSITIVE_METADATA_FIELDS) {
        delete sanitized[field];
    }

    return { ...activity, metadata: sanitized };
}

export function useActivityLog(groupId?: string) {
    const { user } = useAuth();
    const [activities, setActivities] = useState<ActivityLogWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchActivities = useCallback(async () => {
        if (!user) return;

        try {
            setLoading(true);
            setError(null);

            let query = supabase
                .from('activity_log')
                .select(`
                    *,
                    user:profiles!activity_log_user_id_fkey(*)
                `)
                .order('created_at', { ascending: false })
                .limit(ACTIVITY_PAGE_SIZE);

            if (groupId) {
                query = query.eq('group_id', groupId);
            }

            const { data, error: fetchError } = await query;

            if (fetchError) {
                // Table might not exist yet
                if (fetchError.message.includes('does not exist')) {
                    setActivities([]);
                    return;
                }
                throw fetchError;
            }

            setActivities(
                ((data || []) as ActivityLogWithProfile[]).map(sanitizeActivityMetadata)
            );
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }, [user, groupId]);

    useEffect(() => {
        fetchActivities();
    }, [fetchActivities]);

    // Subscribe to real-time updates
    useEffect(() => {
        if (!user || !groupId) return;

        const channel = supabase
            .channel(`activity:${groupId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'activity_log',
                    filter: `group_id=eq.${groupId}`,
                },
                async (payload) => {
                    // Fetch the new activity with user profile
                    const { data } = await supabase
                        .from('activity_log')
                        .select(`
                            *,
                            user:profiles!activity_log_user_id_fkey(*)
                        `)
                        .eq('id', payload.new.id)
                        .single();

                    if (data) {
                        setActivities((prev) => [sanitizeActivityMetadata(data as ActivityLogWithProfile), ...prev]);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, groupId]);

    // Get formatted activity message
    const getActivityMessage = (activity: ActivityLogWithProfile): string => {
        const userName = activity.user?.name || 'Someone';
        const metadata = activity.metadata || {};

        switch (activity.event_type) {
            case 'goal_completed':
                return `${userName} completed ${metadata.goal_emoji || '✅'} ${metadata.goal_name || 'a goal'}`;
            case 'goal_failed':
                return `${userName} missed deadline for ${metadata.goal_name || 'a goal'}`;
            case 'goal_created':
                return `${userName} created a new goal: ${metadata.goal_name || ''}`;
            case 'goal_deleted':
                return `${userName} deleted a goal`;
            case 'failure_logged':
                return `${userName} logged a failure ${metadata.description ? `- "${metadata.description}"` : ''}`;
            case 'debt_settled':
                return `${userName} settled a debt of ${CURRENCY_SYMBOL}${metadata.amount?.toFixed(2) || '0.00'}`;
            case 'member_joined':
                return `${metadata.member_name || userName} joined the group`;
            case 'member_left':
                return `${metadata.member_name || userName} left the group`;
            case 'group_created':
                return `${userName} created this group`;
            case 'streak_achieved':
                return `🔥 ${userName} reached a ${metadata.streak_days}-day streak on ${metadata.goal_name || 'a goal'}!`;
            case 'streak_broken':
                return `${userName}'s streak was broken on ${metadata.goal_name || 'a goal'}`;
            case 'comment_added':
                return `${userName} commented on a completion`;
            default:
                return `${userName} did something`;
        }
    };

    // Get activity icon
    const getActivityIcon = (eventType: ActivityEventType): string => {
        switch (eventType) {
            case 'goal_completed': return '✅';
            case 'goal_failed': return '❌';
            case 'goal_created': return '🎯';
            case 'goal_deleted': return '🗑️';
            case 'failure_logged': return '😔';
            case 'debt_settled': return '💰';
            case 'member_joined': return '👋';
            case 'member_left': return '👋';
            case 'group_created': return '🎉';
            case 'streak_achieved': return '🔥';
            case 'streak_broken': return '💔';
            case 'comment_added': return '💬';
            default: return '📝';
        }
    };

    // Group activities by date
    const getActivitiesByDate = (): { date: string; activities: ActivityLogWithProfile[] }[] => {
        const groups: { [key: string]: ActivityLogWithProfile[] } = {};

        activities.forEach((activity) => {
            const date = new Date(activity.created_at).toDateString();
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(activity);
        });

        return Object.entries(groups).map(([date, acts]) => ({
            date,
            activities: acts,
        }));
    };

    return {
        activities,
        loading,
        error,
        refetch: fetchActivities,
        getActivityMessage,
        getActivityIcon,
        getActivitiesByDate,
    };
}
