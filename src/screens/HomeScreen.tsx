import React, { useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../hooks/useGroups';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { SkeletonGroupCard } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import AppIcon from '../components/AppIcon';

// Shown once per install when the user has no groups yet.
const ONBOARDING_PACT_SEEN_KEY = '@doitmate/onboarding_pact_seen';

interface Props {
    navigation: NativeStackNavigationProp<any>;
}

export default function HomeScreen({ navigation }: Props) {
    const { profile } = useAuth();
    const { groups, groupBalances, netBalance, loading, refetch, error } = useGroups();
    const [refreshing, setRefreshing] = React.useState(false);
    const [longLoading, setLongLoading] = React.useState(false);
    const [showOnboardingCard, setShowOnboardingCard] = React.useState(false);
    const insets = useSafeAreaInsets();

    // Refetch when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            refetch();
        }, [refetch])
    );

    // One-time (per install) "set up your first pact" card when the user has
    // zero groups. The flag is only read when groups are empty, so existing
    // users never see it.
    React.useEffect(() => {
        if (groups.length > 0) return;
        let cancelled = false;
        (async () => {
            try {
                const seen = await AsyncStorage.getItem(ONBOARDING_PACT_SEEN_KEY);
                if (!cancelled && !seen) {
                    setShowOnboardingCard(true);
                }
            } catch {
                // Non-critical — default to showing the card
                if (!cancelled) setShowOnboardingCard(true);
            }
        })();
        return () => { cancelled = true; };
    }, [groups.length]);

    const dismissOnboardingCard = useCallback(() => {
        setShowOnboardingCard(false);
        AsyncStorage.setItem(ONBOARDING_PACT_SEEN_KEY, 'true').catch(() => {});
    }, []);

    const handlePickChallenge = useCallback(() => {
        dismissOnboardingCard();
        navigation.navigate('ExploreTab');
    }, [dismissOnboardingCard, navigation]);

    const handleHaveInviteCode = useCallback(() => {
        dismissOnboardingCard();
        navigation.navigate('JoinGroup');
    }, [dismissOnboardingCard, navigation]);

    // Track if loading takes too long
    React.useEffect(() => {
        if (loading) {
            const timer = setTimeout(() => setLongLoading(true), 3000);
            return () => clearTimeout(timer);
        } else {
            setLongLoading(false);
        }
    }, [loading]);

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
        if (balance > 0) return 'YOU ARE OWED';
        if (balance < 0) return 'YOU OWE';
        return 'SETTLED UP';
    };

    if (loading && !refreshing && !longLoading) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Skeleton Balance */}
                    <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 32 }}>
                        <View style={{ backgroundColor: colors.surfaceHighlight, width: 160, height: 42, borderRadius: 8 }} />
                        <View style={{ backgroundColor: colors.surfaceHighlight, width: 100, height: 13, borderRadius: 6, marginTop: 8 }} />
                    </View>
                    {/* Skeleton Groups */}
                    <SkeletonGroupCard />
                    <SkeletonGroupCard />
                    <SkeletonGroupCard />
                </ScrollView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={{ height: insets.top }} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
                    />
                }
            >
                {/* Error Banner */}
                {error && (
                    <View style={styles.errorBanner}>
                        <AppIcon name="alert-circle-outline" size={18} color={colors.error} />
                        <Text style={styles.errorBannerText}>{error}</Text>
                        <TouchableOpacity onPress={onRefresh}>
                            <Text style={styles.errorBannerRetry}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Main Balance Section */}
                <View style={styles.balanceHeader}>
                    <Text style={styles.greeting}>Hi {profile?.name?.split(' ')[0] || 'mate'}</Text>
                    <Text style={[styles.balanceAmount, { color: getBalanceColor(netBalance) }]}>
                        {netBalance >= 0 ? '+' : '-'}{formatBalance(netBalance)}
                    </Text>
                    <Text style={styles.balanceLabel}>{getBalanceText(netBalance)}</Text>
                </View>

                {/* Quick Actions */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('CreateGroup')}
                        style={styles.actionButton}
                    >
                        <View style={styles.actionIconContainer}>
                            <AppIcon name="plus-circle-outline" size={24} color={colors.primary} />
                        </View>
                        <Text style={styles.actionLabel}>Create</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => navigation.navigate('JoinGroup')}
                        style={styles.actionButton}
                    >
                        <View style={styles.actionIconContainer}>
                            <AppIcon name="link-variant" size={24} color={colors.primary} />
                        </View>
                        <Text style={styles.actionLabel}>Join</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => navigation.navigate('ProfileTab')}
                        style={styles.actionButton}
                    >
                        <View style={styles.actionIconContainer}>
                            <AppIcon name="account-circle-outline" size={24} color={colors.primary} />
                        </View>
                        <Text style={styles.actionLabel}>Profile</Text>
                    </TouchableOpacity>
                </View>

                {/* Groups Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Accountability Groups</Text>

                    {groups.length === 0 ? (
                        <>
                            {/* One-time onboarding: set up your first pact */}
                            {showOnboardingCard && (
                                <View style={styles.onboardingCard}>
                                    <View style={styles.onboardingHeader}>
                                        <View style={styles.onboardingIcon}>
                                            <AppIcon name="handshake" size={26} color={colors.primary} />
                                        </View>
                                        <TouchableOpacity
                                            style={styles.onboardingClose}
                                            onPress={dismissOnboardingCard}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <AppIcon name="close" size={18} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={styles.onboardingTitle}>
                                        Set up your first pact (1 min)
                                    </Text>
                                    <Text style={styles.onboardingSubtitle}>
                                        Pick a challenge or jump straight into a friend's group — the
                                        ledger only gets real once you're both in.
                                    </Text>
                                    <View style={styles.onboardingActions}>
                                        <TouchableOpacity
                                            style={styles.onboardingPrimaryButton}
                                            onPress={handlePickChallenge}
                                            activeOpacity={0.8}
                                        >
                                            <AppIcon name="compass-outline" size={18} color="#fff" />
                                            <Text style={styles.onboardingPrimaryText}>Pick a challenge</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.onboardingSecondaryButton}
                                            onPress={handleHaveInviteCode}
                                            activeOpacity={0.8}
                                        >
                                            <AppIcon name="link-variant" size={18} color={colors.primary} />
                                            <Text style={styles.onboardingSecondaryText}>I have an invite code</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            <EmptyState
                                icon="target"
                                title="No active groups yet"
                                subtitle="Create a group or join one with an invite code to start tracking goals with friends."
                                actionLabel="Start a Group"
                                onAction={() => navigation.navigate('CreateGroup')}
                            />
                        </>
                    ) : (
                        groupBalances.map(({ group, balance }) => (
                            <TouchableOpacity
                                key={group.id}
                                style={styles.groupCard}
                                onPress={() => {
                                    navigation.navigate('GroupDetail', { groupId: group.id });
                                }}
                            >
                                <View style={styles.groupImageContainer}>
                                    {group.image_url ? (
                                        <Image
                                            source={{ uri: group.image_url }}
                                            style={styles.groupImage}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View style={[styles.groupImagePlaceholder, { backgroundColor: colors.surfaceHighlight }]}>
                                            <Text style={styles.groupInitial}>{group.name.charAt(0).toUpperCase()}</Text>
                                        </View>
                                    )}
                                    {/* Member Bubbles */}
                                    {balance !== undefined && ( // Just to ensure we're inside the map
                                        <View style={styles.memberBubblesContainer}>
                                            {(groupBalances.find(b => b.group.id === group.id)?.memberAvatars || [])
                                                .slice(0, 3)
                                                .map((avatar, index) => (
                                                    <Image
                                                        key={index}
                                                        source={{ uri: avatar }}
                                                        style={[
                                                            styles.memberBubble,
                                                            { transform: [{ translateX: -10 * index }] } // Overlap effect
                                                        ]}
                                                    />
                                                ))}
                                        </View>
                                    )}
                                </View>

                                <View style={styles.groupContent}>
                                    <Text style={styles.groupName} numberOfLines={1}>
                                        {group.name}
                                    </Text>

                                    <Text style={[styles.groupStatus, { color: getBalanceColor(balance) }]}>
                                        {balance > 0 ? 'OWED TO YOU' : balance < 0 ? 'YOU OWE' : 'SETTLED'}
                                    </Text>
                                    <Text style={styles.groupPenalty}>
                                        €{group.default_penalty_amount.toFixed(2)} penalty
                                    </Text>
                                </View>

                                <View style={styles.groupBalanceContainer}>
                                    <Text style={[styles.groupBalanceValue, { color: getBalanceColor(balance) }]}>
                                        {balance !== 0 && (balance > 0 ? '+' : '')}
                                        {formatBalance(balance)}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </View>

                {/* Info Section */}
                <View style={styles.infoSection}>
                    <Text style={styles.infoHeading}>How it works</Text>
                    <View style={styles.infoCard}>
                        <InfoItem icon="account-multiple-plus-outline" title="Join or Create" desc="Invite your mates to a new group" />
                        <InfoItem icon="cash-minus" title="Pact Failure" desc="Log a slip-up, and everyone gets paid" />
                        <InfoItem icon="script-text-outline" title="Ledger" desc="Track who owes who and settle up" last />
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

function InfoItem({ icon, title, desc, last }: { icon: React.ComponentProps<typeof AppIcon>['name']; title: string; desc: string; last?: boolean }) {
    return (
        <View style={[styles.infoItem, last && { borderBottomWidth: 0 }]}>
            <View style={styles.infoItemIcon}>
                <AppIcon name={icon} size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.infoItemTitle}>{title}</Text>
                <Text style={styles.infoItemDesc}>{desc}</Text>
            </View>
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
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    errorBanner: {
        backgroundColor: colors.error + '20',
        padding: 12,
        borderRadius: 8,
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.error + '40',
    },
    errorBannerText: {
        color: colors.error,
        flex: 1,
        fontSize: 13,
    },
    errorBannerRetry: {
        color: colors.error,
        fontWeight: 'bold',
        textDecorationLine: 'underline',
        marginLeft: 10,
    },
    balanceHeader: {
        alignItems: 'flex-start',
        marginTop: 18,
        marginBottom: 28,
        backgroundColor: colors.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 18,
    },
    greeting: {
        color: colors.textMuted,
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 8,
    },
    balanceAmount: {
        fontSize: 40,
        fontWeight: '800',
    },
    balanceLabel: {
        fontSize: 13,
        color: colors.textMuted,
        fontWeight: '700',
        letterSpacing: 1.5,
        marginTop: 4,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 28,
        paddingHorizontal: 8,
    },
    actionButton: {
        alignItems: 'center',
    },
    actionIconContainer: {
        width: 48, // Reduced from 56
        height: 48,
        borderRadius: 12,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    actionLabel: {
        color: colors.textMuted,
        fontSize: 11,
        fontWeight: '600',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 16, // Slightly smaller
        fontWeight: '800', // Bold
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    groupCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 8,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    groupImageContainer: {
        marginRight: 12, // Reduced margin
    },
    groupImage: {
        width: 48, // Reduced from 60
        height: 48,
        borderRadius: 8,
    },
    memberBubblesContainer: {
        position: 'absolute',
        bottom: -6,
        right: -6,
        flexDirection: 'row',
        alignItems: 'center',
    },
    memberBubble: {
        width: 20, // Reduced
        height: 20,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: colors.surface,
        backgroundColor: colors.surfaceHighlight,
    },
    groupImagePlaceholder: {
        width: 48, // Reduced
        height: 48,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    groupInitial: {
        color: colors.text,
        fontSize: 20,
        fontWeight: 'bold',
    },
    groupContent: {
        flex: 1,
        justifyContent: 'center',
    },
    groupName: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 2,
    },
    groupStatus: {
        fontSize: 11, // Reduced
        fontWeight: '700',
        marginBottom: 2,
    },
    groupPenalty: {
        color: colors.textMuted,
        fontSize: 11,
    },
    groupBalanceContainer: {
        marginLeft: 8,
    },
    groupBalanceValue: {
        fontSize: 16, // Reduced
        fontWeight: '800',
    },
    emptyCard: {
        backgroundColor: colors.surface,
        borderRadius: 8,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    emptyEmoji: {
        fontSize: 40,
        marginBottom: 12,
    },
    emptyText: {
        color: colors.textMuted,
        fontSize: 14,
        marginBottom: 16,
    },
    emptyButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    emptyButtonText: {
        color: colors.text,
        fontWeight: 'bold',
        fontSize: 13,
    },
    onboardingCard: {
        backgroundColor: colors.surface,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: colors.primary,
        padding: 18,
        marginBottom: 16,
    },
    onboardingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    onboardingIcon: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: colors.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
    },
    onboardingClose: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    onboardingTitle: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '800',
        marginBottom: 6,
    },
    onboardingSubtitle: {
        color: colors.textMuted,
        fontSize: 13,
        lineHeight: 19,
        marginBottom: 16,
    },
    onboardingActions: {
        gap: 10,
    },
    onboardingPrimaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.primary,
        paddingVertical: 13,
        borderRadius: 8,
    },
    onboardingPrimaryText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 14,
    },
    onboardingSecondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.primary + '12',
        borderWidth: 1,
        borderColor: colors.primary + '40',
        paddingVertical: 13,
        borderRadius: 8,
    },
    onboardingSecondaryText: {
        color: colors.primary,
        fontWeight: '700',
        fontSize: 14,
    },
    infoSection: {
        marginTop: 0,
        opacity: 0.8, // Make it subtle
    },
    infoHeading: {
        color: colors.textMuted,
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    infoCard: {
        backgroundColor: colors.surface,
        borderRadius: 8,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    infoItemIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: colors.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    infoItemTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    infoItemDesc: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 2,
    },
});
