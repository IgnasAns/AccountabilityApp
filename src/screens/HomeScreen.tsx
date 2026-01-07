import React, { useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, StyleSheet, Image, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../hooks/useGroups';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';

const { width } = Dimensions.get('window');

interface Props {
    navigation: NativeStackNavigationProp<any>;
}

export default function HomeScreen({ navigation }: Props) {
    const { profile, signOut } = useAuth();
    const { groups, groupBalances, netBalance, loading, refetch, error } = useGroups();
    const [refreshing, setRefreshing] = React.useState(false);
    const [longLoading, setLongLoading] = React.useState(false);
    const insets = useSafeAreaInsets();

    // Refetch when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            refetch();
        }, [refetch])
    );

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
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
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
                        <Text style={styles.errorBannerText}>⚠️ {error}</Text>
                        <TouchableOpacity onPress={onRefresh}>
                            <Text style={styles.errorBannerRetry}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Main Balance Section */}
                <View style={styles.balanceHeader}>
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
                            <Text style={styles.actionIcon}>➕</Text>
                        </View>
                        <Text style={styles.actionLabel}>Create</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => navigation.navigate('JoinGroup')}
                        style={styles.actionButton}
                    >
                        <View style={styles.actionIconContainer}>
                            <Text style={styles.actionIcon}>🔗</Text>
                        </View>
                        <Text style={styles.actionLabel}>Join</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => navigation.navigate('ProfileTab')}
                        style={styles.actionButton}
                    >
                        <View style={styles.actionIconContainer}>
                            <Text style={styles.actionIcon}>👤</Text>
                        </View>
                        <Text style={styles.actionLabel}>Profile</Text>
                    </TouchableOpacity>
                </View>

                {/* Groups Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Accountability Groups</Text>

                    {groups.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Text style={styles.emptyEmoji}>🎯</Text>
                            <Text style={styles.emptyText}>No active groups yet.</Text>
                            <TouchableOpacity
                                style={styles.emptyButton}
                                onPress={() => navigation.navigate('CreateGroup')}
                            >
                                <Text style={styles.emptyButtonText}>Start a Group</Text>
                            </TouchableOpacity>
                        </View>
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
                        <InfoItem emoji="👋" title="Join or Create" desc="Invite your mates to a new group" />
                        <InfoItem emoji="📉" title="Pact Failure" desc="Log a slip-up, and everyone gets paid" />
                        <InfoItem emoji="🧾" title="Ledger" desc="Track who owes who and settle up" last />
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

function InfoItem({ emoji, title, desc, last }: { emoji: string; title: string; desc: string; last?: boolean }) {
    return (
        <View style={[styles.infoItem, last && { borderBottomWidth: 0 }]}>
            <Text style={styles.infoItemEmoji}>{emoji}</Text>
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
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
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
        alignItems: 'center',
        marginTop: 24, // Reduced
        marginBottom: 32, // Reduced
    },
    balanceAmount: {
        fontSize: 42, // Reduced from 56
        fontWeight: '800',
        letterSpacing: -1,
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
        marginBottom: 32, // Reduced
        paddingHorizontal: 20,
    },
    actionButton: {
        alignItems: 'center',
    },
    actionIconContainer: {
        width: 48, // Reduced from 56
        height: 48,
        borderRadius: 24,
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
    actionIcon: {
        fontSize: 20, // Reduced
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
        borderRadius: 20, // Slightly tighter radii
        padding: 12, // Reduced padding
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15, // Softer shadow
        shadowRadius: 6,
        elevation: 3,
    },
    groupImageContainer: {
        marginRight: 12, // Reduced margin
    },
    groupImage: {
        width: 48, // Reduced from 60
        height: 48,
        borderRadius: 16,
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
        borderRadius: 16,
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
        borderRadius: 20,
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
        borderRadius: 12,
    },
    emptyButtonText: {
        color: colors.text,
        fontWeight: 'bold',
        fontSize: 13,
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
        borderRadius: 20,
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
    infoItemEmoji: {
        fontSize: 20,
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
