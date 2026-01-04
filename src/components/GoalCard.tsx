import React, { useState } from 'react';
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
    onViewCalendar: (goalId: string) => void;
}

export default function GoalCard({ goal, status, onComplete, onViewCalendar }: Props) {
    const [completing, setCompleting] = useState(false);

    const safeHaptics = () => {
        if (Platform.OS !== 'web') {
            try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch (e) { }
        }
    };

    const handleComplete = async () => {
        try {
            setCompleting(true);
            safeHaptics();
            await onComplete(goal.id);
        } catch (error) {
            console.error('Failed to complete goal:', error);
        } finally {
            setCompleting(false);
        }
    };

    // Determine status color and text
    const getStatusInfo = () => {
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
    };

    const statusInfo = getStatusInfo();

    // Format last completion date
    const formatLastCompletion = () => {
        if (!status.last_completion) {
            return 'Never completed';
        }
        const date = new Date(status.last_completion);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Completed today';
        if (diffDays === 1) return 'Completed yesterday';
        return `Completed ${diffDays} days ago`;
    };

    return (
        <View style={[styles.card, { borderColor: statusInfo.borderColor }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.emojiContainer}>
                    <Text style={styles.emoji}>{goal.emoji}</Text>
                </View>
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>{goal.name}</Text>
                    <Text style={styles.frequency}>
                        Every {goal.frequency_days} day{goal.frequency_days !== 1 ? 's' : ''} •
                        €{goal.penalty_amount.toFixed(2)} penalty
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.calendarButton}
                    onPress={() => onViewCalendar(goal.id)}
                >
                    <Text style={styles.calendarIcon}>📅</Text>
                </TouchableOpacity>
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
                    <Text style={styles.statValue}>{status.total_completions}</Text>
                    <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                    <Text style={styles.statValue}>{formatLastCompletion()}</Text>
                    <Text style={styles.statLabel}>Last Activity</Text>
                </View>
            </View>

            {/* Complete Button */}
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
                        <Text style={styles.completeButtonIcon}>✓</Text>
                        <Text style={styles.completeButtonText}>Mark Complete</Text>
                    </>
                )}
            </TouchableOpacity>
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
        backgroundColor: colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    emoji: {
        fontSize: 28,
    },
    titleContainer: {
        flex: 1,
    },
    title: {
        color: colors.text,
        fontSize: 18,
        fontWeight: 'bold',
    },
    frequency: {
        color: colors.textMuted,
        fontSize: 13,
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
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 12,
        padding: 16,
    },
    stat: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: colors.border,
        marginHorizontal: 16,
    },
    statValue: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
    },
    statLabel: {
        color: colors.textMuted,
        fontSize: 11,
        marginTop: 4,
    },
    completeButton: {
        flexDirection: 'row',
        backgroundColor: colors.success,
        paddingVertical: 16,
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
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginRight: 8,
    },
    completeButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
