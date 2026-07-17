import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { GoalWithCompletions, GoalStatus } from '../types/database';
import { colors } from '../theme/colors';
import { safeHaptics } from '../utils/haptics';
import AppIcon from './AppIcon';

interface Props {
    goal: GoalWithCompletions;
    status: GoalStatus;
    onComplete: (goalId: string) => Promise<void>;
    onNegativeLog?: (goalId: string, count: number) => Promise<void>;
    onViewCalendar: (goalId: string) => void;
}

import ConfirmModal from './ConfirmModal';

export default function GoalCard({ goal, status, onComplete, onNegativeLog, onViewCalendar }: Props) {
    const [completing, setCompleting] = useState(false);
    const [showConfirmSlipUp, setShowConfirmSlipUp] = useState(false);

    const isNegative = goal.goal_mode === 'negative';

    // Using centralized haptics utility from utils/haptics.ts
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
        } catch {
            // Error handled by caller
        } finally {
            setCompleting(false);
        }
    };

    const handleNegativePress = () => {
        safeHaptics('light');
        setShowConfirmSlipUp(true);
    };

    const handleConfirmSlipUp = async () => {
        setShowConfirmSlipUp(false);
        if (!onNegativeLog) return;

        try {
            setCompleting(true);
            safeHaptics('heavy');
            await onNegativeLog(goal.id, 1);
        } catch {
            // Error handled by caller
        } finally {
            setCompleting(false);
        }
    };


    const getStatusInfo = () => {
        if (isNegative) {
            if (todayCount === 0) {
                return {
                    color: colors.success,
                    bgColor: 'rgba(34, 197, 94, 0.1)',
                    borderColor: 'rgba(34, 197, 94, 0.3)',
                    text: 'Clean today',
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
            if (status.is_overdue) {
                return {
                    color: colors.error,
                    bgColor: 'rgba(239, 68, 68, 0.1)',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    text: `Overdue by ${Math.abs(status.days_remaining)} day${Math.abs(status.days_remaining) !== 1 ? 's' : ''}`,
                    urgent: true,
                };
            } else if (status.days_remaining <= 1) {
                return {
                    color: colors.warning,
                    bgColor: 'rgba(234, 179, 8, 0.1)',
                    borderColor: 'rgba(234, 179, 8, 0.3)',
                    text: status.days_remaining <= 0 ? 'Due today' : 'Due tomorrow',
                    urgent: true,
                };
            } else {
                return {
                    color: colors.success,
                    bgColor: 'rgba(34, 197, 94, 0.1)',
                    borderColor: 'rgba(34, 197, 94, 0.3)',
                    text: `${status.days_remaining} days remaining`,
                    urgent: false,
                };
            }
        }
    };

    const statusInfo = getStatusInfo();


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
            const diffMs = Math.max(0, now.getTime() - date.getTime());
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

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
                            {isNegative ? 'Avoid' : 'Goal'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.calendarButton}
                        onPress={() => onViewCalendar(goal.id)}
                    >
                        <AppIcon name="calendar-month-outline" size={20} color={colors.textMuted} />
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
                {/* Streak Display - Only for positive goals */}
                {!isNegative && (goal.current_streak || 0) > 0 && (
                    <>
                        <View style={styles.stat}>
                            <Text style={[styles.statValue, styles.streakValue]}>
                                🔥 {goal.current_streak || 0}
                            </Text>
                            <Text style={styles.statLabel}>Streak</Text>
                        </View>
                        <View style={styles.statDivider} />
                    </>
                )}
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
                    onPress={handleNegativePress}
                    disabled={completing}
                    activeOpacity={0.7}
                >
                    {completing ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <AppIcon name="alert-circle-outline" size={18} color="#fff" />
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
                            <AppIcon name="camera-outline" size={18} color="#fff" />
                            <Text style={styles.completeButtonText}>Mark Complete</Text>
                        </>
                    )}
                </TouchableOpacity>
            )}

            <ConfirmModal
                visible={showConfirmSlipUp}
                title="Log Slip-Up?"
                message={`Are you sure you want to log a slip-up for "${goal.name}"?\n\nThis will add €${goal.penalty_amount.toFixed(2)} to your penalty balance.`}
                confirmText="Yes, I slipped up"
                onConfirm={handleConfirmSlipUp}
                onCancel={() => setShowConfirmSlipUp(false)}
                confirmStyle="danger"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: 8,
        padding: 16,
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
        borderRadius: 8,
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
        color: colors.text,
        fontSize: 11,
        fontWeight: '700',
    },
    frequency: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 4,
    },
    calendarButton: {
        width: 44,
        height: 44,
        borderRadius: 8,
        backgroundColor: colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusBadge: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
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
        borderRadius: 8,
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
    streakValue: {
        color: '#FF6B35',
    },
    completeButton: {
        flexDirection: 'row',
        backgroundColor: colors.success,
        paddingVertical: 15,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: colors.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 6,
        elevation: 3,
    },
    completeButtonUrgent: {
        backgroundColor: colors.primary,
        shadowColor: colors.primary,
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
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: colors.error,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 6,
        elevation: 3,
    },
    negativeButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
    },
});
