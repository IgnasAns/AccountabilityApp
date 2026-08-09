import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Pressable,
    Modal,
    StyleSheet,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { BlurView } from 'expo-blur';
import { GoalWithCompletions, GoalStatus } from '../types/database';
import { colors } from '../theme/colors';
import { safeHaptics } from '../utils/haptics';
import { StyledAlert } from './StyledAlert';
import AppIcon from './AppIcon';
import StreakBadge from './StreakBadge';

interface Props {
    goal: GoalWithCompletions;
    status: GoalStatus;
    onComplete: (goalId: string) => Promise<void>;
    /** Opens the completion modal (photo proof / notes). */
    onCompleteWithProof?: (goalId: string) => void;
    onNegativeLog?: (goalId: string, count: number) => Promise<void>;
    onViewCalendar: (goalId: string) => void;
    /** Pause/resume a goal (used by the long-press action sheet). */
    onTogglePause?: (goalId: string, pause: boolean, pauseUntil?: Date) => Promise<boolean>;
}

import ConfirmModal from './ConfirmModal';

export default function GoalCard({
    goal,
    status,
    onComplete,
    onCompleteWithProof,
    onNegativeLog,
    onViewCalendar,
    onTogglePause,
}: Props) {
    const [completing, setCompleting] = useState(false);
    const [showConfirmSlipUp, setShowConfirmSlipUp] = useState(false);
    const [showPauseSheet, setShowPauseSheet] = useState(false);
    const [showPauseDatePicker, setShowPauseDatePicker] = useState(false);
    const [pausedUntil, setPausedUntil] = useState<string | null>(null);
    const [pausing, setPausing] = useState(false);

    const isNegative = goal.goal_mode === 'negative';
    // 1-tap fast path: positive goals that don't require photo proof.
    const isFastComplete = !isNegative && !goal.requires_proof;
    const isPaused = goal.is_paused && (!goal.paused_until || new Date(goal.paused_until) > new Date());

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

    // 1-tap complete (fast path for positive goals without proof requirement)
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

    // Opens the full completion modal (proof / notes)
    const handleCompleteWithProof = () => {
        safeHaptics('light');
        onCompleteWithProof?.(goal.id);
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

    // ---- Pause / resume ----

    const handleLongPress = () => {
        safeHaptics('selection');
        setShowPauseSheet(true);
    };

    const handlePause = async (until?: Date) => {
        if (!onTogglePause) return;
        setShowPauseSheet(false);
        setShowPauseDatePicker(false);
        setPausing(true);
        try {
            const ok = await onTogglePause(goal.id, true, until);
            if (ok) {
                safeHaptics('success');
                if (until) {
                    StyledAlert.alert(
                        'Paused ⏸',
                        `"${goal.name}" is paused until ${until.toLocaleDateString()}. No auto-failures while paused.`
                    );
                } else {
                    StyledAlert.alert(
                        'Paused ⏸',
                        `"${goal.name}" is paused for a week. No auto-failures while paused.`
                    );
                }
            } else {
                StyledAlert.alert('Error', 'Could not pause this goal.');
            }
        } finally {
            setPausing(false);
        }
    };

    const handleResume = async () => {
        if (!onTogglePause) return;
        setShowPauseSheet(false);
        setPausing(true);
        try {
            const ok = await onTogglePause(goal.id, false);
            if (ok) {
                safeHaptics('success');
                StyledAlert.alert('Resumed ▶️', `"${goal.name}" is back on the clock.`);
            } else {
                StyledAlert.alert('Error', 'Could not resume this goal.');
            }
        } finally {
            setPausing(false);
        }
    };

    const handlePauseDayPress = (day: DateData) => {
        setPausedUntil(day.dateString);
    };

    const confirmPauseUntil = () => {
        if (!pausedUntil) return;
        // Parse YYYY-MM-DD as a local date at end of day, so the pause lasts
        // through the chosen day.
        const [y, m, d] = pausedUntil.split('-').map(Number);
        const date = new Date(y, m - 1, d, 23, 59, 59);
        handlePause(date);
    };


    const getStatusInfo = () => {
        if (isPaused) {
            return {
                color: colors.textMuted,
                bgColor: 'rgba(148, 163, 184, 0.12)',
                borderColor: 'rgba(148, 163, 184, 0.3)',
                text: '⏸ Paused',
                urgent: false,
            };
        }
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

    const today = new Date().toISOString().split('T')[0];

    return (
        <Pressable
            style={[styles.card, { borderColor: statusInfo.borderColor }]}
            onLongPress={handleLongPress}
            delayLongPress={450}
        >
            {/* Header */}
            <View style={styles.header}>
                <View style={[styles.emojiContainer, isNegative && styles.emojiContainerNegative]}>
                    <Text style={styles.emoji}>{goal.emoji}</Text>
                </View>
                <View style={styles.titleContainer}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title} numberOfLines={1}>{goal.name}</Text>
                        {isPaused && (
                            <View style={styles.pausedBadge}>
                                <Text style={styles.pausedBadgeText}>⏸ Paused</Text>
                            </View>
                        )}
                    </View>
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
                            <StreakBadge
                                currentStreak={goal.current_streak || 0}
                                longestStreak={goal.longest_streak || 0}
                                size="small"
                                showLongest={false}
                                showMotivation={false}
                            />
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
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[
                            styles.completeButton,
                            statusInfo.urgent && styles.completeButtonUrgent,
                            isFastComplete && styles.completeButtonRowFlex,
                        ]}
                        onPress={isFastComplete ? handleComplete : handleCompleteWithProof}
                        disabled={completing}
                        activeOpacity={0.7}
                    >
                        {completing ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <AppIcon
                                    name={isFastComplete ? 'check-bold' : 'camera-outline'}
                                    size={18}
                                    color="#fff"
                                />
                                <Text style={styles.completeButtonText}>
                                    {isFastComplete ? 'Complete' : 'Mark Complete'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Secondary "add proof" affordance — opens the full modal */}
                    {isFastComplete && (
                        <TouchableOpacity
                            style={styles.proofButton}
                            onPress={handleCompleteWithProof}
                            disabled={completing}
                            activeOpacity={0.7}
                        >
                            <AppIcon name="camera-plus-outline" size={20} color={colors.primary} />
                        </TouchableOpacity>
                    )}
                </View>
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

            {/* Pause action sheet (long-press) */}
            <Modal
                visible={showPauseSheet}
                transparent
                animationType="fade"
                onRequestClose={() => setShowPauseSheet(false)}
                statusBarTranslucent
            >
                <Pressable style={styles.sheetOverlay} onPress={() => setShowPauseSheet(false)}>
                    {Platform.OS === 'ios' ? (
                        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                    ) : (
                        <View style={[StyleSheet.absoluteFill, styles.sheetAndroidOverlay]} />
                    )}
                </Pressable>
                <View style={styles.sheetContainer}>
                    <View style={styles.sheetHandle} />
                    <Text style={styles.sheetTitle}>"{goal.name}"</Text>
                    <Text style={styles.sheetSubtitle}>
                        {isPaused ? 'This goal is currently paused' : 'Pause auto-failures & deadline pressure'}
                    </Text>

                    <TouchableOpacity
                        style={styles.sheetOption}
                        onPress={() => handlePause(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))}
                        disabled={pausing}
                    >
                        <Text style={styles.sheetOptionEmoji}>⏸</Text>
                        <Text style={styles.sheetOptionText}>Pause for a week</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.sheetOption}
                        onPress={() => { setShowPauseDatePicker(true); }}
                        disabled={pausing}
                    >
                        <Text style={styles.sheetOptionEmoji}>📅</Text>
                        <Text style={styles.sheetOptionText}>Pause until date…</Text>
                    </TouchableOpacity>

                    {isPaused && (
                        <TouchableOpacity
                            style={styles.sheetOption}
                            onPress={handleResume}
                            disabled={pausing}
                        >
                            <Text style={styles.sheetOptionEmoji}>▶️</Text>
                            <Text style={styles.sheetOptionText}>Resume</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={styles.sheetCancel}
                        onPress={() => setShowPauseSheet(false)}
                        disabled={pausing}
                    >
                        <Text style={styles.sheetCancelText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </Modal>

            {/* Pause until date — date picker */}
            <Modal
                visible={showPauseDatePicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowPauseDatePicker(false)}
                statusBarTranslucent
            >
                <Pressable style={styles.sheetOverlay} onPress={() => setShowPauseDatePicker(false)}>
                    {Platform.OS === 'ios' ? (
                        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                    ) : (
                        <View style={[StyleSheet.absoluteFill, styles.sheetAndroidOverlay]} />
                    )}
                </Pressable>
                <View style={styles.datePickerContainer}>
                    <View style={styles.sheetHandle} />
                    <Text style={styles.sheetTitle}>Pause until…</Text>
                    <Text style={styles.sheetSubtitle}>Pick the day you'll be back</Text>

                    <Calendar
                        markedDates={{
                            [pausedUntil || '']: {
                                selected: true,
                                selectedColor: colors.primary,
                            },
                        }}
                        onDayPress={handlePauseDayPress}
                        minDate={today}
                        theme={{
                            backgroundColor: colors.surface,
                            calendarBackground: colors.surface,
                            textSectionTitleColor: colors.textMuted,
                            selectedDayBackgroundColor: colors.primary,
                            selectedDayTextColor: '#ffffff',
                            todayTextColor: colors.primary,
                            dayTextColor: colors.text,
                            textDisabledColor: colors.textMuted,
                            arrowColor: colors.primary,
                            monthTextColor: colors.text,
                            indicatorColor: colors.primary,
                            textDayFontWeight: '500',
                            textMonthFontWeight: 'bold',
                            textDayHeaderFontWeight: '600',
                        }}
                        style={styles.datePickerCalendar}
                    />

                    <View style={styles.datePickerActions}>
                        <TouchableOpacity
                            style={styles.datePickerCancel}
                            onPress={() => setShowPauseDatePicker(false)}
                        >
                            <Text style={styles.datePickerCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.datePickerConfirm, !pausedUntil && styles.datePickerConfirmDisabled]}
                            onPress={confirmPauseUntil}
                            disabled={!pausedUntil}
                        >
                            <Text style={styles.datePickerConfirmText}>Pause Until</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </Pressable>
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
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        color: colors.text,
        fontSize: 16,
        fontWeight: 'bold',
        flexShrink: 1,
    },
    pausedBadge: {
        backgroundColor: colors.textMuted + '20',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    pausedBadgeText: {
        color: colors.textMuted,
        fontSize: 11,
        fontWeight: '700',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
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
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
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
    completeButtonRowFlex: {
        flex: 1,
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
    proofButton: {
        width: 52,
        alignSelf: 'stretch',
        borderRadius: 8,
        backgroundColor: colors.primary + '15',
        borderWidth: 1,
        borderColor: colors.primary + '40',
        alignItems: 'center',
        justifyContent: 'center',
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
    // Pause sheet styles
    sheetOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    sheetAndroidOverlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
    },
    sheetContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 32,
        borderWidth: 1,
        borderColor: colors.border,
    },
    sheetHandle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.border,
        marginBottom: 16,
    },
    sheetTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '800',
        textAlign: 'center',
    },
    sheetSubtitle: {
        color: colors.textMuted,
        fontSize: 13,
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 20,
    },
    sheetOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: colors.surfaceHighlight,
        marginBottom: 10,
    },
    sheetOptionEmoji: {
        fontSize: 18,
    },
    sheetOptionText: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '600',
    },
    sheetCancel: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 4,
    },
    sheetCancelText: {
        color: colors.textMuted,
        fontSize: 15,
        fontWeight: '700',
    },
    datePickerContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 32,
        borderWidth: 1,
        borderColor: colors.border,
    },
    datePickerCalendar: {
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
    },
    datePickerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    datePickerCancel: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: colors.surfaceHighlight,
    },
    datePickerCancelText: {
        color: colors.textMuted,
        fontSize: 15,
        fontWeight: '700',
    },
    datePickerConfirm: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: colors.primary,
    },
    datePickerConfirmDisabled: {
        opacity: 0.5,
    },
    datePickerConfirmText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
    },
});
