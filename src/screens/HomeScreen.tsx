import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../hooks/useGroups';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';

interface Props {
    navigation: NativeStackNavigationProp<any>;
}

export default function HomeScreen({ navigation }: Props) {
    const { profile, signOut } = useAuth();
    const { groups, groupBalances, netBalance, loading, refetch } = useGroups();
    const [refreshing, setRefreshing] = React.useState(false);
    const insets = useSafeAreaInsets();

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    const formatBalance = (balance: number) => {
        const absBalance = Math.abs(balance);
        return `€${absBalance.toFixed(2)}`;
    };

    const getBalanceColor = (balance: number) => {
        if (balance > 0) return colors.success;
        if (balance < 0) return colors.error;
        return colors.textMuted;
    };

    const getBalanceText = (balance: number) => {
        if (balance > 0) return 'You are owed';
        if (balance < 0) return 'You owe';
        return 'All settled';
    };

    if (loading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.welcomeText}>Welcome back,</Text>
                    <Text style={styles.userNameText}>
                        {profile?.name || 'User'}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={signOut}
                    style={styles.signOutButton}
                >
                    <Text style={styles.signOutText}>Sign out</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
                    />
                }
            >
                {/* Net Balance Card */}
                <View style={styles.balanceCard}>
                    <Text style={styles.balanceLabel}>Your Net Balance</Text>
                    <Text
                        style={[
                            styles.balanceAmount,
                            { color: getBalanceColor(netBalance) }
                        ]}
                    >
                        {formatBalance(netBalance)}
                    </Text>
                    <Text
                        style={[
                            styles.balanceSubtext,
                            { color: getBalanceColor(netBalance) }
                        ]}
                    >
                        {getBalanceText(netBalance)}
                    </Text>
                </View>

                {/* Quick Actions */}
                <View style={styles.actionContainer}>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('CreateGroup')}
                        style={styles.createButton}
                    >
                        <Text style={styles.createButtonText}>Create Group</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('JoinGroup')}
                        style={styles.joinButton}
                    >
                        <Text style={styles.joinButtonText}>Join Group</Text>
                    </TouchableOpacity>
                </View>

                {/* Groups List */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>
                        Your Groups
                    </Text>

                    {groups.length === 0 ? (
                        <View style={styles.emptyStateContainer}>
                            <Text style={styles.emptyStateEmoji}>🎯</Text>
                            <Text style={styles.emptyStateTitle}>
                                No groups yet
                            </Text>
                            <Text style={styles.emptyStateText}>
                                Create or join a group to start tracking accountability bets with friends.
                            </Text>
                        </View>
                    ) : (
                        groupBalances.map(({ group, balance }) => (
                            <TouchableOpacity
                                key={group.id}
                                onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })}
                                style={styles.groupCard}
                                activeOpacity={0.7}
                            >
                                <View style={styles.groupInfo}>
                                    <Text style={styles.groupName}>
                                        {group.name}
                                    </Text>
                                    <Text style={styles.groupPenalty}>
                                        Penalty: €{group.default_penalty_amount.toFixed(2)}
                                    </Text>
                                </View>
                                <View style={styles.groupBalance}>
                                    <Text
                                        style={[
                                            styles.groupBalanceAmount,
                                            { color: getBalanceColor(balance) }
                                        ]}
                                    >
                                        {balance >= 0 ? '+' : ''}{formatBalance(balance)}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.groupBalanceSubtext,
                                            { color: getBalanceColor(balance) }
                                        ]}
                                    >
                                        {balance > 0 ? 'owed' : balance < 0 ? 'owe' : 'settled'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </View>

                {/* Recent Activity (placeholder) */}
                {groups.length > 0 && (
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionTitle}>
                            How It Works
                        </Text>
                        <View style={styles.infoCard}>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoEmoji}>🚨</Text>
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoTitle}>Log a Failure</Text>
                                    <Text style={styles.infoDescription}>
                                        Press the big red button when you slip up
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoEmoji}>💸</Text>
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoTitle}>Automatic Debts</Text>
                                    <Text style={styles.infoDescription}>
                                        You'll owe the penalty to each group member
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.infoRowLast}>
                                <Text style={styles.infoEmoji}>✅</Text>
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoTitle}>Settle Up</Text>
                                    <Text style={styles.infoDescription}>
                                        Pay your debts and mark them as settled
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 8,
    },
    welcomeText: {
        color: colors.textMuted,
        fontSize: 14,
    },
    userNameText: {
        color: colors.text,
        fontSize: 20,
        fontWeight: 'bold',
    },
    signOutButton: {
        backgroundColor: colors.surface,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    signOutText: {
        color: colors.textMuted,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    balanceCard: {
        backgroundColor: colors.surface,
        borderRadius: 24,
        padding: 24,
        marginTop: 16,
        alignItems: 'center',
    },
    balanceLabel: {
        color: colors.textMuted,
        fontSize: 16,
        marginBottom: 8,
    },
    balanceAmount: {
        fontSize: 48,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    balanceSubtext: {
        fontSize: 18,
        opacity: 0.8,
    },
    actionContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
    },
    createButton: {
        flex: 1,
        backgroundColor: colors.primary,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    createButtonText: {
        color: colors.text,
        fontWeight: '600',
    },
    joinButton: {
        flex: 1,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    joinButtonText: {
        color: colors.text,
        fontWeight: '600',
    },
    sectionContainer: {
        marginTop: 32,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    emptyStateContainer: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 32,
        alignItems: 'center',
    },
    emptyStateEmoji: {
        fontSize: 40,
        marginBottom: 12,
    },
    emptyStateTitle: {
        color: colors.text,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 8,
    },
    emptyStateText: {
        color: colors.textMuted,
        textAlign: 'center',
    },
    groupCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    groupInfo: {
        flex: 1,
    },
    groupName: {
        color: colors.text,
        fontWeight: '600',
        fontSize: 18,
    },
    groupPenalty: {
        color: colors.textMuted,
        fontSize: 14,
        marginTop: 4,
    },
    groupBalance: {
        alignItems: 'flex-end',
    },
    groupBalanceAmount: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    groupBalanceSubtext: {
        fontSize: 12,
        opacity: 0.8,
    },
    infoCard: {
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 16,
        padding: 20,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    infoRowLast: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    infoEmoji: {
        fontSize: 24,
        marginRight: 12,
    },
    infoTextContainer: {
        flex: 1,
    },
    infoTitle: {
        color: colors.text,
        fontWeight: '600',
    },
    infoDescription: {
        color: colors.textMuted,
        fontSize: 14,
        marginTop: 4,
    },
});
