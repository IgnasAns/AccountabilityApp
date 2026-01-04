import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Share,
    Platform,
    StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../hooks/useAuth';
import { useGroupDetail, useGroups } from '../hooks/useGroups';
import { useTransactions } from '../hooks/useTransactions';
import LogFailureModal from '../components/LogFailureModal';
import ConfirmModal from '../components/ConfirmModal';
import ProofPhotoViewer from '../components/ProofPhotoViewer';
import GoalsSection from '../components/GoalsSection';
import { StyledAlert } from '../components/StyledAlert';
import { colors } from '../theme/colors';

type RootStackParamList = {
    GroupDetail: { groupId: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;

export default function GroupDetailScreen({ navigation, route }: Props) {
    const { groupId } = route.params;
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const { group, members, loading: groupLoading, refetch: refetchGroup } = useGroupDetail(groupId);
    const { deleteGroup, leaveGroup } = useGroups();
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
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const isCreator = group?.created_by === user?.id;

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

    // Safe haptics helper (no-op on web)
    const safeHaptics = (type: 'success' | 'warning' | 'error' | 'impact') => {
        if (Platform.OS === 'web') return;
        try {
            if (type === 'success') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else if (type === 'warning') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } else if (type === 'error') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } else {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            }
        } catch (e) {
            // Ignore haptics errors
        }
    };

    const handleLogFailure = () => {
        safeHaptics('impact');
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
            safeHaptics('success');
            // Immediately refresh data
            await Promise.all([refetchGroup(), refetchTx()]);
            StyledAlert.alert('Settled!', 'The debt has been marked as paid.');
        } catch (error: any) {
            StyledAlert.alert('Error', error.message);
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


    const handleDeleteGroup = async () => {
        try {
            setIsDeleting(true);
            await deleteGroup(groupId);
            safeHaptics('success');
            setShowDeleteModal(false);
            // Reset navigation to go back to main screen
            navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs' as any }],
            });
        } catch (error: any) {
            console.error('Delete group error:', error);
            StyledAlert.alert('Error', error.message || 'Failed to delete group');
            setIsDeleting(false);
        }
    };

    const handleLeaveGroup = async () => {
        try {
            setIsDeleting(true);
            await leaveGroup(groupId);
            safeHaptics('success');
            setShowLeaveModal(false);
            navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs' as any }],
            });
        } catch (error: any) {
            console.error('Leave group error:', error);
            StyledAlert.alert('Error', error.message || 'Failed to leave group');
            setIsDeleting(false);
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
                        <View style={styles.headerButtons}>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('GroupChat' as any, {
                                    groupId: groupId,
                                    groupName: group.name
                                })}
                                style={styles.chatButton}
                            >
                                <Text style={styles.chatButtonText}>💬</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleShareInvite}
                                style={styles.inviteButton}
                            >
                                <Text style={styles.inviteButtonText}>📤 Share</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <Text style={styles.penaltyText}>
                        💰 Penalty: €{group.default_penalty_amount.toFixed(2)} per failure
                    </Text>
                    <TouchableOpacity
                        style={styles.codeContainer}
                        onPress={async () => {
                            try {
                                await Clipboard.setStringAsync(group.invite_code);
                                safeHaptics('success');
                                StyledAlert.alert('Copied!', `Invite code "${group.invite_code}" copied to clipboard`);
                            } catch (e) {
                                // Fallback - show code in alert
                                StyledAlert.alert('Invite Code', group.invite_code);
                            }
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.codeLabel}>🔑 Invite Code</Text>
                        <View style={styles.codeRow}>
                            <Text style={styles.codeValue}>
                                {group.invite_code.length > 12
                                    ? group.invite_code.substring(0, 12) + '...'
                                    : group.invite_code}
                            </Text>
                            <Text style={styles.copyHint}>tap to copy</Text>
                        </View>
                    </TouchableOpacity>
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
                                {tx.proof_photo_url && (
                                    <ProofPhotoViewer photoUrl={tx.proof_photo_url} size="medium" />
                                )}
                                <View style={styles.debtInfo}>
                                    <Text style={styles.debtName}>
                                        {tx.to_user?.name || 'Unknown'}
                                    </Text>
                                    <Text style={styles.debtDescription}>
                                        {tx.description || 'Logged failure'}
                                    </Text>
                                    {tx.proof_photo_url && (
                                        <Text style={styles.proofIndicator}>📸 Has proof photo</Text>
                                    )}
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
                                {tx.proof_photo_url && (
                                    <ProofPhotoViewer photoUrl={tx.proof_photo_url} size="medium" />
                                )}
                                <View style={styles.creditInfo}>
                                    <Text style={styles.creditName}>
                                        {tx.from_user?.name || 'Unknown'}
                                    </Text>
                                    <Text style={styles.creditDescription}>
                                        {tx.description || 'Logged failure'}
                                    </Text>
                                    {tx.proof_photo_url && (
                                        <Text style={styles.proofIndicator}>📸 Has proof photo</Text>
                                    )}
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

                {/* Scheduled Goals Section */}
                <View style={styles.sectionContainer}>
                    <GoalsSection
                        groupId={groupId}
                        groupName={group.name}
                        defaultPenalty={group.default_penalty_amount}
                    />
                </View>

                {/* Danger Zone */}
                <View style={styles.dangerZone}>
                    <Text style={styles.dangerTitle}>⚠️ Danger Zone</Text>

                    {isCreator ? (
                        <TouchableOpacity
                            onPress={() => setShowDeleteModal(true)}
                            style={styles.dangerButton}
                        >
                            <Text style={styles.dangerButtonText}>🗑️ Delete Group</Text>
                            <Text style={styles.dangerButtonSubtext}>
                                Permanently delete this group and all data
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <>
                            <TouchableOpacity
                                onPress={() => {
                                    const balance = currentMember?.current_balance || 0;
                                    if (balance !== 0) {
                                        if (balance < 0) {
                                            StyledAlert.alert(
                                                'Cannot Leave Yet',
                                                `You owe €${Math.abs(balance).toFixed(2)} to other members. Please settle your debts before leaving the group.`
                                            );
                                        } else {
                                            StyledAlert.alert(
                                                'Cannot Leave Yet',
                                                `Other members owe you €${balance.toFixed(2)}. Please have them settle their debts before you leave.`
                                            );
                                        }
                                    } else {
                                        setShowLeaveModal(true);
                                    }
                                }}
                                style={[
                                    styles.leaveButton,
                                    currentMember?.current_balance !== 0 && styles.disabledLeaveButton
                                ]}
                            >
                                <Text style={styles.leaveButtonText}>👋 Leave Group</Text>
                                <Text style={styles.leaveButtonSubtext}>
                                    {currentMember?.current_balance !== 0
                                        ? 'Settle all balances first'
                                        : 'Remove yourself from this group'}
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </ScrollView>

            {/* Big Red Failure Button */}
            <View style={[styles.fabContainer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
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

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                visible={showDeleteModal}
                title="Delete Group?"
                message={`Are you sure you want to delete "${group.name}"?\n\nThis will permanently delete all members, transactions, and data. This action cannot be undone.`}
                confirmText={isDeleting ? "Deleting..." : "Delete Group"}
                onConfirm={handleDeleteGroup}
                onCancel={() => setShowDeleteModal(false)}
                confirmStyle="danger"
            />

            {/* Leave Confirmation Modal */}
            <ConfirmModal
                visible={showLeaveModal}
                title="Leave Group?"
                message={`Are you sure you want to leave "${group.name}"?\n\nYour balance and membership will be removed.`}
                confirmText={isDeleting ? "Leaving..." : "Leave Group"}
                onConfirm={handleLeaveGroup}
                onCancel={() => setShowLeaveModal(false)}
                confirmStyle="danger"
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
    headerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    chatButton: {
        backgroundColor: colors.primary,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chatButtonText: {
        fontSize: 18,
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
        marginTop: 4,
    },
    codeContainer: {
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginTop: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    codeLabel: {
        color: colors.textMuted,
        fontSize: 12,
        marginBottom: 4,
    },
    codeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    codeValue: {
        color: colors.primary,
        fontWeight: 'bold',
        fontFamily: 'monospace',
        fontSize: 18,
    },
    copyHint: {
        color: colors.textMuted,
        fontSize: 12,
        marginLeft: 12,
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
    proofIndicator: {
        color: colors.primary,
        fontSize: 11,
        marginTop: 4,
        fontStyle: 'italic',
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
        ...Platform.select({
            ios: {
                shadowColor: colors.error,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
            },
            android: {
                elevation: 8,
                shadowColor: colors.error,
            },
            web: {
                boxShadow: `0px 4px 12px ${colors.error}66`, // 66 = 0.4 opacity
            }
        }),
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
    dangerZone: {
        marginTop: 40,
        marginBottom: 20,
        marginHorizontal: 24,
        padding: 20,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    dangerTitle: {
        color: colors.error,
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 16,
    },
    dangerButton: {
        backgroundColor: colors.error,
        borderRadius: 12,
        padding: 16,
    },
    dangerButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    dangerButtonSubtext: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 12,
        marginTop: 4,
    },
    leaveButton: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.warning,
    },
    leaveButtonText: {
        color: colors.warning,
        fontSize: 16,
        fontWeight: '600',
    },
    leaveButtonSubtext: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 4,
    },
    disabledLeaveButton: {
        opacity: 0.5,
        borderColor: colors.textMuted,
    },
});
