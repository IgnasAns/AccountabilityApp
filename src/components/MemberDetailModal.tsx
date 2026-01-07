
import React from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    Image,
    Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { GroupMemberWithProfile } from '../types/database';
import { StyledAlert } from './StyledAlert';

interface Props {
    visible: boolean;
    onClose: () => void;
    member: GroupMemberWithProfile | null;
    isCurrentUser: boolean;
    groupCreatorId?: string;
}

export default function MemberDetailModal({ visible, onClose, member, isCurrentUser, groupCreatorId }: Props) {
    if (!member || !member.profile) return null;

    const { profile } = member;

    const safeHaptics = (type: 'success' | 'light' = 'light') => {
        try {
            if (type === 'success') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch (e) { }
    };

    const handleCopyPaymentLink = async () => {
        if (profile.payment_link) {
            await Clipboard.setStringAsync(profile.payment_link);
            safeHaptics('success');
            StyledAlert.alert('Copied!', 'Payment link copied to clipboard.');
        }
    };

    const handleOpenPaymentLink = async () => {
        if (profile.payment_link) {
            try {
                const supported = await Linking.canOpenURL(profile.payment_link);
                if (supported) {
                    await Linking.openURL(profile.payment_link);
                } else {
                    StyledAlert.alert('Error', `Cannot open this URL: ${profile.payment_link}`);
                }
            } catch (err) {
                StyledAlert.alert('Error', 'Failed to open link');
            }
        }
    };

    const joinDate = new Date(member.joined_at).toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric'
    });

    const getBalanceColor = (balance: number) => {
        if (balance > 0) return colors.success;
        if (balance < 0) return colors.error;
        return colors.textMuted;
    };

    const isGroupCreator = member.user_id === groupCreatorId;

    // Reliability Calculation
    // Base 100%. Deduct 10% per failure, but recover over time? 
    // Simpler: 100% - (Failures * 5). Min 0%.
    const reliability = Math.max(0, 100 - (member.failure_count * 5));

    let reliabilityColor = colors.success;
    if (reliability < 80) reliabilityColor = colors.warning;
    if (reliability < 50) reliabilityColor = colors.error;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => { }}
                    style={styles.modalContent}
                >
                    <View style={styles.header}>
                        {profile.avatar_url ? (
                            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarInitial}>{profile.name.charAt(0)}</Text>
                            </View>
                        )}
                        <Text style={styles.name}>
                            {profile.name} {isCurrentUser && '(You)'}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            {isGroupCreator && (
                                <View style={styles.roleBadge}>
                                    <Text style={styles.roleText}>👑 Creator</Text>
                                </View>
                            )}
                            <Text style={styles.joinedText}>Member since {joinDate}</Text>
                        </View>
                    </View>

                    <View style={styles.statsRow}>
                        <View style={styles.stat}>
                            <Text style={styles.statLabel}>Reliability</Text>
                            <Text style={[styles.statValue, { color: reliabilityColor }]}>{reliability}%</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.stat}>
                            <Text style={styles.statLabel}>Failures</Text>
                            <Text style={styles.statValue}>{member.failure_count}</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.stat}>
                            <Text style={styles.statLabel}>Balance</Text>
                            <Text style={[styles.statValue, { color: getBalanceColor(member.current_balance) }]}>
                                {member.current_balance >= 0 ? '+' : ''}€{Math.abs(member.current_balance).toFixed(2)}
                            </Text>
                        </View>
                    </View>

                    {profile.payment_link ? (
                        <View style={styles.paymentSection}>
                            <Text style={styles.sectionTitle}>💳 Payment Link</Text>
                            <View style={styles.linkCard}>
                                <Text style={styles.linkText} numberOfLines={1}>
                                    {profile.payment_link}
                                </Text>
                                <View style={styles.linkActions}>
                                    <TouchableOpacity
                                        onPress={handleCopyPaymentLink}
                                        style={styles.actionButton}
                                    >
                                        <Text style={styles.actionButtonText}>Copy</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleOpenPaymentLink}
                                        style={[styles.actionButton, styles.primaryContextButton]}
                                    >
                                        <Text style={[styles.actionButtonText, styles.primaryContextText]}>Open</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.emptyPaymentSection}>
                            <Text style={styles.emptyPaymentText}>
                                No payment link provided.
                            </Text>
                            {isCurrentUser && (
                                <Text style={styles.addLinkHint}>
                                    Go to your Profile settings to add one.
                                </Text>
                            )}
                        </View>
                    )}

                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={onClose}
                    >
                        <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        backgroundColor: colors.surface,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        marginBottom: 16,
        borderWidth: 3,
        borderColor: colors.surfaceHighlight,
    },
    avatarPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 3,
        borderColor: colors.border,
    },
    avatarInitial: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.textMuted,
    },
    name: {
        fontSize: 22,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 4,
    },
    joinedText: {
        fontSize: 14,
        color: colors.textMuted,
    },
    statsRow: {
        flexDirection: 'row',
        alignSelf: 'stretch',
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
    },
    stat: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        backgroundColor: colors.border,
    },
    statLabel: {
        fontSize: 12,
        color: colors.textMuted,
        marginBottom: 4,
        textTransform: 'uppercase',
        fontWeight: '600',
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
    },
    paymentSection: {
        alignSelf: 'stretch',
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.textMuted,
        marginBottom: 12,
        textTransform: 'uppercase',
    },
    linkCard: {
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    linkText: {
        color: colors.text,
        fontSize: 14,
        marginBottom: 12,
    },
    linkActions: {
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'flex-end',
    },
    actionButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    primaryContextButton: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    actionButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
    },
    primaryContextText: {
        color: '#fff',
    },
    emptyPaymentSection: {
        alignSelf: 'stretch',
        marginBottom: 24,
        alignItems: 'center',
        padding: 16,
        backgroundColor: colors.surfaceHighlight + '40',
        borderRadius: 12,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: colors.border,
    },
    emptyPaymentText: {
        color: colors.textMuted,
        fontStyle: 'italic',
    },
    addLinkHint: {
        color: colors.primary,
        fontSize: 12,
        marginTop: 8,
        fontWeight: '600',
    },
    closeButton: {
        alignSelf: 'stretch',
        paddingVertical: 16,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 16,
        alignItems: 'center',
    },
    closeButtonText: {
        color: colors.text,
        fontWeight: '600',
        fontSize: 16,
    },
    roleBadge: {
        backgroundColor: colors.surfaceHighlight,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    roleText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: colors.primary,
        textTransform: 'uppercase',
    },
});
