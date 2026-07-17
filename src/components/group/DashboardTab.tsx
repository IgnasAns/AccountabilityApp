import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import GoalsSection from '../GoalsSection';
import { Group, GroupMemberWithProfile } from '../../types/database';
import AppIcon from '../AppIcon';

interface Props {
    groupId: string;
    group: Group;
    currentBalance: number;
    members: GroupMemberWithProfile[];
    onMemberPress: (userId: string) => void;
    onLogFailure: () => void;
}

export default function DashboardTab({
    groupId,
    group,
    currentBalance,
    members,
    onMemberPress,
    onLogFailure,
}: Props) {
    const formatBalance = (amount: number) => {
        return `€${Math.abs(amount).toFixed(2)}`;
    };

    const getBalanceColor = (amount: number) => {
        if (amount > 0) return colors.success;
        if (amount < 0) return colors.error;
        return colors.textMuted;
    };

    const getBalanceLabel = (amount: number) => {
        if (amount > 0) return 'Surplus';
        if (amount < 0) return 'You Owe';
        return 'Settled';
    };

    return (
        <View>
            {/* Penalty & Balance Card */}
            <View style={styles.penaltyCard}>
                <View style={styles.penaltySection}>
                    <Text style={styles.penaltyLabel}>Default Penalty</Text>
                    <Text style={styles.penaltyValue}>
                        €{group.default_penalty_amount.toFixed(2)}
                    </Text>
                    <Text style={styles.penaltyHint}>per failure</Text>
                </View>

                <View style={styles.verticalDivider} />

                <View style={styles.penaltySection}>
                    <Text style={styles.penaltyLabel}>Your Balance</Text>
                    <Text style={[styles.penaltyValue, { color: getBalanceColor(currentBalance) }]}>
                        {currentBalance >= 0 ? '+' : ''}{formatBalance(currentBalance)}
                    </Text>
                    <Text style={[styles.penaltyHint, { color: getBalanceColor(currentBalance) }]}>
                        {getBalanceLabel(currentBalance)}
                    </Text>
                </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActions}>
                <TouchableOpacity style={styles.failureButton} onPress={onLogFailure}>
                    <AppIcon name="cash-minus" size={20} color={colors.error} />
                    <Text style={styles.failureButtonText}>Log Failure</Text>
                </TouchableOpacity>
            </View>

            {/* Goals Section */}
            <GoalsSection
                groupId={groupId}
                groupName={group.name}
                defaultPenalty={group.default_penalty_amount}
                groupMembers={members.map(m => ({
                    id: m.user_id,
                    name: m.profile?.name || 'Unknown',
                }))}
                onMemberPress={onMemberPress}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    penaltyCard: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        marginHorizontal: 16,
        marginTop: 16,
        padding: 20,
        borderRadius: 8,
        justifyContent: 'space-around',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    penaltySection: {
        alignItems: 'center',
        flex: 1,
    },
    verticalDivider: {
        width: 1,
        height: 48,
        backgroundColor: colors.border,
    },
    penaltyLabel: {
        color: colors.textMuted,
        fontSize: 12,
        marginBottom: 4,
        textAlign: 'center',
    },
    penaltyValue: {
        color: colors.text,
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    penaltyHint: {
        color: colors.textMuted,
        fontSize: 11,
        marginTop: 4,
    },
    quickActions: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    failureButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.error + '15',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.error + '30',
    },
    failureButtonIcon: {},
    failureButtonText: {
        color: colors.error,
        fontWeight: '700',
        fontSize: 15,
    },
});
