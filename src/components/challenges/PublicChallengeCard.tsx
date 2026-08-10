import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { PublicChallenge } from '../../hooks/usePublicChallenges';

interface Props {
    challenge: PublicChallenge;
    joining: boolean;
    onJoin: () => void;
    onOpen: () => void;
}

/** "Ends in X days" / "Starts in X days" — a compact label for the card meta row. */
function formatDateLabel(challenge: PublicChallenge): string {
    const now = Date.now();
    const start = new Date(challenge.starts_at).getTime();
    const end = new Date(challenge.ends_at).getTime();
    const DAY = 24 * 60 * 60 * 1000;

    if (now < start) {
        const days = Math.ceil((start - now) / DAY);
        return days <= 1 ? 'Starts tomorrow' : `Starts in ${days} days`;
    }
    const days = Math.ceil((end - now) / DAY);
    if (days <= 0) return 'Ended';
    return days === 1 ? 'Ends tomorrow' : `Ends in ${days} days`;
}

export default function PublicChallengeCard({ challenge, joining, onJoin, onOpen }: Props) {
    const metaPieces = [
        `${challenge.participant_count} joined`,
        formatDateLabel(challenge),
        `€${challenge.penalty_amount} penalty`,
    ];

    return (
        <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={challenge.joined ? onOpen : onJoin}
        >
            <View style={styles.emojiContainer}>
                <Text style={styles.emoji}>{challenge.emoji}</Text>
            </View>

            <View style={styles.body}>
                <View style={styles.titleRow}>
                    <Text style={styles.title} numberOfLines={1}>
                        {challenge.name}
                    </Text>
                    {challenge.joined && (
                        <View style={styles.joinedBadge}>
                            <Text style={styles.joinedBadgeText}>Joined ✓</Text>
                        </View>
                    )}
                </View>

                <Text style={styles.description} numberOfLines={2}>
                    {challenge.description}
                </Text>

                <View style={styles.metaRow}>
                    <Text style={styles.metaText}>👥 {metaPieces[0]}</Text>
                    <View style={styles.metaDot} />
                    <Text style={styles.metaText}>{metaPieces[1]}</Text>
                    <View style={styles.metaDot} />
                    <Text style={styles.metaText}>{metaPieces[2]}</Text>
                </View>
            </View>

            <View style={styles.action}>
                {joining ? (
                    <View style={[styles.button, styles.buttonJoining]}>
                        <ActivityIndicator size="small" color="#fff" />
                    </View>
                ) : challenge.joined ? (
                    <View style={[styles.button, styles.buttonOpen]}>
                        <Text style={styles.buttonOpenText}>Open</Text>
                    </View>
                ) : (
                    <View style={[styles.button, styles.buttonJoin]}>
                        <Text style={styles.buttonJoinText}>Join</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    emojiContainer: {
        width: 48,
        height: 48,
        borderRadius: 10,
        backgroundColor: colors.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    emoji: {
        fontSize: 24,
    },
    body: {
        flex: 1,
        marginRight: 10,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    title: {
        fontSize: 16,
        fontWeight: '800',
        color: colors.text,
        flexShrink: 1,
    },
    joinedBadge: {
        backgroundColor: colors.success + '20',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    joinedBadgeText: {
        color: colors.success,
        fontSize: 11,
        fontWeight: '800',
    },
    description: {
        fontSize: 12,
        color: colors.textMuted,
        lineHeight: 16,
        marginBottom: 8,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
    },
    metaText: {
        fontSize: 11,
        color: colors.textSubtle,
        fontWeight: '600',
    },
    metaDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: colors.textSubtle,
    },
    action: {
        alignSelf: 'stretch',
        justifyContent: 'center',
    },
    button: {
        minWidth: 72,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonJoin: {
        backgroundColor: colors.primary,
    },
    buttonJoinText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 14,
    },
    buttonOpen: {
        backgroundColor: colors.primary + '18',
        borderWidth: 1,
        borderColor: colors.primary,
    },
    buttonOpenText: {
        color: colors.primary,
        fontWeight: '800',
        fontSize: 14,
    },
    buttonJoining: {
        backgroundColor: colors.primary,
        opacity: 0.7,
    },
});
