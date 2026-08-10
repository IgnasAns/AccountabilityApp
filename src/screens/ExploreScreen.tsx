import React, { useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import AppIcon, { AppIconName } from '../components/AppIcon';
import PublicChallengeCard from '../components/challenges/PublicChallengeCard';
import { usePublicChallenges, PublicChallenge } from '../hooks/usePublicChallenges';
import { safeHaptics } from '../utils/haptics';
import { StyledAlert } from '../components/StyledAlert';

interface Props {
    navigation: NativeStackNavigationProp<any>;
}

const CHALLENGE_TEMPLATES = [
    {
        id: 'early-riser',
        icon: 'weather-sunset-up' as AppIconName,
        title: 'Early Riser',
        description: 'Wake up before 7AM every day. Post a photo of your watch or sunrise.',
        defaultPenalty: 5,
    },
    {
        id: 'gym-pact',
        icon: 'dumbbell' as AppIconName,
        title: 'Gym Pact',
        description: 'Hit the gym 3 times a week. Post a selfie at the gym.',
        defaultPenalty: 10,
    },
    {
        id: 'reader',
        icon: 'book-open-page-variant-outline' as AppIconName,
        title: 'Daily Reader',
        description: 'Read 10 pages every day. Post a photo of the page you finished.',
        defaultPenalty: 5,
    },
    {
        id: 'no-sugar',
        icon: 'candy-off-outline' as AppIconName,
        title: 'No Sugar',
        description: 'Avoid added sugar. If you slip up, you pay.',
        defaultPenalty: 20,
    },
    {
        id: 'hydrate',
        icon: 'water-outline' as AppIconName,
        title: 'Hydration Station',
        description: 'Drink 2L of water daily. Track it or pay up.',
        defaultPenalty: 2,
    },
    {
        id: 'steps',
        icon: 'shoe-print' as AppIconName,
        title: '10k Steps',
        description: 'Walk 10,000 steps every day. Screenshot your tracker.',
        defaultPenalty: 5,
    },
];

export default function ExploreScreen({ navigation }: Props) {
    const insets = useSafeAreaInsets();
    const {
        challenges,
        loading: challengesLoading,
        error: challengesError,
        joiningSlug,
        joinChallenge,
        refetch: refetchChallenges,
    } = usePublicChallenges();

    // Keep the join state fresh when the tab regains focus (e.g. coming back
    // from a challenge group the user just joined).
    useFocusEffect(
        useCallback(() => {
            refetchChallenges({ silent: true });
        }, [refetchChallenges])
    );

    const handleTemplatePress = (template: typeof CHALLENGE_TEMPLATES[0]) => {
        navigation.navigate('CreateGroup', {
            initialName: template.title,
            initialDescription: template.description,
            initialPenalty: template.defaultPenalty.toString(),
        });
    };

    const handleJoinChallenge = async (challenge: PublicChallenge) => {
        try {
            const result = await joinChallenge(challenge.slug);
            safeHaptics('success');

            // Land the user in the shared challenge group and surface the
            // invite/share moment once — same route-param mechanism the
            // group-creation flow uses.
            navigation.navigate('GroupDetail', {
                groupId: result.groupId,
                showInviteModal: true,
            });
        } catch (error: unknown) {
            safeHaptics('error');
            StyledAlert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to join challenge'
            );
        }
    };

    const handleOpenChallenge = (challenge: PublicChallenge) => {
        if (!challenge.group_id) return;
        safeHaptics('light');
        navigation.navigate('GroupDetail', { groupId: challenge.group_id });
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Explore Challenges</Text>
                <Text style={styles.headerSubtitle}>Join a shared challenge or start your own</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Public Challenges — one-tap shared groups, no invites needed */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>🔥 Public Challenges</Text>
                    <Text style={styles.sectionSubtitle}>
                        Join a challenge and instantly get a group, streaks and penalties — no invites needed
                    </Text>
                </View>

                {challengesLoading && challenges.length === 0 ? (
                    <View style={styles.loadingRow}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.loadingText}>Loading challenges…</Text>
                    </View>
                ) : challengesError && challenges.length === 0 ? (
                    <TouchableOpacity
                        style={styles.loadingRow}
                        onPress={() => refetchChallenges()}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.errorText}>Couldn't load challenges. Tap to retry.</Text>
                    </TouchableOpacity>
                ) : (
                    challenges.map((challenge) => (
                        <PublicChallengeCard
                            key={challenge.slug}
                            challenge={challenge}
                            joining={joiningSlug === challenge.slug}
                            onJoin={() => handleJoinChallenge(challenge)}
                            onOpen={() => handleOpenChallenge(challenge)}
                        />
                    ))
                )}

                {/* Start-your-own templates */}
                <View style={[styles.sectionHeader, styles.templatesSectionHeader]}>
                    <Text style={styles.sectionTitle}>💪 Start Your Own</Text>
                    <Text style={styles.sectionSubtitle}>
                        Pick a template and invite your friends
                    </Text>
                </View>

                <View style={styles.grid}>
                    {CHALLENGE_TEMPLATES.map((template) => (
                        <TouchableOpacity
                            key={template.id}
                            style={styles.card}
                            onPress={() => handleTemplatePress(template)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.cardHeader}>
                                <View style={styles.emojiContainer}>
                                    <AppIcon name={template.icon} size={25} color={colors.primary} />
                                </View>
                                <View style={styles.priceTag}>
                                    <Text style={styles.priceText}>€{template.defaultPenalty}</Text>
                                </View>
                            </View>

                            <Text style={styles.cardTitle}>{template.title}</Text>
                            <Text style={styles.cardDesc} numberOfLines={3}>
                                {template.description}
                            </Text>

                            <View style={styles.cardFooter}>
                                <Text style={styles.startText}>Start Challenge</Text>
                                <AppIcon name="arrow-right" size={16} color={colors.primary} />
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
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
        paddingBottom: 20,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 16,
        color: colors.textMuted,
    },
    content: {
        padding: 16,
    },
    sectionHeader: {
        marginBottom: 12,
    },
    templatesSectionHeader: {
        marginTop: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: colors.textMuted,
        lineHeight: 18,
        marginBottom: 4,
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 24,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 12,
    },
    loadingText: {
        color: colors.textMuted,
        fontSize: 14,
    },
    errorText: {
        color: colors.textMuted,
        fontSize: 13,
        textAlign: 'center',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    card: {
        width: '48%',
        backgroundColor: colors.surface,
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    emojiContainer: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: colors.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
    },
    priceTag: {
        backgroundColor: colors.error + '20',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    priceText: {
        color: colors.error,
        fontWeight: '800',
        fontSize: 12,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 8,
    },
    cardDesc: {
        fontSize: 13,
        color: colors.textMuted,
        lineHeight: 18,
        marginBottom: 16,
        flex: 1,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    startText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.primary,
    },
});
