import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import AppIcon, { AppIconName } from '../components/AppIcon';

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

    const handleTemplatePress = (template: typeof CHALLENGE_TEMPLATES[0]) => {
        navigation.navigate('CreateGroup', {
            initialName: template.title,
            initialDescription: template.description,
            initialPenalty: template.defaultPenalty.toString(),
        });
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Explore Challenges</Text>
                <Text style={styles.headerSubtitle}>Pick a template to start instantly</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
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
