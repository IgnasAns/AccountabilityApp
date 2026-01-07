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
    Image,
    LayoutAnimation,
    UIManager,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { colors } from '../theme/colors';
import { safeHaptics } from '../utils/haptics';
import { useAuth } from '../hooks/useAuth';
import { useGroupDetail, useGroups } from '../hooks/useGroups';
import { useTransactions } from '../hooks/useTransactions';
import LogFailureModal from '../components/LogFailureModal';
import ConfirmModal from '../components/ConfirmModal';
import ProofPhotoViewer from '../components/ProofPhotoViewer';
import GoalsSection from '../components/GoalsSection';
import Leaderboard from '../components/Leaderboard';
import ActivityFeed from '../components/ActivityFeed';
import { StyledAlert } from '../components/StyledAlert';
import { useGoals } from '../hooks/useGoals';
import MemberDetailModal from '../components/MemberDetailModal';
import GoalCompletionDetailModal from '../components/GoalCompletionDetailModal';
import { GroupMemberWithProfile, ActivityLogWithProfile } from '../types/database';
import { supabase } from '../services/supabase';

// Enable layout animation for Android
if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

type RootStackParamList = {
    GroupDetail: { groupId: string };
    GroupChat: { groupId: string; groupName: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;

type TabOption = 'dashboard' | 'leaderboard' | 'activity' | 'members' | 'settings';

export default function GroupDetailScreen({ navigation, route }: Props) {
    const { groupId } = route.params;
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const { group, members, loading: groupLoading, refetch: refetchGroup } = useGroupDetail(groupId);
    const { deleteGroup, leaveGroup, updateGroup } = useGroups();
    const {
        pendingDebts,
        pendingCredits,
        loading: txLoading,
        settleDebt,
        refetch: refetchTx
    } = useTransactions(groupId);
    const { goals, loading: goalsLoading, refetch: refetchGoals } = useGoals(groupId);

    const [activeTab, setActiveTab] = useState<TabOption>('dashboard');
    const [refreshing, setRefreshing] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showFailureModal, setShowFailureModal] = useState(false);
    const [settlingId, setSettlingId] = useState<string | null>(null);

    // Member detail modal
    const [selectedMember, setSelectedMember] = useState<GroupMemberWithProfile | null>(null);
    const [showMemberModal, setShowMemberModal] = useState(false);

    // Goal Completion Detail Modal
    const [selectedActivity, setSelectedActivity] = useState<ActivityLogWithProfile | null>(null);
    const [showCompletionModal, setShowCompletionModal] = useState(false);

    useFocusEffect(
        useCallback(() => {
            onRefresh();
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        safeHaptics('light');
        await Promise.all([
            refetchGroup(),
            refetchTx(),
            refetchGoals()
        ]);
        setRefreshing(false);
    };

    const handleShareInvite = async () => {
        if (!group) return;
        try {
            const message = `Join my accountability group "${group.name}" on HabitFlow!\nUse code: ${group.invite_code}`;
            await Share.share({
                message,
                title: 'Join Group',
            });
        } catch (error) {
            console.error(error);
        }
    };

    const handleCopyCode = async () => {
        if (!group) return;
        await Clipboard.setStringAsync(group.invite_code);
        safeHaptics('success');
        StyledAlert.alert('Copied! 📋', 'Invite code copied to clipboard');
    };

    const handleOpenChat = () => {
        if (!group) return;
        safeHaptics('light');
        navigation.navigate('GroupChat', { groupId: group.id, groupName: group.name });
    };

    const handleTabChange = (tab: TabOption) => {
        safeHaptics('light');
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setActiveTab(tab);
    };

    const handleDeleteGroup = async () => {
        setIsDeleting(true);
        try {
            await deleteGroup(groupId);
            safeHaptics('success');
            navigation.goBack();
        } catch (error: any) {
            StyledAlert.alert('Error', error.message);
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    const handleLeaveGroup = async () => {
        setIsDeleting(true);
        try {
            await leaveGroup(groupId);
            safeHaptics('success');
            navigation.goBack();
        } catch (error: any) {
            StyledAlert.alert('Error', error.message);
        } finally {
            setIsDeleting(false);
            setShowLeaveModal(false);
        }
    };

    const handleLogFailure = () => {
        safeHaptics('light');
        setShowFailureModal(true);
    };

    const handleFailureLogged = async () => {
        setShowFailureModal(false);
        // Refresh everything to show new penalties
        onRefresh();

        // Switch to Balances tab so user can see the new debt
        // setActiveTab('members'); 
    };

    const handleSettleDebt = async (transactionId: string) => {
        setSettlingId(transactionId);
        safeHaptics('selection');
        try {
            await settleDebt(transactionId);
            safeHaptics('success');
            refetchTx();
        } catch (error: any) {
            StyledAlert.alert('Error', error.message);
        } finally {
            setSettlingId(null);
        }
    };

    const formatBalance = (amount: number) => {
        return `€${Math.abs(amount).toFixed(2)}`;
    };

    const getBalanceColor = (amount: number) => {
        if (amount > 0) return colors.success;
        if (amount < 0) return colors.error;
        return colors.textMuted;
    };

    const handleMemberPress = (member: GroupMemberWithProfile) => {
        console.log('Member pressed:', member.user_id);
        safeHaptics('selection');
        setSelectedMember(member);
        setShowMemberModal(true);
    };

    const handleMemberIdPress = (userId: string) => {
        const member = members.find(m => m.user_id === userId);
        if (member) {
            handleMemberPress(member);
        }
    };

    const handleNudge = async (member: GroupMemberWithProfile) => {
        console.log('Nudging member:', member.user_id);
        if (!member.user_id || member.user_id === user?.id) return;

        safeHaptics('selection');
        try {
            const { error } = await supabase.from('messages').insert({
                group_id: groupId,
                user_id: user?.id,
                content: `👋 Nudge to @${member.profile.name}!`,
                message_type: 'text'
            });

            if (error) throw error;
            StyledAlert.alert('Nudge Sent', `You nudged ${member.profile.name}!`);
        } catch (err) {
            console.error(err);
            StyledAlert.alert('Error', 'Failed to send nudge');
        }
    };

    const handleActivityPress = (activity: ActivityLogWithProfile) => {
        if (activity.event_type === 'goal_completed' && activity.related_id) {
            safeHaptics('light');
            setSelectedActivity(activity);
            setShowCompletionModal(true);
        }
    };

    if (groupLoading) {
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

    const currentMember = members.find((m) => m.user_id === user?.id);
    const otherMembers = members.filter((m) => m.user_id !== user?.id);
    const isCreator = group.created_by === user?.id;

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                {/* Top Nav Row */}
                <View style={styles.topNav}>
                    {/* <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backIcon}>←</Text>
                    </TouchableOpacity> */}
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{group.name}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={handleOpenChat} style={styles.shareButton}>
                            <Text style={styles.shareIcon}>💬</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleShareInvite} style={styles.shareButton}>
                            <Text style={styles.shareIcon}>📤</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Tabs */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.tabsScroll}
                    contentContainerStyle={styles.tabsContainer}
                >
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'dashboard' && styles.activeTab]}
                        onPress={() => handleTabChange('dashboard')}
                    >
                        <Text style={[styles.tabText, activeTab === 'dashboard' && styles.activeTabText]}>Dashboard</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'leaderboard' && styles.activeTab]}
                        onPress={() => handleTabChange('leaderboard')}
                    >
                        <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.activeTabText]}>Leaderboard</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'activity' && styles.activeTab]}
                        onPress={() => handleTabChange('activity')}
                    >
                        <Text style={[styles.tabText, activeTab === 'activity' && styles.activeTabText]}>Activity</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'members' && styles.activeTab]}
                        onPress={() => handleTabChange('members')}
                    >
                        <Text style={[styles.tabText, activeTab === 'members' && styles.activeTabText]}>Balances</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'settings' && styles.activeTab]}
                        onPress={() => handleTabChange('settings')}
                    >
                        <Text style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>Settings</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* DASHBOARD TAB */}
                {activeTab === 'dashboard' && (
                    <>
                        {/* Penalty Card */}
                        <View style={styles.penaltyCard}>
                            <View>
                                <Text style={styles.penaltyLabel}>Current Penalty</Text>
                                <Text style={styles.penaltyValue}>€{group.default_penalty_amount.toFixed(2)}</Text>
                            </View>
                            <View style={styles.verticalDivider} />
                            <View>
                                <Text style={styles.penaltyLabel}>Your Balance</Text>
                                <Text style={[styles.penaltyValue, { color: getBalanceColor(currentMember?.current_balance || 0) }]}>
                                    {(currentMember?.current_balance || 0) >= 0 ? '+' : ''}{formatBalance(currentMember?.current_balance || 0)}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.paddedSection}>
                            <GoalsSection
                                groupId={groupId}
                                groupName={group.name}
                                defaultPenalty={group.default_penalty_amount}
                                groupMembers={members.map(m => ({ id: m.user_id, name: m.profile?.name || 'Unknown' }))}
                                onMemberPress={handleMemberIdPress}
                            />
                        </View>
                    </>
                )}

                {/* LEADERBOARD TAB */}
                {activeTab === 'leaderboard' && (
                    <View style={styles.tabContent}>
                        <Leaderboard groupId={groupId} onMemberPress={handleMemberIdPress} />
                    </View>
                )}

                {/* ACTIVITY TAB */}
                {activeTab === 'activity' && (
                    <View style={styles.tabContent}>
                        <ActivityFeed
                            groupId={groupId}
                            showHeader={false}
                            onActivityPress={handleActivityPress}
                        />
                    </View>
                )}

                {/* MEMBERS & BALANCES TAB */}
                {activeTab === 'members' && (
                    <>
                        {/* Debts You Owe */}
                        {pendingDebts.length > 0 && (
                            <View style={styles.sectionContainer}>
                                <Text style={styles.sectionTitle}>💸 You Owe</Text>
                                {pendingDebts.map((tx) => (
                                    <View key={tx.id} style={styles.debtCard}>
                                        <View style={styles.debtInfo}>
                                            <TouchableOpacity onPress={() => handleMemberIdPress(tx.to_user_id)}>
                                                <Text style={styles.debtName}>{tx.to_user?.name || 'Unknown'}</Text>
                                            </TouchableOpacity>
                                            <Text style={styles.debtDescription}>{tx.description || 'Logged failure'}</Text>
                                        </View>
                                        <Text style={styles.debtAmount}>€{tx.amount.toFixed(2)}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Credits Owed to You */}
                        {pendingCredits.length > 0 && (
                            <View style={styles.sectionContainer}>
                                <Text style={styles.sectionTitle}>💰 Owed to You</Text>
                                {pendingCredits.map((tx) => (
                                    <View key={tx.id} style={styles.creditCard}>
                                        <View style={styles.creditInfo}>
                                            <TouchableOpacity onPress={() => handleMemberIdPress(tx.from_user_id)}>
                                                <Text style={styles.creditName}>{tx.from_user?.name || 'Unknown'}</Text>
                                            </TouchableOpacity>
                                            <Text style={styles.creditDescription}>{tx.description || 'Logged failure'}</Text>
                                        </View>
                                        <View style={styles.creditAction}>
                                            <Text style={styles.creditAmount}>€{tx.amount.toFixed(2)}</Text>
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

                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionTitle}>All Members</Text>
                            <View style={styles.membersList}>
                                {members.map((member) => (
                                    <View key={member.id} style={styles.memberRowContainer}>
                                        <TouchableOpacity
                                            style={styles.memberRow}
                                            onPress={() => handleMemberPress(member)}
                                            activeOpacity={0.7}
                                        >
                                            {member.profile?.avatar_url ? (
                                                <Image source={{ uri: member.profile.avatar_url }} style={styles.memberAvatar} />
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
                                                    {member.user_id === user?.id && ' (You)'}
                                                    {group.created_by === member.user_id && ' 👑'}
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
                                        {member.user_id !== user?.id && (
                                            <TouchableOpacity
                                                style={styles.nudgeButton}
                                                onPress={() => handleNudge(member)}
                                            >
                                                <Text style={styles.nudgeIcon}>👋</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}
                            </View>
                        </View>
                    </>
                )}

                {/* SETTINGS TAB */}
                {activeTab === 'settings' && (
                    <View style={styles.sectionContainer}>
                        <View style={styles.inviteCard}>
                            <Text style={styles.inviteLabel}>Invite Code</Text>
                            <TouchableOpacity style={styles.codeContainer} onPress={handleCopyCode}>
                                <Text style={styles.codeText}>{group.invite_code}</Text>
                                <Text style={styles.copyIcon}>📋</Text>
                            </TouchableOpacity>
                            <Text style={styles.inviteHint}>Tap code to copy</Text>
                        </View>

                        <View style={styles.settingsGroup}>
                            <Text style={styles.settingsTitle}>Danger Zone</Text>
                            <TouchableOpacity
                                style={[styles.leaveButton, { opacity: currentMember?.current_balance !== 0 ? 0.6 : 1 }]}
                                onPress={() => {
                                    const balance = currentMember?.current_balance || 0;
                                    if (Math.abs(balance) > 0.01) { // Use small epsilon for float comparison
                                        const msg = balance < 0
                                            ? `You owe €${Math.abs(balance).toFixed(2)}. Please settle your debts before leaving.`
                                            : `You have a surplus of €${balance.toFixed(2)}. Please settle your balance before leaving.`;
                                        StyledAlert.alert('Cannot Leave', msg);
                                        return;
                                    }
                                    setShowLeaveModal(true);
                                }}
                            >
                                <Text style={styles.leaveButtonText}>Leave Group</Text>
                            </TouchableOpacity>

                            {isCreator && (
                                <TouchableOpacity
                                    style={styles.deleteButton}
                                    onPress={() => setShowDeleteModal(true)}
                                >
                                    <Text style={styles.deleteButtonText}>Delete Group</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Log Failure Trigger Button (only visible on dashboard) */}
            {activeTab === 'dashboard' && (
                <TouchableOpacity
                    style={styles.fab}
                    onPress={handleLogFailure}
                    activeOpacity={0.8}
                >
                    <Text style={styles.fabIcon}>💸</Text>
                    <Text style={styles.fabText}>Log Failure</Text>
                </TouchableOpacity>
            )}

            {/* Modals */}
            <LogFailureModal
                visible={showFailureModal}
                onClose={() => setShowFailureModal(false)}
                onSuccess={handleFailureLogged}
                groupId={groupId}
                groupName={group.name}
                penaltyAmount={group.default_penalty_amount}
                memberCount={members.length}
            />

            <ConfirmModal
                visible={showDeleteModal}
                title="Delete Group"
                message="Are you sure you want to delete this group? This action cannot be undone and all data will be lost."
                confirmText="Delete"
                onConfirm={handleDeleteGroup}
                onCancel={() => setShowDeleteModal(false)}
                loading={isDeleting}
                confirmStyle="danger"
            />

            <ConfirmModal
                visible={showLeaveModal}
                title="Leave Group"
                message="Are you sure you want to leave this group? Your balance should be settled before leaving."
                confirmText="Leave"
                onConfirm={handleLeaveGroup}
                onCancel={() => setShowLeaveModal(false)}
                loading={isDeleting}
                confirmStyle="danger"
            />

            <MemberDetailModal
                visible={showMemberModal}
                member={selectedMember}
                onClose={() => setShowMemberModal(false)}
                isCurrentUser={selectedMember?.user_id === user?.id}
                groupCreatorId={group.created_by}
            />

            <GoalCompletionDetailModal
                visible={showCompletionModal}
                activityItem={selectedActivity}
                onClose={() => setShowCompletionModal(false)}
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
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: colors.text,
        fontSize: 16,
    },
    header: {
        backgroundColor: colors.background,
        paddingBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        zIndex: 10,
    },
    topNav: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 16,
        height: 44,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        backgroundColor: colors.surface,
    },
    backIcon: {
        fontSize: 24,
        color: colors.text,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
        marginHorizontal: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.text,
    },
    shareButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        backgroundColor: colors.surfaceHighlight,
    },
    shareIcon: {
        fontSize: 20,
    },
    tabsScroll: {
        maxHeight: 50,
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingBottom: 12,
        gap: 12,
    },
    tab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    activeTab: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textMuted,
    },
    activeTabText: {
        color: '#fff',
    },
    content: {
        paddingBottom: 40,
    },
    tabContent: {
        flex: 1,
        minHeight: 400,
    },
    penaltyCard: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        margin: 16,
        padding: 20,
        borderRadius: 20,
        justifyContent: 'space-around',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    verticalDivider: {
        width: 1,
        height: 40,
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
    paddedSection: {
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    sectionContainer: {
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
    membersList: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 8,
    },
    memberRowContainer: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    memberRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    nudgeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    nudgeIcon: {
        fontSize: 18,
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
    arrowIcon: {
        fontSize: 18,
        color: colors.textMuted,
    },
    inviteCard: {
        backgroundColor: colors.surfaceHighlight,
        padding: 24,
        borderRadius: 20,
        alignItems: 'center',
        marginBottom: 32,
        borderWidth: 2,
        borderColor: colors.primary,
        borderStyle: 'dashed',
    },
    inviteLabel: {
        fontSize: 14,
        color: colors.textMuted,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    codeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 12,
    },
    codeText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: 2,
    },
    copyIcon: {
        fontSize: 20,
    },
    inviteHint: {
        marginTop: 12,
        fontSize: 12,
        color: colors.textMuted,
    },
    settingsGroup: {
        marginTop: 16,
        gap: 12,
    },
    settingsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.error,
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    leaveButton: {
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
    },
    leaveButtonText: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '500',
    },
    deleteButton: {
        backgroundColor: colors.error + '10',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.error,
        alignItems: 'center',
    },
    deleteButtonText: {
        color: colors.error,
        fontSize: 16,
        fontWeight: '600',
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 30,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    fabIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    fabText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
