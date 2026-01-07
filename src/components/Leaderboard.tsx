import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    Image,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { colors } from '../theme/colors';
import { useLeaderboard, LeaderboardPeriod } from '../hooks/useLeaderboard';
import { useAuth } from '../hooks/useAuth';

interface Props {
    groupId: string;
    showPeriodSelector?: boolean;
}

export default function Leaderboard({ groupId, showPeriodSelector = true }: Props) {
    const { user } = useAuth();
    const {
        leaderboard,
        loading,
        error,
        period,
        setPeriod,
        getUserRank,
        getUserBadges,
        getBadgeInfo,
    } = useLeaderboard(groupId);

    const periods: { key: LeaderboardPeriod; label: string }[] = [
        { key: 'week', label: 'This Week' },
        { key: 'month', label: 'This Month' },
        { key: 'all', label: 'All Time' },
    ];

    const getRankEmoji = (rank: number): string => {
        switch (rank) {
            case 1: return '🥇';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return `#${rank}`;
        }
    };

    const getRankColor = (rank: number): string => {
        switch (rank) {
            case 1: return '#FFD700';
            case 2: return '#C0C0C0';
            case 3: return '#CD7F32';
            default: return colors.textMuted;
        }
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={colors.primary} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>Failed to load leaderboard</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Period Selector */}
            {showPeriodSelector && (
                <View style={styles.periodSelector}>
                    {periods.map((p) => (
                        <TouchableOpacity
                            key={p.key}
                            style={[
                                styles.periodButton,
                                period === p.key && styles.periodButtonActive,
                            ]}
                            onPress={() => setPeriod(p.key)}
                        >
                            <Text style={[
                                styles.periodText,
                                period === p.key && styles.periodTextActive,
                            ]}>
                                {p.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Current User Rank Card */}
            {user && getUserRank() && (
                <View style={styles.myRankCard}>
                    <Text style={styles.myRankLabel}>Your Rank</Text>
                    <Text style={styles.myRankValue}>{getRankEmoji(getUserRank()!)}</Text>
                    <View style={styles.myBadges}>
                        {getUserBadges().slice(0, 3).map((badge) => {
                            const info = getBadgeInfo(badge.badge_type);
                            return (
                                <View
                                    key={badge.id}
                                    style={[styles.badgeIcon, { backgroundColor: info.color + '20' }]}
                                >
                                    <Text style={styles.badgeEmoji}>{info.emoji}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>
            )}

            {/* Leaderboard List */}
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {leaderboard.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>🏆</Text>
                        <Text style={styles.emptyText}>No rankings yet</Text>
                        <Text style={styles.emptySubtext}>Complete goals to earn points!</Text>
                    </View>
                ) : (
                    leaderboard.map((entry, index) => {
                        const rank = index + 1;
                        const isMe = entry.user_id === user?.id;

                        return (
                            <View
                                key={entry.user_id}
                                style={[
                                    styles.leaderboardItem,
                                    isMe && styles.leaderboardItemMe,
                                    rank <= 3 && styles.leaderboardItemTop,
                                ]}
                            >
                                {/* Rank */}
                                <View style={[styles.rankContainer, { backgroundColor: getRankColor(rank) + '20' }]}>
                                    <Text style={[styles.rankText, { color: rank <= 3 ? getRankColor(rank) : colors.text }]}>
                                        {rank <= 3 ? getRankEmoji(rank) : rank}
                                    </Text>
                                </View>

                                {/* Avatar */}
                                {entry.avatar_url ? (
                                    <Image source={{ uri: entry.avatar_url }} style={styles.avatar} />
                                ) : (
                                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                        <Text style={styles.avatarText}>
                                            {entry.user_name?.charAt(0).toUpperCase() || '?'}
                                        </Text>
                                    </View>
                                )}

                                {/* Info */}
                                <View style={styles.userInfo}>
                                    <Text style={styles.userName} numberOfLines={1}>
                                        {entry.user_name}
                                        {isMe && ' (You)'}
                                    </Text>
                                    <View style={styles.statsRow}>
                                        <Text style={styles.stat}>
                                            ✅ {entry.completions_count}
                                        </Text>
                                        {entry.streak_days > 0 && (
                                            <Text style={styles.stat}>
                                                🔥 {entry.streak_days}d
                                            </Text>
                                        )}
                                        {entry.failure_count > 0 && (
                                            <Text style={[styles.stat, styles.statNegative]}>
                                                ❌ {entry.failure_count}
                                            </Text>
                                        )}
                                    </View>
                                </View>

                                {/* Score */}
                                <View style={styles.scoreContainer}>
                                    <Text style={styles.scoreValue}>{entry.score}</Text>
                                    <Text style={styles.scoreLabel}>pts</Text>
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    errorText: {
        color: colors.error,
        fontSize: 14,
    },
    periodSelector: {
        flexDirection: 'row',
        padding: 16,
        gap: 8,
    },
    periodButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: colors.surfaceHighlight,
        alignItems: 'center',
    },
    periodButtonActive: {
        backgroundColor: colors.primary,
    },
    periodText: {
        color: colors.textMuted,
        fontSize: 13,
        fontWeight: '600',
    },
    periodTextActive: {
        color: '#fff',
    },
    myRankCard: {
        backgroundColor: colors.surface,
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.primary,
    },
    myRankLabel: {
        color: colors.textMuted,
        fontSize: 12,
        marginBottom: 4,
    },
    myRankValue: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.text,
    },
    myBadges: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 8,
    },
    badgeIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeEmoji: {
        fontSize: 16,
    },
    list: {
        flex: 1,
        paddingHorizontal: 16,
    },
    leaderboardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    leaderboardItemMe: {
        borderColor: colors.primary,
        backgroundColor: colors.primary + '10',
    },
    leaderboardItemTop: {
        borderWidth: 2,
    },
    rankContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    rankText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    avatarPlaceholder: {
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    stat: {
        fontSize: 12,
        color: colors.textMuted,
    },
    statNegative: {
        color: colors.error,
    },
    scoreContainer: {
        alignItems: 'center',
    },
    scoreValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.primary,
    },
    scoreLabel: {
        fontSize: 10,
        color: colors.textMuted,
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 40,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 4,
    },
    emptySubtext: {
        fontSize: 14,
        color: colors.textMuted,
    },
});
