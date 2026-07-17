import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Image,
} from 'react-native';
import { colors } from '../../theme/colors';
import { TransactionWithProfiles, GroupMemberWithProfile } from '../../types/database';

interface Props {
    pendingDebts: TransactionWithProfiles[];
    pendingCredits: TransactionWithProfiles[];
    members: GroupMemberWithProfile[];
    currentUserId: string;
    groupCreatorId: string;
    settlingId: string | null;
    onSettleDebt: (transactionId: string) => void;
    onMemberPress: (member: GroupMemberWithProfile) => void;
    onNudge: (member: GroupMemberWithProfile) => void;
}

export default function BalancesTab({
    pendingDebts,
    pendingCredits,
    members,
    currentUserId,
    groupCreatorId,
    settlingId,
    onSettleDebt,
    onMemberPress,
    onNudge,
}: Props) {
    const formatBalance = (amount: number) => `€${Math.abs(amount).toFixed(2)}`;

    const getBalanceColor = (amount: number) => {
        if (amount > 0) return colors.success;
        if (amount < 0) return colors.error;
        return colors.textMuted;
    };

    return (
        <View style={styles.container}>
            {/* Debts You Owe */}
            {pendingDebts.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>💸 You Owe</Text>
                    {pendingDebts.map((tx) => (
                        <View key={tx.id} style={styles.debtCard}>
                            <View style={styles.debtInfo}>
                                <Text style={styles.debtName}>
                                    {tx.to_user?.name || 'Unknown'}
                                </Text>
                                <Text style={styles.debtDescription}>
                                    {tx.description || 'Logged failure'}
                                </Text>
                            </View>
                            <Text style={styles.debtAmount}>€{tx.amount.toFixed(2)}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Credits Owed to You */}
            {pendingCredits.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>💰 Owed to You</Text>
                    {pendingCredits.map((tx) => (
                        <View key={tx.id} style={styles.creditCard}>
                            <View style={styles.creditInfo}>
                                <Text style={styles.creditName}>
                                    {tx.from_user?.name || 'Unknown'}
                                </Text>
                                <Text style={styles.creditDescription}>
                                    {tx.description || 'Logged failure'}
                                </Text>
                            </View>
                            <View style={styles.creditAction}>
                                <Text style={styles.creditAmount}>€{tx.amount.toFixed(2)}</Text>
                                <TouchableOpacity
                                    onPress={() => onSettleDebt(tx.id)}
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

            {/* Empty State */}
            {pendingDebts.length === 0 && pendingCredits.length === 0 && (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>✨</Text>
                    <Text style={styles.emptyTitle}>All Settled!</Text>
                    <Text style={styles.emptySubtitle}>
                        No pending debts or credits. Keep up the good work!
                    </Text>
                </View>
            )}

            {/* All Members */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Members</Text>
                <View style={styles.membersList}>
                    {members.map((member) => (
                        <View key={member.id} style={styles.memberRowContainer}>
                            <TouchableOpacity
                                style={styles.memberRow}
                                onPress={() => onMemberPress(member)}
                                activeOpacity={0.7}
                            >
                                {member.profile?.avatar_url ? (
                                    <Image
                                        source={{ uri: member.profile.avatar_url }}
                                        style={styles.memberAvatar}
                                    />
                                ) : (
                                    <View style={styles.memberAvatarPlaceholder}>
                                        <Text style={styles.memberAvatarInitial}>
                                            {member.profile?.name?.charAt(0).toUpperCase() || '?'}
                                        </Text>
                                    </View>
                                )}
                                <View style={styles.memberInfo}>
                                    <Text style={styles.memberName}>
                                        {member.profile?.name || 'Unknown User'}
                                        {member.user_id === currentUserId && ' (You)'}
                                        {groupCreatorId === member.user_id && ' 👑'}
                                    </Text>
                                    <Text style={[
                                        styles.memberBalance,
                                        { color: getBalanceColor(member.current_balance || 0) }
                                    ]}>
                                        {member.current_balance >= 0 ? 'Surplus: ' : 'Owes: '}
                                        {formatBalance(member.current_balance)}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                            {member.user_id !== currentUserId && (
                                <TouchableOpacity
                                    style={styles.nudgeButton}
                                    onPress={() => onNudge(member)}
                                >
                                    <Text style={styles.nudgeIcon}>👋</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    section: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 12,
    },
    debtCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.error + '15',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: colors.error,
    },
    debtInfo: {
        flex: 1,
    },
    debtName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 4,
    },
    debtDescription: {
        fontSize: 13,
        color: colors.textMuted,
    },
    debtAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.error,
    },
    creditCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.success + '15',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: colors.success,
    },
    creditInfo: {
        flex: 1,
    },
    creditName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 4,
    },
    creditDescription: {
        fontSize: 13,
        color: colors.textMuted,
    },
    creditAction: {
        alignItems: 'flex-end',
    },
    creditAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.success,
        marginBottom: 8,
    },
    settleButton: {
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.success,
    },
    settleButtonText: {
        color: colors.success,
        fontSize: 12,
        fontWeight: 'bold',
    },
    emptyState: {
        alignItems: 'center',
        padding: 40,
        margin: 16,
        backgroundColor: colors.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 8,
    },
    emptySubtitle: {
        color: colors.textMuted,
        textAlign: 'center',
        lineHeight: 20,
    },
    membersList: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        overflow: 'hidden',
    },
    memberRowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    memberRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    memberAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    memberAvatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    memberAvatarInitial: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    memberInfo: {
        flex: 1,
    },
    memberName: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
    },
    memberBalance: {
        fontSize: 13,
        marginTop: 2,
    },
    nudgeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    nudgeIcon: {
        fontSize: 18,
    },
});
