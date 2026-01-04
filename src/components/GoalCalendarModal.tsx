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
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { BlurView } from 'expo-blur';
import { GoalWithCompletions, GoalCompletion } from '../types/database';
import { colors } from '../theme/colors';

interface Props {
    visible: boolean;
    onClose: () => void;
    goal: GoalWithCompletions | null;
}

export default function GoalCalendarModal({ visible, onClose, goal }: Props) {
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // Generate marked dates from completions
    const markedDates = useMemo(() => {
        if (!goal) return {};

        const marks: { [key: string]: any } = {};

        goal.completions.forEach((completion) => {
            const dateStr = completion.completed_at.split('T')[0];
            marks[dateStr] = {
                marked: true,
                dotColor: colors.success,
                selected: selectedDate === dateStr,
                selectedColor: colors.primary,
            };
        });

        // If a date is selected but not in completions
        if (selectedDate && !marks[selectedDate]) {
            marks[selectedDate] = {
                selected: true,
                selectedColor: colors.border,
            };
        }

        return marks;
    }, [goal, selectedDate]);

    // Get completions for selected date
    const selectedCompletions = useMemo(() => {
        if (!goal || !selectedDate) return [];
        return goal.completions.filter(
            (c) => c.completed_at.split('T')[0] === selectedDate
        );
    }, [goal, selectedDate]);

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
                                    {goal.completions.length} total completions
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Calendar */}
                    <Calendar
                        markedDates={markedDates}
                        onDayPress={handleDayPress}
                        theme={{
                            backgroundColor: colors.surface,
                            calendarBackground: colors.surface,
                            textSectionTitleColor: colors.textMuted,
                            selectedDayBackgroundColor: colors.primary,
                            selectedDayTextColor: '#ffffff',
                            todayTextColor: colors.primary,
                            dayTextColor: colors.text,
                            textDisabledColor: colors.textMuted,
                            dotColor: colors.success,
                            selectedDotColor: '#ffffff',
                            arrowColor: colors.primary,
                            monthTextColor: colors.text,
                            indicatorColor: colors.primary,
                            textDayFontWeight: '500',
                            textMonthFontWeight: 'bold',
                            textDayHeaderFontWeight: '600',
                            textDayFontSize: 15,
                            textMonthFontSize: 18,
                            textDayHeaderFontSize: 12,
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
                            </Text>

                            {selectedCompletions.length > 0 ? (
                                <ScrollView style={styles.completionsList}>
                                    {selectedCompletions.map((completion) => (
                                        <View key={completion.id} style={styles.completionItem}>
                                            <View style={styles.completionBadge}>
                                                <Text style={styles.completionBadgeText}>✓</Text>
                                            </View>
                                            <View style={styles.completionInfo}>
                                                <Text style={styles.completionTime}>
                                                    {formatTime(completion.completed_at)}
                                                </Text>
                                                {completion.notes && (
                                                    <Text style={styles.completionNotes}>
                                                        {completion.notes}
                                                    </Text>
                                                )}
                                                {completion.proof_photo_url && (
                                                    <Text style={styles.proofIndicator}>
                                                        📸 Has proof photo
                                                    </Text>
                                                )}
                                            </View>
                                        </View>
                                    ))}
                                </ScrollView>
                            ) : (
                                <View style={styles.noCompletions}>
                                    <Text style={styles.noCompletionsText}>
                                        No completions on this date
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </View>
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
        padding: 20,
    },
    modal: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: colors.surface,
        borderRadius: 24,
        overflow: 'hidden',
        maxHeight: '85%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    emoji: {
        fontSize: 32,
        marginRight: 12,
    },
    title: {
        color: colors.text,
        fontSize: 18,
        fontWeight: 'bold',
    },
    subtitle: {
        color: colors.textMuted,
        fontSize: 13,
        marginTop: 2,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        color: colors.textMuted,
        fontSize: 18,
    },
    calendar: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    detailsContainer: {
        padding: 20,
        maxHeight: 200,
    },
    detailsTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    completionsList: {
        maxHeight: 120,
    },
    completionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: `${colors.success}15`,
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
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
    completionInfo: {
        flex: 1,
    },
    completionTime: {
        color: colors.text,
        fontWeight: '500',
    },
    completionNotes: {
        color: colors.textMuted,
        fontSize: 13,
        marginTop: 2,
    },
    proofIndicator: {
        color: colors.primary,
        fontSize: 12,
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
});
