import React from 'react';
import { View, Text, SectionList, StyleSheet, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTransactions } from '../hooks/useTransactions';
import { colors } from '../theme/colors';
import { TransactionWithProfiles } from '../types/database';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import EmptyState from '../components/EmptyState';
import AppIcon from '../components/AppIcon';
import ProofPhotoViewer from '../components/ProofPhotoViewer';

interface Props {
    navigation: NativeStackNavigationProp<any>;
}

export default function ActivityScreen({ navigation }: Props) {
    const insets = useSafeAreaInsets();
    const { transactions, loading, refetch } = useTransactions();
    const { user } = useAuth(); // Need to know who "I" am to format messages

    // Group transactions by date
    const sections = React.useMemo(() => {
        const groups: { [key: string]: TransactionWithProfiles[] } = {};

        transactions.forEach(t => {
            const date = new Date(t.created_at);
            const title = format(date, 'MMM d, yyyy');
            if (!groups[title]) {
                groups[title] = [];
            }
            groups[title].push(t);
        });

        return Object.keys(groups).map(title => ({
            title,
            data: groups[title]
        }));
    }, [transactions]);

    const renderItem = ({ item }: { item: TransactionWithProfiles }) => {
        const isPayer = item.from_user_id === user?.id;
        const otherUser = isPayer ? item.to_user : item.from_user;

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    {/* Peer Info */}
                    <View style={styles.peerInfo}>
                        {otherUser?.avatar_url ? (
                            <Image source={{ uri: otherUser.avatar_url }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceHighlight }]}>
                                <Text style={styles.avatarInitial}>
                                    {otherUser?.name?.charAt(0).toUpperCase() || '?'}
                                </Text>
                            </View>
                        )}
                        <View style={styles.textContent}>
                            <Text style={styles.actionText}>
                                {isPayer ? 'You paid' : 'You received'}
                                <Text style={styles.highlight}> €{item.amount.toFixed(2)} </Text>
                                {isPayer ? 'to' : 'from'}
                                <Text style={styles.nameText}> {otherUser?.name || 'Unknown'} </Text>
                            </Text>
                            <Text style={styles.timestamp}>
                                {format(new Date(item.created_at), 'h:mm a')} • {item.description || 'No description'}
                            </Text>
                        </View>
                    </View>

                    {/* Status Badge */}
                    <View style={[
                        styles.statusBadge,
                        item.status === 'paid' ? styles.statusPaid : styles.statusPending
                    ]}>
                        <Text style={[
                            styles.statusText,
                            item.status === 'paid' ? styles.textPaid : styles.textPending
                        ]}>
                            {item.status === 'paid' ? 'PAID' : 'PENDING'}
                        </Text>
                    </View>
                </View>

                {/* Proof Photo if available — tap to open the shared zoomable viewer */}
                {item.proof_photo_url && (
                    <ProofPhotoViewer photoUrl={item.proof_photo_url} size="medium" />
                )}
            </View>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Activity</Text>
            </View>

            {loading && transactions.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color={colors.primary} size="large" />
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    renderSectionHeader={({ section: { title } }) => (
                        <Text style={styles.sectionHeader}>{title}</Text>
                    )}
                    contentContainerStyle={styles.listContent}
                    stickySectionHeadersEnabled={false}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <EmptyState
                            icon="clipboard-text-outline"
                            title="No activity yet"
                            subtitle="Transactions, goal completions, and group events will appear here."
                        />
                    }
                    onRefresh={refetch}
                    refreshing={loading}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 10,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: colors.text,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
    },
    sectionHeader: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.textMuted,
        marginTop: 24,
        marginBottom: 12,
        marginLeft: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    peerInfo: {
        flexDirection: 'row',
        flex: 1,
        marginRight: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    avatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarInitial: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
    },
    textContent: {
        flex: 1,
    },
    actionText: {
        color: colors.textMuted,
        fontSize: 14,
        lineHeight: 20,
    },
    nameText: {
        color: colors.text,
        fontWeight: '700',
    },
    highlight: {
        color: colors.text,
        fontWeight: '800',
    },
    timestamp: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 4,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusPaid: {
        backgroundColor: colors.success + '20',
    },
    statusPending: {
        backgroundColor: colors.warning + '20',
    },
    statusText: {
        fontSize: 10,
        fontWeight: '800',
    },
    textPaid: {
        color: colors.success,
    },
    textPending: {
        color: colors.warning,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 8,
    },
    emptySubtext: {
        color: colors.textMuted,
        textAlign: 'center',
    },
});
