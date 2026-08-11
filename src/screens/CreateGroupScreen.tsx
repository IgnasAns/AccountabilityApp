import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    StyleSheet,
    Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGroups } from '../hooks/useGroups';
import { useAuth } from '../hooks/useAuth';
import { usePremium } from '../hooks/usePremium';
import { colors } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyledAlert } from '../components/StyledAlert';
import PaywallModal from '../components/PaywallModal';
import { supabase } from '../services/supabase';
import { sanitizeName, sanitizeText, sanitizeNumber } from '../utils/sanitize';
import { safeHaptics } from '../utils/haptics';
import { rateLimiters } from '../utils/rateLimiter';
import AppIcon from '../components/AppIcon';

interface Props {
    navigation: NativeStackNavigationProp<any>;
    route?: {
        params?: {
            initialName?: string;
            initialDescription?: string;
            initialPenalty?: string;
        };
    };
}

export default function CreateGroupScreen({ navigation, route }: Props) {
    const { createGroup } = useGroups();
    const { user } = useAuth();
    const { isPremium, loading: premiumLoading, refresh: refreshPremium } = usePremium();
    const insets = useSafeAreaInsets();
    const [name, setName] = useState(route?.params?.initialName || '');
    const [description, setDescription] = useState(route?.params?.initialDescription || '');
    const [penaltyAmount, setPenaltyAmount] = useState(route?.params?.initialPenalty || '5');
    const [loading, setLoading] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);
    const [errors, setErrors] = useState<{ name?: string; penalty?: string }>({});

    React.useEffect(() => {
        const params = route?.params;
        if (!params) return;

        if (params.initialName !== undefined) setName(params.initialName);
        if (params.initialDescription !== undefined) setDescription(params.initialDescription);
        if (params.initialPenalty !== undefined) setPenaltyAmount(params.initialPenalty);
    }, [route?.params?.initialName, route?.params?.initialDescription, route?.params?.initialPenalty]);

    const validateForm = (): boolean => {
        const newErrors: typeof errors = {};

        const sanitizedName = sanitizeName(name, 100);
        if (!sanitizedName || sanitizedName.length < 3) {
            newErrors.name = 'Group name must be at least 3 characters';
        }

        const rawPenalty = Number.parseFloat(penaltyAmount);
        if (!Number.isFinite(rawPenalty) || rawPenalty <= 0) {
            newErrors.penalty = 'Penalty must be greater than 0';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleCreate = async () => {
        if (!validateForm()) {
            safeHaptics('warning');
            return;
        }

        // Rate limit check
        if (!rateLimiters.general.canProceed('createGroup')) {
            StyledAlert.alert('Slow Down', 'Please wait before creating another group.');
            return;
        }

        // Free-tier gate (client check): a free account may create ONE
        // user-created group. Public-challenge groups ('CH…' invite codes)
        // never count. Skipped while premium state is still loading — the
        // server trigger is authoritative and the catch below maps
        // FREE_TIER_GROUP_LIMIT to the paywall if this check is bypassed.
        if (!isPremium && !premiumLoading && user) {
            const { count, error: countError } = await supabase
                .from('groups')
                .select('id', { count: 'exact', head: true })
                .eq('created_by', user.id)
                .not('invite_code', 'like', 'CH%');

            if (!countError && count !== null && count >= 1) {
                safeHaptics('warning');
                setShowPaywall(true);
                return;
            }
        }

        try {
            setLoading(true);
            safeHaptics('light');

            const sanitizedName = sanitizeName(name, 100);
            const sanitizedDescription = description ? sanitizeText(description, 500) : undefined;
            const penalty = sanitizeNumber(penaltyAmount, 0.01, 10000, 5);

            const group = await createGroup(
                sanitizedName,
                sanitizedDescription || undefined,
                penalty
            );

            safeHaptics('success');

            // Navigate to the new group, and ask GroupDetail to surface the
            // invite-code modal once so the creator can share the pact.
            navigation.replace('GroupDetail', { groupId: group.id, showInviteModal: true });
        } catch (error: unknown) {
            safeHaptics('error');
            const message = error instanceof Error ? error.message : "Failed to create group";
            if (message.includes('FREE_TIER_GROUP_LIMIT')) {
                // Server-side fallback: the free-tier cap fired despite the
                // client check (e.g. the user left their only group, or the
                // count query was masked by RLS). Route to the paywall.
                setShowPaywall(true);
                return;
            }
            StyledAlert.alert('Error', message);
        } finally {
            setLoading(false);
        }
    };

    const suggestedAmounts = [1, 2, 5, 10, 20];

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerIcon}>
                        <AppIcon name="target" size={34} color={colors.primary} />
                    </View>
                    <Text style={styles.title}>Create a Group</Text>
                    <Text style={styles.subtitle}>
                        Set up your accountability pact with friends
                    </Text>
                </View>

                {/* Group Name */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Group Name *</Text>
                    <TextInput
                        value={name}
                        onChangeText={(text) => {
                            setName(text);
                            if (errors.name) setErrors({ ...errors, name: undefined });
                        }}
                        placeholder="e.g., Gym Squad"
                        placeholderTextColor={colors.textMuted}
                        style={[styles.input, errors.name ? styles.inputError : undefined]}
                        editable={!loading}
                        maxLength={100}
                    />
                    {errors.name && (
                        <Text style={styles.errorText}>{errors.name}</Text>
                    )}
                </View>

                {/* Description */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Description (optional)</Text>
                    <TextInput
                        value={description}
                        onChangeText={setDescription}
                        placeholder="What's the pact about? What are the rules?"
                        placeholderTextColor={colors.textMuted}
                        multiline
                        numberOfLines={3}
                        style={[styles.input, styles.multilineInput]}
                        editable={!loading}
                        maxLength={500}
                    />
                    <Text style={styles.charCount}>{description.length}/500</Text>
                </View>

                {/* Penalty Amount */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Penalty Amount (€) *</Text>
                    <Text style={styles.helperText}>
                        How much do members pay when they fail?
                    </Text>

                    {/* Quick Select Buttons */}
                    <View style={styles.quickSelectRow}>
                        {suggestedAmounts.map((amount) => (
                            <TouchableOpacity
                                key={amount}
                                style={[
                                    styles.quickSelectButton,
                                    penaltyAmount === amount.toString() && styles.quickSelectActive,
                                ]}
                                onPress={() => {
                                    setPenaltyAmount(amount.toString());
                                    safeHaptics('selection');
                                }}
                            >
                                <Text
                                    style={[
                                        styles.quickSelectText,
                                        penaltyAmount === amount.toString() && styles.quickSelectTextActive,
                                    ]}
                                >
                                    €{amount}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Custom Input */}
                    <View style={styles.penaltyInputContainer}>
                        <Text style={styles.currencySymbol}>€</Text>
                        <TextInput
                            value={penaltyAmount}
                            onChangeText={(text) => {
                                setPenaltyAmount(text);
                                if (errors.penalty) setErrors({ ...errors, penalty: undefined });
                            }}
                            placeholder="5.00"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="decimal-pad"
                            style={styles.penaltyInput}
                            editable={!loading}
                        />
                    </View>
                    {errors.penalty && (
                        <Text style={styles.errorText}>{errors.penalty}</Text>
                    )}
                </View>

                {/* Preview Card */}
                <View style={styles.previewCard}>
                    <Text style={styles.previewLabel}>Preview</Text>
                    <View style={styles.previewContent}>
                        <View style={styles.previewIcon}>
                            <AppIcon name="target" size={28} color={colors.primary} />
                        </View>
                        <View style={styles.previewInfo}>
                            <Text style={styles.previewName}>
                                {sanitizeName(name, 30) || 'Your Group Name'}
                            </Text>
                            <Text style={styles.previewPenalty}>
                                €{sanitizeNumber(penaltyAmount, 0.01, 10000, 5).toFixed(2)} penalty per failure
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Create Button */}
                <TouchableOpacity
                    onPress={handleCreate}
                    disabled={loading}
                    style={[
                        styles.createButton,
                        loading && styles.disabledButton,
                    ]}
                    activeOpacity={0.8}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.createButtonText}>Create Group</Text>
                    )}
                </TouchableOpacity>

                {/* Info Box */}
                <View style={styles.infoBox}>
                    <View style={styles.infoIcon}>
                        <AppIcon name="lightbulb-on-outline" size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.infoText}>
                        After creating, you'll get an invite code to share with friends.
                        They can join using the code.
                    </Text>
                </View>
            </ScrollView>

            {/* Premium Paywall (free-tier group limit) */}
            <PaywallModal
                visible={showPaywall}
                onClose={() => setShowPaywall(false)}
                onPremiumChanged={refreshPremium}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    headerIcon: {
        width: 64,
        height: 64,
        borderRadius: 14,
        backgroundColor: colors.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: colors.textMuted,
        textAlign: 'center',
    },
    inputGroup: {
        marginBottom: 24,
    },
    label: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 8,
    },
    helperText: {
        color: colors.textMuted,
        fontSize: 13,
        marginBottom: 12,
    },
    input: {
        backgroundColor: colors.surface,
        color: colors.text,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        fontSize: 16,
    },
    inputError: {
        borderColor: colors.error,
    },
    errorText: {
        color: colors.error,
        fontSize: 12,
        marginTop: 6,
    },
    multilineInput: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    charCount: {
        color: colors.textMuted,
        fontSize: 12,
        textAlign: 'right',
        marginTop: 4,
    },
    quickSelectRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    quickSelectButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: 'center',
    },
    quickSelectActive: {
        borderColor: colors.primary,
        backgroundColor: colors.primary + '15',
    },
    quickSelectText: {
        color: colors.textMuted,
        fontWeight: '600',
        fontSize: 14,
    },
    quickSelectTextActive: {
        color: colors.primary,
    },
    penaltyInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 16,
    },
    currencySymbol: {
        color: colors.textMuted,
        fontSize: 18,
        fontWeight: '600',
        marginRight: 8,
    },
    penaltyInput: {
        flex: 1,
        color: colors.text,
        paddingVertical: 14,
        fontSize: 18,
        fontWeight: '600',
    },
    previewCard: {
        backgroundColor: colors.surface,
        borderRadius: 8,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.border,
    },
    previewLabel: {
        color: colors.textMuted,
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },
    previewContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    previewIcon: {
        width: 44,
        height: 44,
        borderRadius: 8,
        backgroundColor: colors.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    previewInfo: {
        flex: 1,
    },
    previewName: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    previewPenalty: {
        color: colors.textMuted,
        fontSize: 14,
    },
    createButton: {
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 10,
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    disabledButton: {
        opacity: 0.6,
    },
    createButtonText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 18,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: colors.primary + '10',
        borderRadius: 8,
        padding: 16,
        marginTop: 24,
        alignItems: 'flex-start',
    },
    infoIcon: {
        marginRight: 12,
        marginTop: 1,
    },
    infoText: {
        flex: 1,
        color: colors.textMuted,
        fontSize: 14,
        lineHeight: 20,
    },
});
