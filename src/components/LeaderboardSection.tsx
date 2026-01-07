
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { colors } from '../theme/colors';
import { GroupMemberWithProfile, GoalWithCompletions } from '../types/database';

interface Props {
    members: GroupMemberWithProfile[];
    goals: GoalWithCompletions[];
    onMemberPress: (member: GroupMemberWithProfile) => void;
}

type TabType = 'tasks' | 'money' | 'reliability';

export default function LeaderboardSection({ members, goals, onMemberPress }: Props) {
    const [activeTab, setActiveTab] = useState<TabType>('tasks');

    // ... existing rankings memo ...
    const rankings = useMemo(() => {
        // 1. Task Masters (Most completions)
        const taskCounts_ = new Map<string, number>();
        goals.forEach(goal => {
            goal.completions.forEach(c => {
                const current = taskCounts_.get(c.user_id) || 0;
                taskCounts_.set(c.user_id, current + 1);
            });
        });

        // 2. Prepare data for all members
        const data = members.map(m => {
            const taskCount = taskCounts_.get(m.user_id) || 0;
            // Balance: Positive is good (owed money), Negative is bad (owes money)
            const balance = m.current_balance || 0;
            const failures = m.failure_count || 0;
            const profile = m.profile;

            return {
                ...m, // Keep original member object for callback
                id: m.user_id,
                name: profile?.name || 'Unknown',
                avatarUrl: profile?.avatar_url,
                taskCount,
                balance,
                failures,
            };
        });

        // 3. Sort based on active tab
        if (activeTab === 'tasks') {
            return data.sort((a, b) => b.taskCount - a.taskCount);
        } else if (activeTab === 'money') {
            // Highest balance (most owed to them) is best
            return data.sort((a, b) => b.balance - a.balance);
        } else {
            // 'reliability' - Fewest failures is best
            return data.sort((a, b) => a.failures - b.failures);
        }
    }, [members, goals, activeTab]);

    const getMedal = (index: number) => {
        if (index === 0) return '🥇';
        if (index === 1) return '🥈';
        if (index === 2) return '🥉';
        return `${index + 1}`;
    };

    const getMetricDisplay = (item: typeof rankings[0]) => {
        if (activeTab === 'tasks') return `${item.taskCount} tasks`;
        if (activeTab === 'money') {
            const val = item.balance;
            return val >= 0 ? `+€${val.toFixed(2)}` : `-€${Math.abs(val).toFixed(2)}`;
        }
        if (activeTab === 'reliability') return `${item.failures} misses`;
        return '';
    };

    const getMetricColor = (item: typeof rankings[0]) => {
        if (activeTab === 'money') {
            return item.balance >= 0 ? colors.success : colors.error;
        }
        if (activeTab === 'reliability') {
            return item.failures === 0 ? colors.success : colors.textMuted;
        }
        return colors.primary;
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>🏆 Hall of Fame</Text>
                <Text style={styles.subtitle}>Who's winning at life?</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'tasks' && styles.activeTab]}
                    onPress={() => setActiveTab('tasks')}
                >
                    <Text style={[styles.tabText, activeTab === 'tasks' && styles.activeTabText]}>🔥 Grinders</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'money' && styles.activeTab]}
                    onPress={() => setActiveTab('money')}
                >
                    <Text style={[styles.tabText, activeTab === 'money' && styles.activeTabText]}>💰 Rich List</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'reliability' && styles.activeTab]}
                    onPress={() => setActiveTab('reliability')}
                >
                    <Text style={[styles.tabText, activeTab === 'reliability' && styles.activeTabText]}>🛡️ Safe Hands</Text>
                </TouchableOpacity>
            </View>

            {/* Ranking List */}
            <View style={styles.list}>
                {rankings.map((item, index) => (
                    <TouchableOpacity
                        key={item.id}
                        style={[
                            styles.rankRow,
                            index === 0 && styles.firstPlaceRow,
                            index === rankings.length - 1 && { borderBottomWidth: 0 }
                        ]}
                        onPress={() => onMemberPress(item)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.rankNumberContainer}>
                            <Text style={styles.rankNumber}>{getMedal(index)}</Text>
                        </View>

                        <View style={styles.userInfo}>
                            {item.avatarUrl ? (
                                <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <Text style={styles.avatarInitial}>{item.name.charAt(0)}</Text>
                                </View>
                            )}
                            <Text style={[styles.userName, index === 0 && styles.firstPlaceText]}>
                                {item.name} {index === 0 && '👑'}
                            </Text>
                        </View>

                        <Text style={[styles.metricText, { color: getMetricColor(item) }]}>
                            {getMetricDisplay(item)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 24,
        marginBottom: 8,
    },
    header: {
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
    },
    subtitle: {
        fontSize: 13,
        color: colors.textMuted,
        marginTop: 2,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 12, // Reduced from 16
        padding: 4,
        marginBottom: 16,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 10,
    },
    activeTab: {
        backgroundColor: colors.surface,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    tabText: {
        fontSize: 12, // Reduced from 13
        fontWeight: '600',
        color: colors.textMuted,
    },
    activeTabText: {
        color: colors.text,
        fontWeight: '700',
    },
    list: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    rankRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    firstPlaceRow: {
        backgroundColor: colors.primary + '10', // 10% opacity primary color
    },
    rankNumberContainer: {
        width: 32,
        alignItems: 'center',
        marginRight: 12,
    },
    rankNumber: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    userInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: 12,
        borderWidth: 2,
        borderColor: colors.surface,
    },
    avatarPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarInitial: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.textMuted,
    },
    userName: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
    },
    firstPlaceText: {
        color: colors.primary,
        fontSize: 16,
    },
    metricText: {
        fontSize: 15,
        fontWeight: '800',
    },
});
