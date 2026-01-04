import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { GoalWithCompletions, GoalStatus } from '../types/database';
import { colors } from '../theme/colors';

interface Props {
    goal: GoalWithCompletions;
    status: GoalStatus;
    onComplete: (goalId: string) => Promise<void>;
    onNegativeLog?: (goalId: string, count: number) => Promise<void>;
    onViewCalendar: (goalId: string) => void;
}

export default function GoalCard({ goal, status, onComplete, onNegativeLog, onViewCalendar }: Props) {
    const [completing, setCompleting] = useState(false);

    const isNegative = goal.goal_mode === 'negative';

    const safeHaptics = (style: 'light' | 'medium' | 'heavy' = 'medium') => {
        if (Platform.OS !== 'web') {
            try {
                const feedbackStyle = style === 'light'
                    ? Haptics.ImpactFeedbackStyle.Light
                    : style === 'heavy'
                        ? Haptics.ImpactFeedbackStyle.Heavy
                        : Haptics.ImpactFeedbackStyle.Medium;
                Haptics.impactAsync(feedbackStyle);
            } catch (e) { }
        }
    };

    // Calculate today's count for negative goals
    const todayCount = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return goal.completions
            .filter(c => c.completed_at.split('T')[0] === today)
            .reduce((sum, c) => sum + (c.occurrence_count || 1), 0);
    }, [goal.completions]);

    // Calculate this week's count
    const weekCount = useMemo(() => {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
        weekStart.setHours(0, 0, 0, 0);

        return goal.completions
            .filter(c => new Date(c.completed_at) >= weekStart)
            .reduce((sum, c) => sum + (c.occurrence_count || 1), 0);
    }, [goal.completions]);

    const handleComplete = async () => {
        try {
            setCompleting(true);
            safeHaptics('medium');
            await onComplete(goal.id);
        } catch (error) {
            console.error('Failed to complete goal:', error);
        } finally {
            setCompleting(false);
        }
    };

    const handleNegativeLog = async () => {
        if (!onNegativeLog) return;
        try {
            setCompleting(true);
            safeHaptics('heavy'); // Heavier feedback for negative actions
            await onNegativeLog(goal.id, 1);
        } catch (error) {
            console.error('Failed to log occurrence:', error);
        } finally {
            setCompleting(false);
        }
    };

    // Determine status color and text - different for positive vs negative
    const getStatusInfo = () => {
        if (isNegative) {
            // For negative goals, show today's slip-up count
            if (todayCount === 0) {
                return {
                    color: colors.success,
                    bgColor: 'rgba(34, 197, 94, 0.1)',
                    borderColor: 'rgba(34, 197, 94, 0.3)',
                    text: '✓ Clean today!',
                    urgent: false,
                };
            } else {
                return {
                    color: colors.error,
                    bgColor: 'rgba(239, 68, 68, 0.1)',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    text: `${todayCount} today • €${(todayCount * goal.penalty_amount).toFixed(2)} penalty`,
                    urgent: true,
                };
            }
        } else {
            // Positive goal status
            if (status.is_overdue) {
                return {
                    color: colors.error,
                    bgColor: 'rgba(239, 68, 68, 0.1)',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    text: `⚠️ Overdue by ${Math.abs(status.days_remaining)} day${Math.abs(status.days_remaining) !== 1 ? 's' : ''}`,
                    urgent: true,
                };
            } else if (status.days_remaining <= 1) {
                return {
                    color: colors.warning,
                    bgColor: 'rgba(234, 179, 8, 0.1)',
                    borderColor: 'rgba(234, 179, 8, 0.3)',
                    text: status.days_remaining <= 0 ? '⏰ Due today!' : '⏰ Due tomorrow',
                    urgent: true,
                };
            } else {
                return {
                    color: colors.success,
                    bgColor: 'rgba(34, 197, 94, 0.1)',
                    borderColor: 'rgba(34, 197, 94, 0.3)',
                    text: `✓ ${status.days_remaining} days remaining`,
                    urgent: false,
                };
            }
        }
    };

    const statusInfo = getStatusInfo();

    // Format last activity
    const formatLastActivity = () => {
        if (isNegative) {
            if (goal.completions.length === 0) return 'No slip-ups yet!';
            const lastCompletion = goal.completions[0];
            const date = new Date(lastCompletion.completed_at);
            const now = new Date();
            const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

            if (diffHours < 1) return 'Last: just now';
            if (diffHours < 24) return `Last: ${diffHours}h ago`;
            const diffDays = Math.floor(diffHours / 24);
            return `Last: ${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        } else {
            if (!status.last_completion) return 'Never completed';
            const date = new Date(status.last_completion);
            const now = new Date();
            const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 0) return 'Completed today';
            if (diffDays === 1) return 'Completed yesterday';
            return `Completed ${diffDays} days ago`;
        }
    };

    return (
        <View style={[styles.card, { borderColor: statusInfo.borderColor }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={[styles.emojiContainer, isNegative && styles.emojiContainerNegative]}>
                    <Text style={styles.emoji}>{goal.emoji}</Text>
                </View>
                <View style={styles.titleContainer}>
                    <Text style={styles.title} numberOfLines={1}>{goal.name}</Text>
                    <Text style={styles.frequency}>
                        {isNegative
                            ? `€${goal.penalty_amount.toFixed(2)} per slip-up`
                            : goal.target_per_week
                                ? `${goal.target_per_week}x/week • €${goal.penalty_amount.toFixed(2)}`
                                : `Every ${goal.frequency_days}d • €${goal.penalty_amount.toFixed(2)}`
                        }
                    </Text>
                </View>
                <View style={styles.headerActions}>
                    <View style={[styles.modeBadge, isNegative && styles.modeBadgeNegative]}>
                        <Text style={styles.modeBadgeText}>
                            {isNegative ? '🚫' : '✅'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.calendarButton}
                        onPress={() => onViewCalendar(goal.id)}
                    >
                        <Text style={styles.calendarIcon}>📅</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Status Badge */}
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
                <Text style={[styles.statusText, { color: statusInfo.color }]}>
                    {statusInfo.text}
                </Text>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
                <View style={styles.stat}>
                    <Text style={styles.statValue}>
                        {isNegative ? weekCount : status.total_completions}
                    </Text>
                    <Text style={styles.statLabel}>
                        {isNegative ? 'This Week' : 'Total'}
                    </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                    <Text style={styles.statValue}>{formatLastActivity()}</Text>
                    <Text style={styles.statLabel}>
                        {isNegative ? 'Last Slip-up' : 'Last Activity'}
                    </Text>
                </View>
            </View>

            {/* Action Button */}
            {isNegative ? (
                <TouchableOpacity
                    style={styles.negativeButton}
                    onPress={handleNegativeLog}
                    disabled={completing}
                    activeOpacity={0.7}
                >
                    {completing ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Text style={styles.negativeButtonIcon}>👆</Text>
                            <Text style={styles.negativeButtonText}>I Slipped Up</Text>
                        </>
                    )}
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    style={[
                        styles.completeButton,
                        statusInfo.urgent && styles.completeButtonUrgent,
                    ]}
                    onPress={handleComplete}
                    disabled={completing}
                    activeOpacity={0.7}
                >
                    {completing ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Text style={styles.completeButtonIcon}>📸</Text>
                            <Text style={styles.completeButtonText}>Mark Complete</Text>
                        </>
                    )}
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    emojiContainer: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: `${colors.success}15`,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    emojiContainerNegative: {
        backgroundColor: `${colors.error}15`,
    },
    emoji: {
        fontSize: 28,
    },
    titleContainer: {
        flex: 1,
        marginRight: 12,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        color: colors.text,
        fontSize: 16,
        fontWeight: 'bold',
    },
    modeBadge: {
        backgroundColor: `${colors.success}20`,
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 8,
    },
    modeBadgeNegative: {
        backgroundColor: `${colors.error}20`,
    },
    modeBadgeText: {
        fontSize: 12,
    },
    frequency: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 4,
    },
    calendarButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    calendarIcon: {
        fontSize: 20,
    },
    statusBadge: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        marginBottom: 16,
    },
    statusText: {
        fontWeight: '600',
        textAlign: 'center',
        fontSize: 14,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 12,
        padding: 14,
    },
    stat: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        height: 28,
        backgroundColor: colors.border,
        marginHorizontal: 12,
    },
    statValue: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '600',
    },
    statLabel: {
        color: colors.textMuted,
        fontSize: 10,
        marginTop: 3,
    },
    completeButton: {
        flexDirection: 'row',
        backgroundColor: colors.success,
        paddingVertical: 15,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    completeButtonUrgent: {
        backgroundColor: colors.primary,
        shadowColor: colors.primary,
    },
    completeButtonIcon: {
        fontSize: 18,
        marginRight: 8,
    },
    completeButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
    },
    negativeButton: {
        flexDirection: 'row',
        backgroundColor: colors.error,
        paddingVertical: 15,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.error,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    negativeButtonIcon: {
        fontSize: 18,
        marginRight: 8,
    },
    negativeButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
    },
});
