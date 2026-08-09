import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
    currentStreak: number;
    longestStreak: number;
    size?: 'small' | 'medium' | 'large';
    showLongest?: boolean;
    /** Hide the motivational one-liner (used in compact layouts). */
    showMotivation?: boolean;
}

export default function StreakBadge({
    currentStreak,
    longestStreak,
    size = 'medium',
    showLongest = true,
    showMotivation = true,
}: Props) {
    const getStreakColor = (streak: number): string => {
        if (streak >= 100) return '#FFD700'; // Gold
        if (streak >= 30) return '#FF6B6B'; // Red-orange
        if (streak >= 7) return '#FF8C42'; // Orange
        if (streak > 0) return colors.warning;
        return colors.textMuted;
    };

    const getStreakEmoji = (streak: number): string => {
        if (streak >= 365) return '🏆';
        if (streak >= 100) return '💎';
        if (streak >= 30) return '🔥';
        if (streak >= 7) return '⚡';
        if (streak > 0) return '✨';
        return '💤';
    };

    const sizeStyles = {
        small: {
            container: { padding: 6 },
            emoji: { fontSize: 16 },
            value: { fontSize: 14 },
            label: { fontSize: 9 },
        },
        medium: {
            container: { padding: 10 },
            emoji: { fontSize: 24 },
            value: { fontSize: 20 },
            label: { fontSize: 11 },
        },
        large: {
            container: { padding: 16 },
            emoji: { fontSize: 36 },
            value: { fontSize: 28 },
            label: { fontSize: 13 },
        },
    };

    const currentSize = sizeStyles[size];
    const streakColor = getStreakColor(currentStreak);
    const emoji = getStreakEmoji(currentStreak);

    return (
        <View style={styles.container}>
            <View style={[
                styles.badge,
                currentSize.container,
                { backgroundColor: streakColor + '20', borderColor: streakColor + '40' }
            ]}>
                <Text style={[styles.emoji, currentSize.emoji]}>{emoji}</Text>
                <View style={styles.valueContainer}>
                    <Text style={[styles.value, currentSize.value, { color: streakColor }]}>
                        {currentStreak}
                    </Text>
                    <Text style={[styles.label, currentSize.label]}>
                        day{currentStreak !== 1 ? 's' : ''}
                    </Text>
                </View>
            </View>

            {showLongest && longestStreak > currentStreak && (
                <View style={styles.longestContainer}>
                    <Text style={styles.longestText}>
                        Best: {longestStreak} days 🏅
                    </Text>
                </View>
            )}

            {currentStreak > 0 && showMotivation && (
                <View style={styles.motivationContainer}>
                    <Text style={styles.motivationText}>
                        {getMotivationalMessage(currentStreak)}
                    </Text>
                </View>
            )}
        </View>
    );
}

function getMotivationalMessage(streak: number): string {
    if (streak >= 365) return "Legendary! A full year! 🎉";
    if (streak >= 100) return "Triple digits! Unstoppable! 💪";
    if (streak >= 30) return "One month strong! Keep it up!";
    if (streak >= 14) return "Two weeks! You're on fire! 🔥";
    if (streak >= 7) return "One week! Great momentum!";
    if (streak >= 3) return "Nice! Building consistency!";
    if (streak >= 1) return "Day " + streak + "! Don't break it!";
    return "";
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 2,
        gap: 8,
    },
    emoji: {
        fontSize: 24,
    },
    valueContainer: {
        alignItems: 'center',
    },
    value: {
        fontWeight: 'bold',
    },
    label: {
        color: colors.textMuted,
    },
    longestContainer: {
        marginTop: 8,
    },
    longestText: {
        fontSize: 12,
        color: colors.textMuted,
    },
    motivationContainer: {
        marginTop: 4,
    },
    motivationText: {
        fontSize: 11,
        color: colors.success,
        fontStyle: 'italic',
    },
});
