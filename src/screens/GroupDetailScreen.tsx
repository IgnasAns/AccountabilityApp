import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    Platform,
    StyleSheet,
    LayoutAnimation,
    UIManager,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import { colors } from '../theme/colors';
import { safeHaptics } from '../utils/haptics';
import { useAuth } from '../hooks/useAuth';
import { useGroupDetail, useGroups } from '../hooks/useGroups';
import { useTransactions } from '../hooks/useTransactions';
import { useGoals, AutoFailureInfo } from '../hooks/useGoals';
import { StyledAlert } from '../components/StyledAlert';
import Leaderboard from '../components/Leaderboard';
import ActivityFeed from '../components/ActivityFeed';
import ConfirmModal from '../components/ConfirmModal';
import InviteCodeModal from '../components/InviteCodeModal';
import DashboardTab from '../components/group/DashboardTab';
import BalancesTab from '../components/group/BalancesTab';
import SettingsTab from '../components/group/SettingsTab';
import GroupDetailHeader, { TabOption } from '../components/group/GroupDetailHeader';
import GroupDetailModals from '../components/group/GroupDetailModals';
import { SkeletonGoalCard, SkeletonMemberRow } from '../components/Skeleton';
import { GroupMemberWithProfile, ActivityLogWithProfile } from '../types/database';
import { supabase } from '../services/supabase';

// Enable layout animation for Android
if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

type RootStackParamList = {
    GroupDetail: { groupId: string; showInviteModal?: boolean };
    GroupChat: { groupId: string; groupName: string };
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
        settleDebt,
        refetch: refetchTx,
    } = useTransactions(groupId);
    const { refetch: refetchGoals } = useGoals(groupId);

    const [activeTab, setActiveTab] = useState<TabOption>('dashboard');
    const [refreshing, setRefreshing] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showFailureModal, setShowFailureModal] = useState(false);
    const [settlingId, setSettlingId] = useState<string | null>(null);
    const [selectedMember, setSelectedMember] = useState<GroupMemberWithProfile | null>(null);
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<ActivityLogWithProfile | null>(null);
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [showSettleConfirm, setShowSettleConfirm] = useState(false);
    const [pendingSettleId, setPendingSettleId] = useState<string | null>(null);
    const [showInviteModal, setShowInviteModal] = useState(false);

    // Only surface the invite-code modal once per navigation, right after the
    // group is created. The ref guards against re-showing on every mount, and
    // the param is cleared so it never re-triggers.
    const inviteModalShownRef = useRef(false);

    useEffect(() => {
        if (route.params?.showInviteModal && !inviteModalShownRef.current) {
            inviteModalShownRef.current = true;
            setShowInviteModal(true);
            navigation.setParams({ showInviteModal: undefined });
        }
    }, [route.params?.showInviteModal, navigation]);

    // Auto-failure feedback: process_overdue_goals logged missed deadlines for
    // the current user. GoalsSection reports it up (once per session), and we
    // offer a one-tap jump to the ledger.
    const handleAutoFailures = useCallback((info: AutoFailureInfo) => {
        if (info.count <= 0) return;
        const message = `${info.count} missed deadline${info.count !== 1 ? 's' : ''} were logged — you owe €${info.totalPenalty.toFixed(2)}. Tap to see the ledger`;
        StyledAlert.alert('Auto-failure ⏰', message, [
            {
                text: 'View Ledger',
                onPress: () => {
                    safeHaptics('light');
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setActiveTab('balances');
                },
            },
            { text: 'Later', style: 'cancel' },
        ]);
    }, []);

    // Refresh on focus
    useFocusEffect(
        useCallback(() => {
            onRefresh();
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        safeHaptics('light');
        await Promise.all([refetchGroup(), refetchTx(), refetchGoals()]);
        setRefreshing(false);
    };

    const handleShareInvite = async () => {
        if (!group) return;
        try {
            const message = `Join my accountability group "${group.name}" on "Do It Mate!"\nUse code: ${group.invite_code}\n\nOr tap to join instantly: doitmate://join?code=${group.invite_code}`;
            await Share.share({ message, title: 'Join Group' });
        } catch {
            // User cancelled or error
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
        } catch (error: unknown) {
            StyledAlert.alert('Error', (error instanceof Error ? error.message : "An error occurred"));
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
        } catch (error: unknown) {
            StyledAlert.alert('Error', (error instanceof Error ? error.message : "An error occurred"));
        } finally {
            setIsDeleting(false);
            setShowLeaveModal(false);
        }
    };

    const handleFailureLogged = async () => {
        setShowFailureModal(false);
        onRefresh();
    };

    const handleSettleDebt = async (transactionId: string) => {
        // Show confirmation dialog first
        setPendingSettleId(transactionId);
        setShowSettleConfirm(true);
    };

    const confirmSettleDebt = async () => {
        if (!pendingSettleId) return;

        setSettlingId(pendingSettleId);
        setShowSettleConfirm(false);
        safeHaptics('selection');
        try {
            await settleDebt(pendingSettleId);
            safeHaptics('success');
            refetchTx();
        } catch (error: unknown) {
            StyledAlert.alert('Error', (error instanceof Error ? error.message : "An error occurred"));
        } finally {
            setSettlingId(null);
            setPendingSettleId(null);
        }
    };

    const handleMemberPress = (member: GroupMemberWithProfile) => {
        safeHaptics('selection');
        setSelectedMember(member);
        setShowMemberModal(true);
    };

    const handleMemberIdPress = (userId: string) => {
        const member = members.find(m => m.user_id === userId);
        if (member) handleMemberPress(member);
    };

    const handleNudge = async (member: GroupMemberWithProfile) => {
        if (!member.user_id || member.user_id === user?.id) return;
        safeHaptics('selection');
        try {
            const { error } = await supabase.from('messages').insert({
                group_id: groupId,
                user_id: user?.id,
                content: `👋 Nudge to @${member.profile?.name || 'there'}!`,
                message_type: 'text',
            });
            if (error) throw error;
            StyledAlert.alert('Nudge Sent', `You nudged ${member.profile?.name}!`);
        } catch {
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

    // Loading state
    if (groupLoading) {
        return (
            <View style={[styles.container, { paddingTop: insets.top + 60 }]}>
                <ScrollView contentContainerStyle={{ padding: 16 }}>
                    <SkeletonGoalCard />
                    <SkeletonMemberRow />
                    <SkeletonMemberRow />
                    <SkeletonMemberRow />
                </ScrollView>
            </View>
        );
    }

    if (!group) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorEmoji}>🔍</Text>
                <Text style={styles.errorTitle}>Group not found</Text>
                <Text style={styles.errorSubtitle}>This group may have been deleted or you were removed.</Text>
            </View>
        );
    }

    const currentMember = members.find((m) => m.user_id === user?.id);
    const isCreator = group.created_by === user?.id;
    const hasBalance = Math.abs(currentMember?.current_balance || 0) > 0.01;

    return (
        <View style={styles.container}>
            <GroupDetailHeader
                groupName={group.name}
                activeTab={activeTab}
                onBack={() => navigation.goBack()}
                onTabChange={handleTabChange}
                onOpenChat={handleOpenChat}
                onShareInvite={handleShareInvite}
            />

            {/* Content */}
            <ScrollView
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
                    />
                }
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {activeTab === 'dashboard' && (
                    <DashboardTab
                        groupId={groupId}
                        group={group}
                        currentBalance={currentMember?.current_balance || 0}
                        members={members}
                        onMemberPress={handleMemberIdPress}
                        onLogFailure={() => setShowFailureModal(true)}
                        onShareInvite={handleShareInvite}
                        onAutoFailures={handleAutoFailures}
                    />
                )}

                {activeTab === 'leaderboard' && (
                    <View style={styles.tabContent}>
                        <Leaderboard groupId={groupId} onMemberPress={handleMemberIdPress} />
                    </View>
                )}

                {activeTab === 'activity' && (
                    <View style={styles.tabContent}>
                        <ActivityFeed
                            groupId={groupId}
                            showHeader={false}
                            onActivityPress={handleActivityPress}
                        />
                    </View>
                )}

                {activeTab === 'balances' && (
                    <BalancesTab
                        pendingDebts={pendingDebts}
                        pendingCredits={pendingCredits}
                        members={members}
                        currentUserId={user?.id || ''}
                        groupCreatorId={group.created_by}
                        settlingId={settlingId}
                        onSettleDebt={handleSettleDebt}
                        onMemberPress={handleMemberPress}
                        onNudge={handleNudge}
                    />
                )}

                {activeTab === 'settings' && (
                    <SettingsTab
                        inviteCode={group.invite_code}
                        isCreator={isCreator}
                        hasBalance={hasBalance}
                        onCopyCode={handleCopyCode}
                        onShareInvite={handleShareInvite}
                        onLeaveGroup={() => setShowLeaveModal(true)}
                        onDeleteGroup={() => setShowDeleteModal(true)}
                    />
                )}
            </ScrollView>

            {/* Modals - extracted component */}
            <GroupDetailModals
                showFailureModal={showFailureModal}
                onFailureClose={() => setShowFailureModal(false)}
                onFailureSuccess={handleFailureLogged}
                groupId={groupId}
                groupName={group.name}
                penaltyAmount={group.default_penalty_amount}
                memberCount={Math.max(members.length - 1, 0)}
                showDeleteModal={showDeleteModal}
                onDeleteConfirm={handleDeleteGroup}
                onDeleteCancel={() => setShowDeleteModal(false)}
                isDeleting={isDeleting}
                showLeaveModal={showLeaveModal}
                onLeaveConfirm={handleLeaveGroup}
                onLeaveCancel={() => setShowLeaveModal(false)}
                showMemberModal={showMemberModal}
                selectedMember={selectedMember}
                onMemberClose={() => setShowMemberModal(false)}
                currentUserId={user?.id || ''}
                groupCreatorId={group.created_by}
                showCompletionModal={showCompletionModal}
                selectedActivity={selectedActivity}
                onCompletionClose={() => setShowCompletionModal(false)}
            />

            {/* Settle Debt Confirmation */}
            <ConfirmModal
                visible={showSettleConfirm}
                title="Confirm Payment?"
                message="Did you receive the payment? This will mark the debt as settled and update balances."
                confirmText="Yes, Payment Received"
                confirmStyle="primary"
                onConfirm={confirmSettleDebt}
                onCancel={() => { setShowSettleConfirm(false); setPendingSettleId(null); }}
            />

            {/* Invite Code Modal — shown once right after the group is created */}
            <InviteCodeModal
                visible={showInviteModal}
                inviteCode={group.invite_code}
                groupName={group.name}
                onClose={() => setShowInviteModal(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    errorEmoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    errorTitle: {
        color: colors.text,
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 8,
    },
    errorSubtitle: {
        color: colors.textMuted,
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    content: {
        paddingBottom: 40,
    },
    tabContent: {
        flex: 1,
        minHeight: 400,
    },
});
