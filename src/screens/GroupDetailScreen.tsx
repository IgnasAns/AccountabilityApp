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
import LeaderboardSection from '../components/LeaderboardSection';
import { StyledAlert } from '../components/StyledAlert';
import { useGoals } from '../hooks/useGoals';
import MemberDetailModal from '../components/MemberDetailModal';
import { GroupMemberWithProfile } from '../types/database';

// Enable layout animation for Android
if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

type RootStackParamList = {
    GroupDetail: { groupId: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;

type TabOption = 'dashboard' | 'members' | 'settings';

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
        refetch: refetchTx,
    } = useTransactions(groupId);
    const { goals } = useGoals(groupId);

    const [activeTab, setActiveTab] = useState<TabOption>('dashboard');
    const [showFailureModal, setShowFailureModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [settlingId, setSettlingId] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [selectedMember, setSelectedMember] = useState<GroupMemberWithProfile | null>(null);
    const [showMemberModal, setShowMemberModal] = useState(false);

    const handleMemberPress = useCallback((member: GroupMemberWithProfile) => {
        setSelectedMember(member);
        setShowMemberModal(true);
    }, []);

    const handleMemberIdPress = useCallback((userId: string) => {
        const member = members.find(m => m.user_id === userId);
        if (member) {
            handleMemberPress(member);
        }
    }, [members, handleMemberPress]);

    const isCreator = group?.created_by === user?.id;

    React.useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

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

    // Using centralized haptics utility from utils/haptics.ts

    const handleTabChange = (tab: TabOption) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setActiveTab(tab);
        safeHaptics('heavy');
    };

    const handleLogFailure = () => {
        safeHaptics('heavy');
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
                message: `Join my accountability group "${group.name}" on Accountability App! Code: ${group.invite_code}`,
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
            navigation.reset({ index: 0, routes: [{ name: 'MainTabs' as any }] });
        } catch (error: any) {
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
            navigation.reset({ index: 0, routes: [{ name: 'MainTabs' as any }] });
        } catch (error: any) {
            StyledAlert.alert('Error', error.message || 'Failed to leave group');
            setIsDeleting(false);
        }
    };

    const formatBalance = (balance: number) => `€${Math.abs(balance).toFixed(2)}`;
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

    const currentMember = members.find((m) => m.user_id === user?.id);
    const otherMembers = members.filter((m) => m.user_id !== user?.id);

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                {/* Top Nav Row */}
                <View style={styles.topNav}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backIcon}>←</Text>
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{group.name}</Text>
                    </View>
                    <TouchableOpacity onPress={handleShareInvite} style={styles.shareButton}>
                        <Text style={styles.shareIcon}>📤</Text>
                    </TouchableOpacity>
                </View>

                {/* Tabs */}
                <View style={styles.tabsContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'dashboard' && styles.activeTab]}
                        onPress={() => handleTabChange('dashboard')}
                    >
                        <Text style={[styles.tabText, activeTab === 'dashboard' && styles.activeTabText]}>Dashboard</Text>
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
                </View>
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

                        <View style={styles.paddedSection}>
                            <LeaderboardSection
                                members={members}
                                goals={goals}
                                onMemberPress={handleMemberPress}
                            />
                        </View>
                    </>
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
                                    <TouchableOpacity
                                        key={member.id}
                                        style={styles.memberRow}
                                        onPress={() => handleMemberPress(member)}
                                        activeOpacity={0.7}
                                    >
                                        {member.profile?.avatar_url ? (
                                            <Image source={{ uri: member.profile.avatar_url }} style={styles.memberAvatar} />
                                        ) : (
                                            <View style={styles.memberAvatarPlaceholder}>
                                                <Text style={styles.memberAvatarInitial}>
                                                    {member.profile?.name?.charAt(0) || '?'}
                                                </Text>
                                            </View>
                                        )}
                                        <View style={styles.memberInfo}>
                                            <Text style={styles.memberName}>
                                                {member.profile?.name || 'Unknown'} {member.user_id === user?.id && '(You)'}
                                            </Text>
                                            <Text style={styles.memberJoined}>
                                                Joined {new Date(member.joined_at).toLocaleDateString()}
                                            </Text>
                                        </View>
                                        <View style={styles.memberBalance}>
                                            <Text style={[
                                                styles.balanceText,
                                                member.current_balance >= 0 ? styles.textGreen : styles.textRed
                                            ]}>
                                                {member.current_balance >= 0 ? '+' : ''}€{member.current_balance.toFixed(2)}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>


                    </>
                )}

                {/* SETTINGS TAB */}
                {activeTab === 'settings' && (
                    <View style={styles.sectionContainer}>
                        <View style={styles.coverImageWrapper}>
                            <TouchableOpacity
                                style={styles.coverImageContainer}
                                disabled={!isCreator}
                                activeOpacity={0.8}
                                onPress={async () => {
                                    try {
                                        const { pickImage, uploadGroupCover } = await import('../services/photoService');
                                        const uri = await pickImage();
                                        if (uri) {
                                            safeHaptics('medium');
                                            const publicUrl = await uploadGroupCover(uri, groupId);
                                            await updateGroup(groupId, { image_url: publicUrl });
                                            refetchGroup();
                                            StyledAlert.alert('Success', 'Group image updated!');
                                        }
                                    } catch (error: any) {
                                        StyledAlert.alert('Error', error.message);
                                    }
                                }}
                            >
                                {group.image_url ? (
                                    <Image source={{ uri: group.image_url }} style={styles.coverImage} resizeMode="cover" />
                                ) : (
                                    <View style={[styles.coverPlaceholder, { backgroundColor: colors.surfaceHighlight }]}>
                                        <Text style={{ fontSize: 40 }}>🖼️</Text>
                                        {isCreator && <Text style={styles.coverPlaceholderText}>Set Cover Photo</Text>}
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.inviteCard}
                            onPress={async () => {
                                await Clipboard.setStringAsync(group.invite_code);
                                safeHaptics('success');
                                StyledAlert.alert('Copied!', `Code: ${group.invite_code}`);
                            }}
                        >
                            <View>
                                <Text style={styles.inviteLabel}>Invite Code</Text>
                                <Text style={styles.inviteCode}>{group.invite_code}</Text>
                            </View>
                            <Text style={styles.copyText}>COPY</Text>
                        </TouchableOpacity>

                        <View style={styles.dangerZone}>
                            <Text style={styles.dangerTitle}>Danger Zone</Text>
                            {isCreator ? (
                                <TouchableOpacity onPress={() => setShowDeleteModal(true)} style={styles.dangerButton}>
                                    <Text style={styles.dangerButtonText}>Delete Group</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity onPress={() => setShowLeaveModal(true)} style={styles.leaveButton}>
                                    <Text style={styles.leaveButtonText}>Leave Group</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Floating Action Button (Only on Dashboard) */}
            {activeTab === 'dashboard' && (
                <View style={[styles.fabContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                    <TouchableOpacity
                        onPress={handleLogFailure}
                        activeOpacity={0.8}
                        style={styles.fabButton}
                    >
                        <Text style={styles.fabTitle}>I FAILED</Text>
                        <Text style={styles.fabSubtitle}>
                            Pay €{group.default_penalty_amount.toFixed(2)}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            <LogFailureModal
                visible={showFailureModal}
                onClose={() => setShowFailureModal(false)}
                onSuccess={handleFailureLogged}
                groupId={groupId}
                groupName={group.name}
                penaltyAmount={group.default_penalty_amount}
                memberCount={otherMembers.length}
            />

            <MemberDetailModal
                visible={showMemberModal}
                onClose={() => setShowMemberModal(false)}
                member={selectedMember}
                isCurrentUser={selectedMember?.user_id === user?.id}
                groupCreatorId={group?.created_by}
            />

            <ConfirmModal
                visible={showDeleteModal}
                title="Delete Group?"
                message="Permanently delete this group and all data?"
                confirmText={isDeleting ? "Deleting..." : "Delete Group"}
                onConfirm={handleDeleteGroup}
                onCancel={() => setShowDeleteModal(false)}
                confirmStyle="danger"
            />

            <ConfirmModal
                visible={showLeaveModal}
                title="Leave Group?"
                message="Are you sure you want to leave?"
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
        backgroundColor: colors.surface,
    },
    shareIcon: {
        fontSize: 20,
    },
    tabsContainer: {
        flexDirection: 'row',
        marginHorizontal: 16,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 12,
        padding: 4,
        marginBottom: 16, // Increased from 8
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 10,
    },
    activeTab: {
        backgroundColor: colors.text, // White/Light active tab for high contrast
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textMuted,
    },
    activeTabText: {
        color: colors.background, // Dark text on light tab
        fontWeight: '800',
    },
    content: {
        paddingTop: 16,
        paddingBottom: 140, // Increased to prevent FAB overlap
    },
    penaltyCard: {
        flexDirection: 'row',
        backgroundColor: colors.surfaceHighlight, // Slightly lighter than surface
        marginHorizontal: 16,
        padding: 24,
        borderRadius: 24,
        justifyContent: 'space-around',
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.border + '40', // Subtle border
    },
    penaltyLabel: {
        color: colors.textMuted,
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 4,
        textAlign: 'center',
    },
    penaltyValue: {
        color: colors.text,
        fontSize: 20,
        fontWeight: '800',
        textAlign: 'center',
    },
    verticalDivider: {
        width: 1,
        height: 40,
        backgroundColor: colors.border,
    },
    sectionContainer: {
        paddingHorizontal: 16,
        marginTop: 16,
    },
    paddedSection: {
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 12,
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: colors.surface,
        borderRadius: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    currentUserRow: {
        borderColor: colors.primary,
        backgroundColor: colors.primary + '10',
    },
    memberAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surfaceHighlight,
        marginRight: 12,
    },
    memberInfo: {
        flex: 1,
    },
    memberName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    memberBalance: {
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    debtCard: {
        padding: 16,
        backgroundColor: colors.surface,
        borderRadius: 16,
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    debtInfo: { flex: 1 },
    debtName: { fontSize: 16, fontWeight: '700', color: colors.text },
    debtDescription: { color: colors.textMuted, fontSize: 13 },
    debtAmount: { fontSize: 18, fontWeight: '700', color: colors.error },
    creditCard: {
        padding: 16,
        backgroundColor: colors.surface,
        borderRadius: 16,
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    creditInfo: { flex: 1 },
    creditName: { fontSize: 16, fontWeight: '700', color: colors.text },
    creditDescription: { color: colors.textMuted, fontSize: 13 },
    creditAction: { flexDirection: 'row', alignItems: 'center' },
    creditAmount: { fontSize: 18, fontWeight: '700', color: colors.success, marginRight: 12 },
    settleButton: {
        backgroundColor: colors.success,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    settleButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 12,
    },
    coverImageWrapper: {
        marginBottom: 24,
    },
    coverImageContainer: {
        height: 200,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: colors.surfaceHighlight,
    },
    coverImage: { width: '100%', height: '100%' },
    coverPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    coverPlaceholderText: {
        color: colors.textMuted,
        fontWeight: '600',
        marginTop: 8,
    },
    inviteCard: {
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 24,
    },
    inviteLabel: {
        color: colors.textMuted,
        fontSize: 12,
        textTransform: 'uppercase',
        fontWeight: '600',
        marginBottom: 4,
    },
    inviteCode: {
        color: colors.primary,
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: 2,
    },
    copyText: {
        color: colors.textMuted,
        fontWeight: '700',
        fontSize: 12,
    },
    dangerZone: {
        marginTop: 24,
        padding: 16,
        borderRadius: 16,
        backgroundColor: colors.error + '10',
        borderWidth: 1,
        borderColor: colors.error + '20',
    },
    dangerTitle: {
        color: colors.error,
        fontWeight: '700',
        marginBottom: 12,
        fontSize: 16,
    },
    dangerButton: {
        backgroundColor: colors.error,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    dangerButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    leaveButton: {
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.warning,
    },
    leaveButtonText: {
        color: colors.warning,
        fontWeight: 'bold',
        fontSize: 16,
    },
    fabContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    fabButton: {
        backgroundColor: colors.error,
        borderRadius: 24,
        paddingVertical: 14,
        width: '100%',
        alignItems: 'center',
        shadowColor: colors.error,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
    },
    fabTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '900',
    },
    fabSubtitle: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 11,
        fontWeight: '600',
    },
    membersList: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        overflow: 'hidden',
    },
    memberAvatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    memberAvatarInitial: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.textMuted,
    },
    memberJoined: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 2,
    },
    balanceText: {
        fontSize: 15,
        fontWeight: '700',
    },
    textGreen: {
        color: colors.success,
    },
    textRed: {
        color: colors.error,
    },
});
