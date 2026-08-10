import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Platform,
    Pressable,
    Image,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { BlurView } from 'expo-blur';
import { GoalWithCompletions, GoalCompletion, Profile } from '../types/database';
import { colors } from '../theme/colors';
import { toLocalDateString } from '../utils/dates';
import GoalStatsGraph from './GoalStatsGraph';
import StreakBadge from './StreakBadge';

interface MemberPerformance {
    user_id: string;
    user_name: string;
    completions_this_week: number;
    total_count: number;
    percentage: number;
}

interface Props {
    visible: boolean;
    onClose: () => void;
    goal: GoalWithCompletions | null;
    groupMembers?: { id: string; name: string }[];
    onMemberPress: (userId: string) => void;
}

export default function GoalCalendarModal({ visible, onClose, goal, groupMembers = [], onMemberPress }: Props) {
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'calendar' | 'stats'>('calendar');

    const isNegative = goal?.goal_mode === 'negative';

    // Calculate performance percentages for all members
    const memberPerformances = useMemo((): MemberPerformance[] => {
        if (!goal) return [];

        // Get start of current week (Monday)
        const now = new Date();
        const dayOfWeek = now.getDay();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        weekStart.setHours(0, 0, 0, 0);

        // Group completions by user
        const userStats = new Map<string, { name: string; weekCount: number; totalCount: number }>();

        // Initialize from group members if available
        groupMembers.forEach((m) => {
            userStats.set(m.id, { name: m.name, weekCount: 0, totalCount: 0 });
        });

        // Count completions
        goal.completions.forEach((c) => {
            const userId = c.user_id;
            const completionDate = new Date(c.completed_at);
            const count = c.occurrence_count || 1;

            if (!userStats.has(userId)) {
                userStats.set(userId, { name: 'Unknown', weekCount: 0, totalCount: 0 });
            }

            const stats = userStats.get(userId)!;
            stats.totalCount += count;
            if (completionDate >= weekStart) {
                stats.weekCount += count;
            }
        });

        // Calculate percentages
        const performances: MemberPerformance[] = [];
        const targetPerWeek = goal.target_per_week || Math.ceil(7 / goal.frequency_days);

        userStats.forEach((stats, id) => {
            let percentage: number;
            if (isNegative) {
                // For negative goals, lower is better, show as inverse
                // 0 slip-ups = 100%, higher = lower %
                percentage = Math.max(0, 100 - stats.weekCount * 20);
            } else {
                // For positive goals, higher is better
                percentage = Math.min(100, Math.round((stats.weekCount / targetPerWeek) * 100));
            }

            performances.push({
                user_id: id,
                user_name: stats.name,
                completions_this_week: stats.weekCount,
                total_count: stats.totalCount,
                percentage,
            });
        });

        // Sort by percentage (best first)
        if (isNegative) {
            performances.sort((a, b) => b.percentage - a.percentage);
        } else {
            performances.sort((a, b) => b.percentage - a.percentage);
        }

        return performances;
    }, [goal, groupMembers, isNegative]);

    // Generate marked dates for calendar
    const markedDates = useMemo(() => {
        if (!goal) return {};

        const marks: { [key: string]: { marked?: boolean; dotColor?: string; selected?: boolean; selectedColor?: string; customStyles?: { container: { backgroundColor: string } } } } = {};

        // Group completions by date and count. M4: dates are the DEVICE's
        // local calendar day — the old completed_at.split('T')[0] bucketed by
        // UTC, so evening completions (Mexico City etc.) marked the wrong day.
        const dateCounts = new Map<string, number>();
        goal.completions.forEach((completion) => {
            const dateStr = toLocalDateString(completion.completed_at);
            const count = completion.occurrence_count || 1;
            dateCounts.set(dateStr, (dateCounts.get(dateStr) || 0) + count);
        });

        dateCounts.forEach((count, dateStr) => {
            if (isNegative) {
                // For negative goals, show count as custom marking
                marks[dateStr] = {
                    marked: true,
                    dotColor: count > 0 ? colors.error : colors.success,
                    selected: selectedDate === dateStr,
                    selectedColor: colors.primary,
                    customStyles: {
                        container: { backgroundColor: `${colors.error}${Math.min(count * 20, 80).toString(16)}` }
                    }
                };
            } else {
                marks[dateStr] = {
                    marked: true,
                    dotColor: colors.success,
                    selected: selectedDate === dateStr,
                    selectedColor: colors.primary,
                };
            }
        });

        // If a date is selected but not in completions
        if (selectedDate && !marks[selectedDate]) {
            marks[selectedDate] = {
                selected: true,
                selectedColor: colors.border,
            };
        }

        return marks;
    }, [goal, selectedDate, isNegative]);

    // Get count for a specific date
    const getDateCount = (dateStr: string): number => {
        if (!goal) return 0;
        return goal.completions
            .filter((c) => toLocalDateString(c.completed_at) === dateStr)
            .reduce((sum, c) => sum + (c.occurrence_count || 1), 0);
    };

    // Get completions for selected date
    const selectedCompletions = useMemo(() => {
        if (!goal || !selectedDate) return [];
        return goal.completions.filter(
            (c) => toLocalDateString(c.completed_at) === selectedDate
        );
    }, [goal, selectedDate]);

    // Calculate total count for selected date
    const selectedDateCount = useMemo(() => {
        return selectedCompletions.reduce((sum, c) => sum + (c.occurrence_count || 1), 0);
    }, [selectedCompletions]);

    // Prepare graph data
    const graphData = useMemo(() => {
        if (!goal) return [];
        return goal.completions.map((c) => ({
            user_id: c.user_id,
            user_name: groupMembers.find((m) => m.id === c.user_id)?.name || 'Unknown',
            // M4: local calendar day so the graph's 7-day axis lines up with
            // what the user sees on the calendar tab.
            day_date: toLocalDateString(c.completed_at),
            count: c.occurrence_count || 1,
        }));
    }, [goal, groupMembers]);

    const handleDayPress = (day: DateData) => {
        setSelectedDate(day.dateString);
    };

    // Format time for display
    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (!goal) return null;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                {Platform.OS === 'ios' ? (
                    <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                ) : (
                    <View style={[StyleSheet.absoluteFill, styles.androidOverlay]} />
                )}
            </Pressable>

            <View style={styles.container}>
                <View style={styles.modal}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerTitle}>
                            <Text style={styles.emoji}>{goal.emoji}</Text>
                            <View>
                                <Text style={styles.title}>{goal.name}</Text>
                                <Text style={styles.subtitle}>
                                    {isNegative
                                        ? `${goal.completions.reduce((s, c) => s + (c.occurrence_count || 1), 0)} total slip-ups`
                                        : `${goal.completions.length} total completions`}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Tab Selector */}
                    <View style={styles.tabContainer}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'calendar' && styles.tabActive]}
                            onPress={() => setActiveTab('calendar')}
                        >
                            <Text style={[styles.tabText, activeTab === 'calendar' && styles.tabTextActive]}>
                                📅 Calendar
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'stats' && styles.tabActive]}
                            onPress={() => setActiveTab('stats')}
                        >
                            <Text style={[styles.tabText, activeTab === 'stats' && styles.tabTextActive]}>
                                📊 Stats
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {activeTab === 'calendar' ? (
                            <>
                                {/* Performance Leaderboard */}
                                {memberPerformances.length > 0 && (
                                    <View style={styles.leaderboard}>
                                        <Text style={styles.leaderboardTitle}>This Week</Text>
                                        {memberPerformances.map((perf, index) => (
                                            <View key={perf.user_id} style={styles.leaderboardRow}>
                                                <Text style={styles.leaderboardRank}>
                                                    {index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                                                </Text>
                                                <TouchableOpacity style={{ flex: 1 }} onPress={() => onMemberPress(perf.user_id)}>
                                                    <Text style={styles.leaderboardName} numberOfLines={1}>
                                                        {perf.user_name}
                                                    </Text>
                                                </TouchableOpacity>
                                                <View style={[
                                                    styles.percentageBadge,
                                                    {
                                                        backgroundColor: perf.percentage >= 100 ? `${colors.success}20` :
                                                            perf.percentage >= 50 ? `${colors.warning}20` : `${colors.error}20`
                                                    }
                                                ]}>
                                                    <Text style={[
                                                        styles.percentageText,
                                                        {
                                                            color: perf.percentage >= 100 ? colors.success :
                                                                perf.percentage >= 50 ? colors.warning : colors.error
                                                        }
                                                    ]}>
                                                        {perf.percentage}%
                                                    </Text>
                                                </View>
                                                <Text style={styles.leaderboardCount}>
                                                    {isNegative ? `${perf.completions_this_week} ❌` : `${perf.completions_this_week} ✓`}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Calendar */}
                                <Calendar
                                    markedDates={markedDates}
                                    onDayPress={handleDayPress}
                                    dayComponent={isNegative ? ({ date, state }: { date?: DateData; state?: string }) => {
                                        // Custom day component for negative goals showing count
                                        const dateStr = date?.dateString || '';
                                        const count = getDateCount(dateStr);
                                        const isSelected = selectedDate === dateStr;
                                        const isToday = dateStr === toLocalDateString(new Date());

                                        return (
                                            <TouchableOpacity
                                                style={[
                                                    styles.customDay,
                                                    isSelected && styles.customDaySelected,
                                                    count > 0 && styles.customDayHasCount,
                                                ]}
                                                onPress={() => date && handleDayPress(date)}
                                            >
                                                <Text style={[
                                                    styles.customDayText,
                                                    state === 'disabled' && styles.customDayTextDisabled,
                                                    isToday && styles.customDayTextToday,
                                                    isSelected && styles.customDayTextSelected,
                                                ]}>
                                                    {date?.day}
                                                </Text>
                                                {count > 0 && (
                                                    <View style={styles.countBadge}>
                                                        <Text style={styles.countBadgeText}>{count}</Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    } : undefined}
                                    theme={{
                                        backgroundColor: colors.surface,
                                        calendarBackground: colors.surface,
                                        textSectionTitleColor: colors.textMuted,
                                        selectedDayBackgroundColor: colors.primary,
                                        selectedDayTextColor: '#ffffff',
                                        todayTextColor: colors.primary,
                                        dayTextColor: colors.text,
                                        textDisabledColor: colors.textMuted,
                                        dotColor: isNegative ? colors.error : colors.success,
                                        selectedDotColor: '#ffffff',
                                        arrowColor: colors.primary,
                                        monthTextColor: colors.text,
                                        indicatorColor: colors.primary,
                                        textDayFontWeight: '500',
                                        textMonthFontWeight: 'bold',
                                        textDayHeaderFontWeight: '600',
                                        textDayFontSize: 14,
                                        textMonthFontSize: 16,
                                        textDayHeaderFontSize: 11,
                                    }}
                                    style={styles.calendar}
                                />

                                {/* Selected Date Details */}
                                {selectedDate && (
                                    <View style={styles.detailsContainer}>
                                        <Text style={styles.detailsTitle}>
                                            {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
                                                weekday: 'long',
                                                month: 'long',
                                                day: 'numeric',
                                            })}
                                            {isNegative && selectedDateCount > 0 && (
                                                <Text style={styles.detailsCount}> — {selectedDateCount} slip-up{selectedDateCount !== 1 ? 's' : ''}</Text>
                                            )}
                                        </Text>

                                        {selectedCompletions.length > 0 ? (
                                            <ScrollView style={styles.completionsList} nestedScrollEnabled>
                                                {selectedCompletions.map((completion) => (
                                                    <View key={completion.id} style={[
                                                        styles.completionItem,
                                                        isNegative && styles.completionItemNegative
                                                    ]}>
                                                        {/* Photo Thumbnail for positive goals */}
                                                        {!isNegative && completion.proof_photo_url && (
                                                            <TouchableOpacity
                                                                style={styles.photoThumbnail}
                                                                onPress={() => setFullscreenPhoto(completion.proof_photo_url)}
                                                            >
                                                                <Image
                                                                    source={{ uri: completion.proof_photo_url }}
                                                                    style={styles.thumbnailImage}
                                                                />
                                                                <View style={styles.photoOverlay}>
                                                                    <Text style={styles.photoIcon}>👁️</Text>
                                                                </View>
                                                            </TouchableOpacity>
                                                        )}
                                                        {!isNegative && !completion.proof_photo_url && (
                                                            <View style={styles.completionBadge}>
                                                                <Text style={styles.completionBadgeText}>✓</Text>
                                                            </View>
                                                        )}
                                                        {isNegative && (
                                                            <View style={styles.countIndicator}>
                                                                <Text style={styles.countIndicatorText}>
                                                                    x{completion.occurrence_count || 1}
                                                                </Text>
                                                            </View>
                                                        )}
                                                        <View style={styles.completionInfo}>
                                                            <TouchableOpacity onPress={() => onMemberPress(completion.user_id)}>
                                                                <Text style={styles.completionName}>{groupMembers.find(m => m.id === completion.user_id)?.name || 'Unknown'}</Text>
                                                            </TouchableOpacity>
                                                            <Text style={styles.completionTime}>
                                                                {formatTime(completion.completed_at)}
                                                            </Text>
                                                            {completion.notes && (
                                                                <Text style={styles.completionNotes}>
                                                                    {completion.notes}
                                                                </Text>
                                                            )}
                                                            {!isNegative && completion.proof_photo_url && (
                                                                <Text style={styles.proofIndicator}>
                                                                    📸 Tap photo to view
                                                                </Text>
                                                            )}
                                                        </View>
                                                    </View>
                                                ))}
                                            </ScrollView>
                                        ) : (
                                            <View style={styles.noCompletions}>
                                                <Text style={styles.noCompletionsText}>
                                                    {isNegative ? 'Clean day! 🎉' : 'No completions on this date'}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </>
                        ) : (
                            /* Stats Tab */
                            <View style={styles.statsTab}>
                                {/* Streak Badge — only meaningful for positive goals */}
                                {!isNegative && goal && (goal.current_streak || 0) > 0 && (
                                    <View style={styles.streakBadgeRow}>
                                        <StreakBadge
                                            currentStreak={goal.current_streak || 0}
                                            longestStreak={goal.longest_streak || 0}
                                            size="medium"
                                        />
                                    </View>
                                )}

                                {/* Graph */}
                                <GoalStatsGraph
                                    allMembersData={graphData}
                                    goalMode={goal.goal_mode}
                                />

                                {/* Weekly Summary */}
                                <View style={styles.weeklySummary}>
                                    <Text style={styles.weeklySummaryTitle}>Weekly Leaderboard</Text>
                                    {memberPerformances.map((perf, index) => (
                                        <View key={perf.user_id} style={styles.summaryRow}>
                                            <Text style={styles.summaryRank}>
                                                {index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                                            </Text>
                                            <View style={styles.summaryInfo}>
                                                <TouchableOpacity onPress={() => onMemberPress(perf.user_id)}>
                                                    <Text style={styles.summaryName}>{perf.user_name}</Text>
                                                </TouchableOpacity>
                                                <Text style={styles.summaryStats}>
                                                    {isNegative
                                                        ? `${perf.completions_this_week} this week • ${perf.total_count} total`
                                                        : `${perf.completions_this_week} this week • ${perf.total_count} total`}
                                                </Text>
                                            </View>
                                            <View style={[
                                                styles.summaryPercentage,
                                                {
                                                    backgroundColor: perf.percentage >= 100
                                                        ? colors.success
                                                        : perf.percentage >= 50
                                                            ? colors.warning
                                                            : colors.error
                                                }
                                            ]}>
                                                <Text style={styles.summaryPercentageText}>
                                                    {perf.percentage}%
                                                </Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>

            {/* Fullscreen Photo Modal */}
            <Modal
                visible={!!fullscreenPhoto}
                animationType="fade"
                transparent
                onRequestClose={() => setFullscreenPhoto(null)}
            >
                <Pressable
                    style={styles.fullscreenOverlay}
                    onPress={() => setFullscreenPhoto(null)}
                >
                    <View style={styles.fullscreenContainer}>
                        {fullscreenPhoto && (
                            <Image
                                source={{ uri: fullscreenPhoto }}
                                style={styles.fullscreenImage}
                                resizeMode="contain"
                            />
                        )}
                        <TouchableOpacity
                            style={styles.fullscreenCloseButton}
                            onPress={() => setFullscreenPhoto(null)}
                        >
                            <Text style={styles.fullscreenCloseText}>✕</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
    androidOverlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modal: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: colors.surface,
        borderRadius: 24,
        overflow: 'hidden',
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    emoji: {
        fontSize: 28,
        marginRight: 12,
    },
    title: {
        color: colors.text,
        fontSize: 17,
        fontWeight: 'bold',
    },
    subtitle: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 2,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        color: colors.textMuted,
        fontSize: 16,
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: colors.surfaceHighlight,
        alignItems: 'center',
    },
    tabActive: {
        backgroundColor: colors.primary,
    },
    tabText: {
        color: colors.textMuted,
        fontSize: 13,
        fontWeight: '600',
    },
    tabTextActive: {
        color: '#fff',
    },
    scrollContent: {
        maxHeight: 500,
    },
    leaderboard: {
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 8,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 12,
        padding: 12,
    },
    leaderboardTitle: {
        color: colors.textMuted,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    leaderboardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
    },
    leaderboardRank: {
        width: 24,
        fontSize: 14,
    },
    leaderboardName: {
        flex: 1,
        color: colors.text,
        fontSize: 13,
        marginLeft: 4,
    },
    percentageBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        marginRight: 8,
    },
    percentageText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    leaderboardCount: {
        color: colors.textMuted,
        fontSize: 12,
        width: 40,
        textAlign: 'right',
    },
    calendar: {
        marginHorizontal: 8,
    },
    customDay: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
    },
    customDaySelected: {
        backgroundColor: colors.primary,
    },
    customDayHasCount: {
        backgroundColor: `${colors.error}15`,
    },
    customDayText: {
        color: colors.text,
        fontSize: 14,
    },
    customDayTextDisabled: {
        color: colors.textMuted,
    },
    customDayTextToday: {
        color: colors.primary,
        fontWeight: 'bold',
    },
    customDayTextSelected: {
        color: '#fff',
    },
    countBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: colors.error,
        width: 14,
        height: 14,
        borderRadius: 7,
        justifyContent: 'center',
        alignItems: 'center',
    },
    countBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: 'bold',
    },
    detailsContainer: {
        padding: 16,
    },
    detailsTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 12,
    },
    detailsCount: {
        color: colors.error,
        fontWeight: 'normal',
    },
    completionsList: {
        maxHeight: 140,
    },
    completionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: `${colors.success}15`,
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
    },
    completionItemNegative: {
        backgroundColor: `${colors.error}15`,
    },
    completionBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.success,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    completionBadgeText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    countIndicator: {
        width: 36,
        height: 28,
        borderRadius: 8,
        backgroundColor: colors.error,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    countIndicatorText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    completionInfo: {
        flex: 1,
    },
    completionName: {
        fontWeight: '700',
        color: colors.text,
        fontSize: 13,
        marginBottom: 2,
    },
    completionTime: {
        color: colors.text,
        fontWeight: '500',
    },
    completionNotes: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 2,
    },
    proofIndicator: {
        color: colors.primary,
        fontSize: 11,
        marginTop: 4,
    },
    noCompletions: {
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
    },
    noCompletionsText: {
        color: colors.textMuted,
    },
    photoThumbnail: {
        width: 48,
        height: 48,
        borderRadius: 8,
        marginRight: 12,
        overflow: 'hidden',
        position: 'relative',
    },
    thumbnailImage: {
        width: '100%',
        height: '100%',
    },
    photoOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    photoIcon: {
        fontSize: 16,
    },
    fullscreenOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullscreenContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullscreenImage: {
        width: '90%',
        height: '80%',
    },
    fullscreenCloseButton: {
        position: 'absolute',
        top: 60,
        right: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullscreenCloseText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    statsTab: {
        padding: 16,
    },
    streakBadgeRow: {
        alignItems: 'center',
        marginBottom: 16,
    },
    weeklySummary: {
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 16,
        padding: 16,
        marginTop: 16,
    },
    weeklySummaryTitle: {
        color: colors.text,
        fontWeight: '600',
        fontSize: 14,
        marginBottom: 12,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    summaryRank: {
        fontSize: 16,
        width: 28,
    },
    summaryInfo: {
        flex: 1,
        marginLeft: 8,
    },
    summaryName: {
        color: colors.text,
        fontWeight: '600',
        fontSize: 14,
    },
    summaryStats: {
        color: colors.textMuted,
        fontSize: 11,
        marginTop: 2,
    },
    summaryPercentage: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
    },
    summaryPercentageText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 13,
    },
});
