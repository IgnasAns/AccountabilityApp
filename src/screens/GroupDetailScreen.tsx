import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Share,
    Alert,
    StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../hooks/useAuth';
import { useGroupDetail } from '../hooks/useGroups';
import { useTransactions } from '../hooks/useTransactions';
import LogFailureModal from '../components/LogFailureModal';
import { colors } from '../theme/colors';

type RootStackParamList = {
    GroupDetail: { groupId: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;

export default function GroupDetailScreen({ navigation, route }: Props) {
    const { groupId } = route.params;
    const { user } = useAuth();
    const { group, members, loading: groupLoading, refetch: refetchGroup } = useGroupDetail(groupId);
    const {
        pendingDebts,
        pendingCredits,
        loading: txLoading,
        settleDebt,
        refetch: refetchTx,
    } = useTransactions(groupId);

    const [showFailureModal, setShowFailureModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [settlingId, setSettlingId] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            refetchGroup();
            refetchTx();
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([refetchGroup(), refetchTx()]);
        setRefreshing(false);
    };

    const handleLogFailure = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setShowFailureModal(true);
    };

    const handleFailureLogged = async () => {
        setShowFailureModal(false);
        await Promise.all([refetchGroup(), refetchTx()]);
    };

    const handleSettleDebt = async (transactionId: string) => {
        try {
            setSettlingId(transactionId);
            await settleDebt(transactionId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Settled!', 'The debt has been marked as paid.');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSettlingId(null);
        }
    };

    const handleShareInvite = async () => {
        if (!group) return;
        try {
            await Share.share({
                message: `Join my accountability group "${group.name}" on Social Ledger!\n\nInvite code: ${group.invite_code}`,
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    const formatBalance = (balance: number) => {
        return `€${Math.abs(balance).toFixed(2)}`;
    };

    const getBalanceColor = (balance: number) => {
        if (balance > 0) return colors.success;
        if (balance < 0) return colors.error;
        return colors.textMuted;
    };

    if (groupLoading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!group) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Group not found</Text>
            </View>
        );
    }

    // Get current user's member data
    const currentMember = members.find((m) => m.user_id === user?.id);
    const otherMembers = members.filter((m) => m.user_id !== user?.id);

    return (
        <View style={styles.container}>
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
                {/* Group Header */}
                <View style={styles.header}>
                    <View style={styles.titleRow}>
                        <Text style={styles.groupName}>
                            {group.name}
                        </Text>
                        <TouchableOpacity
                            onPress={handleShareInvite}
                            style={styles.inviteButton}
                        >
                            <Text style={styles.inviteButtonText}>Invite</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.penaltyText}>
                        Penalty: €{group.default_penalty_amount.toFixed(2)} per failure
                    </Text>
                    <View style={styles.codeContainer}>
                        <Text style={styles.codeLabel}>
                            Invite code: <Text style={styles.codeValue}>{group.invite_code}</Text>
                        </Text>
                    </View>
                </View>

                {/* Your Balance in Group */}
                <View style={styles.myBalanceCard}>
                    <Text style={styles.balanceLabel}>Your balance in this group</Text>
                    <Text
                        style={[
                            styles.balanceAmount,
                            { color: getBalanceColor(currentMember?.current_balance || 0) }
                        ]}
                    >
                        {(currentMember?.current_balance || 0) >= 0 ? '+' : ''}
                        {formatBalance(currentMember?.current_balance || 0)}
                    </Text>
                    <Text style={styles.failureCount}>
                        Failures logged: {currentMember?.failure_count || 0}
                    </Text>
                </View>

                {/* Shame Leaderboard */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>
                        🏆 Shame Leaderboard
                    </Text>
                    {members.length === 0 ? (
                        <Text style={styles.emptyText}>No members yet</Text>
                    ) : (
                        members.map((member, index) => {
                            const isCurrentUser = member.user_id === user?.id;
                            return (
                                <View
                                    key={member.id}
                                    style={[
                                        styles.memberRow,
                                        isCurrentUser && styles.currentUserRow
                                    ]}
                                >
                                    <Text style={styles.rankEmoji}>
                                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                                    </Text>
                                    <View style={styles.memberInfo}>
                                        <Text style={[
                                            styles.memberName,
                                            isCurrentUser && styles.currentUserText
                                        ]}>
                                            {member.profile?.name || 'Unknown'} {isCurrentUser && '(You)'}
                                        </Text>
                                        <Text style={styles.memberFailures}>
                                            {member.failure_count} failure{member.failure_count !== 1 ? 's' : ''}
                                        </Text>
                                    </View>
                                    <Text
                                        style={[
                                            styles.memberBalance,
                                            { color: getBalanceColor(member.current_balance) }
                                        ]}
                                    >
                                        {member.current_balance >= 0 ? '+' : ''}{formatBalance(member.current_balance)}
                                    </Text>
                                </View>
                            );
                        })
                    )}
                </View>

                {/* Debts You Owe */}
                {pendingDebts.length > 0 && (
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionTitle}>
                            💸 You Owe
                        </Text>
                        {pendingDebts.map((tx) => (
                            <View
                                key={tx.id}
                                style={styles.debtCard}
                            >
                                <View style={styles.debtInfo}>
                                    <Text style={styles.debtName}>
                                        {tx.to_user?.name || 'Unknown'}
                                    </Text>
                                    <Text style={styles.debtDescription}>
                                        {tx.description || 'Logged failure'}
                                    </Text>
                                </View>
                                <Text style={styles.debtAmount}>
                                    €{tx.amount.toFixed(2)}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Credits Owed to You */}
                {pendingCredits.length > 0 && (
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionTitle}>
                            💰 Owed to You
                        </Text>
                        {pendingCredits.map((tx) => (
                            <View
                                key={tx.id}
                                style={styles.creditCard}
                            >
                                <View style={styles.creditInfo}>
                                    <Text style={styles.creditName}>
                                        {tx.from_user?.name || 'Unknown'}
                                    </Text>
                                    <Text style={styles.creditDescription}>
                                        {tx.description || 'Logged failure'}
                                    </Text>
                                </View>
                                <View style={styles.creditAction}>
                                    <Text style={styles.creditAmount}>
                                        €{tx.amount.toFixed(2)}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => handleSettleDebt(tx.id)}
                                        disabled={settlingId === tx.id}
                                        style={styles.settleButton}
                                    >
                                        {settlingId === tx.id ? (
                                            <ActivityIndicator size="small" color={colors.success} />
                                        ) : (
                                            <Text style={styles.settleButtonText}>Settle</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* Big Red Failure Button */}
            <View style={styles.fabContainer}>
                <TouchableOpacity
                    onPress={handleLogFailure}
                    activeOpacity={0.8}
                    style={styles.fabButton}
                >
                    <Text style={styles.fabTitle}>🚨 I FAILED 🚨</Text>
                    <Text style={styles.fabSubtitle}>
                        Creates €{group.default_penalty_amount.toFixed(2)} debt to each member
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Log Failure Modal */}
            <LogFailureModal
                visible={showFailureModal}
                onClose={() => setShowFailureModal(false)}
                onSuccess={handleFailureLogged}
                groupId={groupId}
                groupName={group.name}
                penaltyAmount={group.default_penalty_amount}
                memberCount={otherMembers.length}
            />
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
    errorContainer: {
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    errorText: {
        color: colors.text,
        fontSize: 18,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 140, // Space for FAB
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 16,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    groupName: {
        color: colors.text,
        fontSize: 24,
        fontWeight: 'bold',
        flex: 1,
        marginRight: 12,
    },
    inviteButton: {
        backgroundColor: colors.surface,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    inviteButtonText: {
        color: colors.primary,
        fontWeight: '500',
    },
    penaltyText: {
        color: colors.textMuted,
        fontSize: 14,
    },
    codeContainer: {
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginTop: 12,
        alignSelf: 'flex-start',
    },
    codeLabel: {
        color: colors.textMuted,
        fontSize: 14,
    },
    codeValue: {
        color: colors.primary,
        fontWeight: 'bold',
        fontFamily: 'monospace',
    },
    myBalanceCard: {
        marginHorizontal: 24,
        marginTop: 24,
        backgroundColor: colors.surface,
        borderRadius: 24,
        padding: 20,
    },
    balanceLabel: {
        color: colors.textMuted,
        fontSize: 14,
        marginBottom: 4,
    },
    balanceAmount: {
        fontSize: 32,
        fontWeight: 'bold',
    },
    failureCount: {
        color: colors.textMuted,
        fontSize: 14,
        marginTop: 4,
    },
    sectionContainer: {
        marginTop: 32,
        paddingHorizontal: 24,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    emptyText: {
        color: colors.textMuted,
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 8,
        backgroundColor: colors.surface,
    },
    currentUserRow: {
        backgroundColor: 'rgba(99, 102, 241, 0.1)', // primary with opacity
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.3)',
    },
    rankEmoji: {
        fontSize: 24,
        marginRight: 16,
        width: 30,
        textAlign: 'center',
    },
    memberInfo: {
        flex: 1,
    },
    memberName: {
        fontWeight: '600',
        color: colors.text,
        fontSize: 16,
    },
    currentUserText: {
        color: colors.primary,
    },
    memberFailures: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 2,
    },
    memberBalance: {
        fontWeight: 'bold',
        fontSize: 16,
    },
    debtCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    debtInfo: {
        flex: 1,
    },
    debtName: {
        color: colors.text,
        fontWeight: '500',
        fontSize: 16,
    },
    debtDescription: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 4,
    },
    debtAmount: {
        color: colors.error,
        fontWeight: 'bold',
        fontSize: 18,
        marginRight: 8,
    },
    creditCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    creditInfo: {
        flex: 1,
    },
    creditName: {
        color: colors.text,
        fontWeight: '500',
        fontSize: 16,
    },
    creditDescription: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 4,
    },
    creditAction: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    creditAmount: {
        color: colors.success,
        fontWeight: 'bold',
        fontSize: 18,
        marginRight: 12,
    },
    settleButton: {
        backgroundColor: 'rgba(34, 197, 94, 0.2)', // success with opacity
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        minWidth: 70,
        alignItems: 'center',
    },
    settleButtonText: {
        color: colors.success,
        fontWeight: '600',
        fontSize: 12,
    },
    fabContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    fabButton: {
        backgroundColor: colors.error,
        borderRadius: 16,
        paddingVertical: 20,
        alignItems: 'center',
        shadowColor: colors.error,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    fabTitle: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    fabSubtitle: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 14,
        marginTop: 4,
    },
});
