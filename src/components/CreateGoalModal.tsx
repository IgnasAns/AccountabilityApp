import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { colors } from '../theme/colors';
import { safeHaptics } from '../utils/haptics';
import { sanitizeName, sanitizeNumber, sanitizeText } from '../utils/sanitize';
import GoalTemplatePicker from './GoalTemplatePicker';
import { GoalTemplate } from '../types/database';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSubmit: (
        name: string,
        emoji: string,
        goalMode: 'positive' | 'negative',
        frequencyDays: number,
        penaltyAmount: number,
        targetPerWeek: number | null,
        description?: string
    ) => Promise<void>;
    groupName: string;
    defaultPenalty: number;
}

const POSITIVE_EMOJIS = ['🏃', '💪', '📚', '🧘', '🥗', '💧', '😴', '🎯', '✍️', '🧹', '💊', '🚴'];
const NEGATIVE_EMOJIS = ['🚭', '🍺', '🍰', '📱', '🎮', '☕', '🍕', '💸', '😤', '🛋️', '🍫', '🥤'];

const FREQUENCY_OPTIONS = [
    { label: 'Daily', days: 1, perWeek: 7 },
    { label: '3x/week', days: 2, perWeek: 3 },
    { label: 'Every 2 days', days: 2, perWeek: null },
    { label: 'Every 3 days', days: 3, perWeek: null },
    { label: 'Weekly', days: 7, perWeek: 1 },
    { label: 'Custom', days: 0, perWeek: null },
];

export default function CreateGoalModal({
    visible,
    onClose,
    onSubmit,
    groupName,
    defaultPenalty,
}: Props) {
    // Mode selection
    const [goalMode, setGoalMode] = useState<'positive' | 'negative'>('positive');

    // Form fields
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedEmoji, setSelectedEmoji] = useState('🎯');
    const [frequencyDays, setFrequencyDays] = useState(3);
    const [targetPerWeek, setTargetPerWeek] = useState<number | null>(null);
    const [customDays, setCustomDays] = useState('3');
    const [customPerWeek, setCustomPerWeek] = useState('3');
    const [penalty, setPenalty] = useState(defaultPenalty.toString());
    const [loading, setLoading] = useState(false);
    const [selectedFrequency, setSelectedFrequency] = useState(3); // Default to "Every 3 days"
    const [showTemplatePicker, setShowTemplatePicker] = useState(false);
    const [errors, setErrors] = useState<{ name?: string; penalty?: string; custom?: string }>({});

    const validateForm = (): boolean => {
        const newErrors: typeof errors = {};
        const sanitizedName = sanitizeName(name, 100);
        if (!sanitizedName || sanitizedName.length < 2) {
            newErrors.name = 'Task name must be at least 2 characters';
        }

        const rawPenalty = Number.parseFloat(penalty);
        if (!Number.isFinite(rawPenalty) || rawPenalty <= 0) {
            newErrors.penalty = 'Penalty must be greater than 0';
        }

        if (selectedFrequency === 5 && goalMode === 'positive') {
            const perWeek = Number.parseInt(customPerWeek, 10);
            const days = Number.parseInt(customDays, 10);
            if ((!Number.isInteger(perWeek) || perWeek < 1 || perWeek > 7) && (!Number.isInteger(days) || days < 1 || days > 365)) {
                newErrors.custom = 'Enter 1-7 times per week or every 1-365 days';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle template selection
    const handleTemplateSelect = (template: GoalTemplate) => {
        safeHaptics('success');
        setName(template.name);
        setDescription(template.description || '');
        setSelectedEmoji(template.emoji);
        setGoalMode(template.goal_mode);
        setPenalty(template.suggested_penalty.toString());

        if (template.suggested_target_per_week) {
            setTargetPerWeek(template.suggested_target_per_week);
            // Find matching frequency option
            const idx = FREQUENCY_OPTIONS.findIndex(
                opt => opt.perWeek === template.suggested_target_per_week
            );
            setSelectedFrequency(idx >= 0 ? idx : 0);
        } else {
            setFrequencyDays(template.suggested_frequency_days);
            const idx = FREQUENCY_OPTIONS.findIndex(
                opt => opt.days === template.suggested_frequency_days && opt.perWeek === null
            );
            setSelectedFrequency(idx >= 0 ? idx : 3);
        }
    };

    const handleModeChange = (mode: 'positive' | 'negative') => {
        safeHaptics('light');
        setGoalMode(mode);
        // Reset emoji based on mode
        setSelectedEmoji(mode === 'positive' ? '🎯' : '🚭');
        // For negative mode, reset penalty to smaller value
        if (mode === 'negative') {
            setPenalty('0.50');
        } else {
            setPenalty(defaultPenalty.toString());
        }
    };

    const handleFrequencySelect = (index: number) => {
        safeHaptics('light');
        setSelectedFrequency(index);
        const option = FREQUENCY_OPTIONS[index];
        if (option.days > 0) {
            setFrequencyDays(option.days);
            setTargetPerWeek(option.perWeek);
        }
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            safeHaptics('warning');
            return;
        }

        try {
            setLoading(true);
            safeHaptics('medium');

            let finalDays = frequencyDays;
            let finalPerWeek = targetPerWeek;

            if (selectedFrequency === 5) { // Custom
                if (goalMode === 'positive') {
                    // Custom can be either X times per week or every X days
                    const perWeek = Number.parseInt(customPerWeek, 10);
                    const days = Number.parseInt(customDays, 10);
                    finalPerWeek = Number.isInteger(perWeek) && perWeek >= 1 && perWeek <= 7 ? perWeek : null;
                    finalDays = Number.isInteger(days) && days >= 1 && days <= 365 ? days : 1;
                } else {
                    finalDays = 1; // Negative goals are logged individually
                }
            }

            const penaltyAmount = sanitizeNumber(penalty, 0.01, 10000, defaultPenalty);
            const sanitizedName = sanitizeName(name, 100);
            const sanitizedDescription = description.trim() ? sanitizeText(description, 500) : undefined;

            await onSubmit(
                sanitizedName,
                selectedEmoji,
                goalMode,
                finalDays,
                penaltyAmount,
                finalPerWeek,
                sanitizedDescription
            );

            // Reset form
            resetForm();
            onClose();
        } catch {
            // Error handled by caller
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setName('');
        setDescription('');
        setGoalMode('positive');
        setSelectedEmoji('🎯');
        setFrequencyDays(3);
        setTargetPerWeek(null);
        setSelectedFrequency(3);
        setPenalty(defaultPenalty.toString());
        setErrors({});
    };

    const handleClose = () => {
        if (!loading) {
            setErrors({});
            onClose();
        }
    };

    const currentEmojis = goalMode === 'positive' ? POSITIVE_EMOJIS : NEGATIVE_EMOJIS;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoidingView}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={handleClose}
                    style={styles.overlay}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => { }}
                        style={styles.modalContent}
                    >
                        {/* Handle bar */}
                        <View style={styles.handleBarContainer}>
                            <View style={styles.handleBar} />
                        </View>

                        <ScrollView
                            style={styles.scrollView}
                            contentContainerStyle={styles.contentContainer}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {/* Header */}
                            <View style={styles.header}>
                                <Text style={styles.title}>Create Task</Text>
                                <Text style={styles.subtitle}>in {groupName}</Text>
                            </View>

                            {/* Browse Templates Button */}
                            <TouchableOpacity
                                style={styles.templateButton}
                                onPress={() => setShowTemplatePicker(true)}
                            >
                                <Text style={styles.templateButtonEmoji}>📋</Text>
                                <View style={styles.templateButtonTextContainer}>
                                    <Text style={styles.templateButtonTitle}>Browse Templates</Text>
                                    <Text style={styles.templateButtonSubtitle}>Quick-start with pre-built goals</Text>
                                </View>
                                <Text style={styles.templateButtonArrow}>→</Text>
                            </TouchableOpacity>

                            {/* Mode Selector */}
                            <View style={styles.modeSelector}>
                                <TouchableOpacity
                                    style={[
                                        styles.modeButton,
                                        goalMode === 'positive' && styles.modeButtonActive,
                                    ]}
                                    onPress={() => handleModeChange('positive')}
                                >
                                    <Text style={styles.modeEmoji}>✅</Text>
                                    <Text style={[
                                        styles.modeText,
                                        goalMode === 'positive' && styles.modeTextActive,
                                    ]}>
                                        Achievement
                                    </Text>
                                    <Text style={styles.modeSubtext}>
                                        Track positive habits
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.modeButton,
                                        goalMode === 'negative' && styles.modeButtonActiveNeg,
                                    ]}
                                    onPress={() => handleModeChange('negative')}
                                >
                                    <Text style={styles.modeEmoji}>🚫</Text>
                                    <Text style={[
                                        styles.modeText,
                                        goalMode === 'negative' && styles.modeTextActiveNeg,
                                    ]}>
                                        Breaking Bad
                                    </Text>
                                    <Text style={styles.modeSubtext}>
                                        Count slip-ups
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Goal Name */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    {goalMode === 'positive' ? 'Goal Name *' : 'Bad Habit Name *'}
                                </Text>
                                <TextInput
                                    value={name}
                                    onChangeText={(text) => {
                                        setName(text);
                                        if (errors.name) setErrors({ ...errors, name: undefined });
                                    }}
                                    placeholder={goalMode === 'positive'
                                        ? "e.g., Go to the gym"
                                        : "e.g., Smoking cigarettes"}
                                    placeholderTextColor={colors.textMuted}
                                    style={[styles.input, errors.name ? styles.inputError : undefined]}
                                    editable={!loading}
                                    maxLength={100}
                                />
                                {errors.name && (
                                    <Text style={styles.errorText}>{errors.name}</Text>
                                )}
                            </View>

                            {/* Emoji Picker */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Choose an Icon</Text>
                                <View style={styles.emojiGrid}>
                                    {currentEmojis.map((emoji) => (
                                        <TouchableOpacity
                                            key={emoji}
                                            style={[
                                                styles.emojiButton,
                                                selectedEmoji === emoji && (
                                                    goalMode === 'positive'
                                                        ? styles.emojiButtonSelected
                                                        : styles.emojiButtonSelectedNeg
                                                ),
                                            ]}
                                            onPress={() => {
                                                safeHaptics('selection');
                                                setSelectedEmoji(emoji);
                                            }}
                                        >
                                            <Text style={styles.emojiText}>{emoji}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Frequency - Only for positive goals */}
                            {goalMode === 'positive' && (
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>How Often?</Text>
                                    <Text style={styles.helperText}>
                                        You must complete this goal within the period
                                    </Text>
                                    <View style={styles.frequencyGrid}>
                                        {FREQUENCY_OPTIONS.map((option, index) => (
                                            <TouchableOpacity
                                                key={option.label}
                                                style={[
                                                    styles.frequencyButton,
                                                    selectedFrequency === index && styles.frequencyButtonSelected,
                                                ]}
                                                onPress={() => handleFrequencySelect(index)}
                                            >
                                                <Text
                                                    style={[
                                                        styles.frequencyText,
                                                        selectedFrequency === index && styles.frequencyTextSelected,
                                                    ]}
                                                >
                                                    {option.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    {selectedFrequency === 5 && (
                                        <View style={styles.customContainer}>
                                            <View style={styles.customRow}>
                                                <Text style={styles.customLabel}>Times per week:</Text>
                                                <TextInput
                                                    value={customPerWeek}
                                                    onChangeText={(text) => {
                                                        setCustomPerWeek(text);
                                                        if (errors.custom) setErrors({ ...errors, custom: undefined });
                                                    }}
                                                    keyboardType="number-pad"
                                                    style={[styles.customInput, errors.custom ? styles.inputError : undefined]}
                                                    editable={!loading}
                                                />
                                            </View>
                                            <Text style={styles.orText}>— OR —</Text>
                                            <View style={styles.customRow}>
                                                <Text style={styles.customLabel}>Every</Text>
                                                <TextInput
                                                    value={customDays}
                                                    onChangeText={(text) => {
                                                        setCustomDays(text);
                                                        if (errors.custom) setErrors({ ...errors, custom: undefined });
                                                    }}
                                                    keyboardType="number-pad"
                                                    style={[styles.customInput, errors.custom ? styles.inputError : undefined]}
                                                    editable={!loading}
                                                />
                                                <Text style={styles.customLabel}>days</Text>
                                            </View>
                                            {errors.custom && (
                                                <Text style={styles.errorText}>{errors.custom}</Text>
                                            )}
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Penalty */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Penalty Amount (€)</Text>
                                <Text style={styles.helperText}>
                                    {goalMode === 'positive'
                                        ? 'Amount charged when missing the deadline'
                                        : 'Amount charged each time you slip up'}
                                </Text>
                                <TextInput
                                    value={penalty}
                                    onChangeText={(text) => {
                                        setPenalty(text);
                                        if (errors.penalty) setErrors({ ...errors, penalty: undefined });
                                    }}
                                    placeholder="0.50"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="decimal-pad"
                                    style={[styles.input, errors.penalty ? styles.inputError : undefined]}
                                    editable={!loading}
                                />
                                {errors.penalty && (
                                    <Text style={styles.errorText}>{errors.penalty}</Text>
                                )}
                            </View>

                            {/* Description */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Description (optional)</Text>
                                <TextInput
                                    value={description}
                                    onChangeText={setDescription}
                                    placeholder="Additional details..."
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    numberOfLines={2}
                                    style={[styles.input, styles.multilineInput]}
                                    editable={!loading}
                                />
                            </View>

                            {/* Preview */}
                            <View style={[
                                styles.previewCard,
                                goalMode === 'negative' && styles.previewCardNeg
                            ]}>
                                <Text style={styles.previewTitle}>Preview</Text>
                                <View style={styles.previewContent}>
                                    <Text style={styles.previewEmoji}>{selectedEmoji}</Text>
                                    <View style={styles.previewInfo}>
                                        <Text style={styles.previewName}>{name || 'Task Name'}</Text>
                                        <Text style={styles.previewFrequency}>
                                            {goalMode === 'positive'
                                                ? `${targetPerWeek ? `${targetPerWeek}x/week` : `Every ${frequencyDays} days`} • €${parseFloat(penalty) || defaultPenalty} penalty`
                                                : `€${parseFloat(penalty) || 0.5} per slip-up`}
                                        </Text>
                                        <View style={[
                                            styles.previewBadge,
                                            goalMode === 'negative' && styles.previewBadgeNeg
                                        ]}>
                                            <Text style={styles.previewBadgeText}>
                                                {goalMode === 'positive' ? '✅ Achievement' : '🚫 Breaking Bad'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Buttons */}
                            <View style={styles.buttonRow}>
                                <TouchableOpacity
                                    onPress={handleClose}
                                    disabled={loading}
                                    style={styles.cancelButton}
                                >
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleSubmit}
                                    disabled={loading}
                                    style={[
                                        styles.submitButton,
                                        goalMode === 'negative' && styles.submitButtonNeg,
                                        loading && styles.disabledButton,
                                    ]}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.submitButtonText}>Create Task</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </KeyboardAvoidingView>

            {/* Template Picker Modal */}
            <GoalTemplatePicker
                visible={showTemplatePicker}
                onClose={() => setShowTemplatePicker(false)}
                onSelectTemplate={handleTemplateSelect}
            />
        </Modal>
    );
}

const styles = StyleSheet.create({
    keyboardAvoidingView: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '92%',
    },
    handleBarContainer: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    handleBar: {
        width: 40,
        height: 4,
        backgroundColor: colors.border,
        borderRadius: 2,
    },
    scrollView: {
        flexGrow: 0,
    },
    contentContainer: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        color: colors.text,
        fontSize: 24,
        fontWeight: 'bold',
    },
    subtitle: {
        color: colors.textMuted,
        marginTop: 4,
    },
    modeSelector: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    modeButton: {
        flex: 1,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    modeButtonActive: {
        borderColor: colors.success,
        backgroundColor: `${colors.success}15`,
    },
    modeButtonActiveNeg: {
        borderColor: colors.error,
        backgroundColor: `${colors.error}15`,
    },
    modeEmoji: {
        fontSize: 28,
        marginBottom: 8,
    },
    modeText: {
        color: colors.text,
        fontWeight: '600',
        fontSize: 14,
    },
    modeTextActive: {
        color: colors.success,
    },
    modeTextActiveNeg: {
        color: colors.error,
    },
    modeSubtext: {
        color: colors.textMuted,
        fontSize: 11,
        marginTop: 2,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        color: colors.text,
        fontWeight: '600',
        marginBottom: 8,
    },
    helperText: {
        color: colors.textMuted,
        fontSize: 12,
        marginBottom: 8,
    },
    input: {
        backgroundColor: colors.surfaceHighlight,
        color: colors.text,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 12,
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
        lineHeight: 16,
    },
    multilineInput: {
        minHeight: 70,
        textAlignVertical: 'top',
    },
    emojiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    emojiButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    emojiButtonSelected: {
        borderColor: colors.success,
        backgroundColor: `${colors.success}20`,
    },
    emojiButtonSelectedNeg: {
        borderColor: colors.error,
        backgroundColor: `${colors.error}20`,
    },
    emojiText: {
        fontSize: 22,
    },
    frequencyGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    frequencyButton: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: colors.surfaceHighlight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    frequencyButtonSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    frequencyText: {
        color: colors.textMuted,
        fontSize: 13,
    },
    frequencyTextSelected: {
        color: '#fff',
        fontWeight: '600',
    },
    customContainer: {
        marginTop: 12,
        padding: 16,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 12,
    },
    customRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    customLabel: {
        color: colors.textMuted,
    },
    customInput: {
        backgroundColor: colors.surface,
        color: colors.text,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        width: 60,
        textAlign: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    orText: {
        color: colors.textMuted,
        textAlign: 'center',
        marginVertical: 8,
        fontSize: 12,
    },
    previewCard: {
        backgroundColor: `${colors.success}10`,
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: `${colors.success}30`,
    },
    previewCardNeg: {
        backgroundColor: `${colors.error}10`,
        borderColor: `${colors.error}30`,
    },
    previewTitle: {
        color: colors.textMuted,
        fontSize: 11,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    previewContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    previewEmoji: {
        fontSize: 36,
        marginRight: 14,
    },
    previewInfo: {
        flex: 1,
    },
    previewName: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '600',
    },
    previewFrequency: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 3,
    },
    previewBadge: {
        backgroundColor: `${colors.success}20`,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginTop: 8,
    },
    previewBadgeNeg: {
        backgroundColor: `${colors.error}20`,
    },
    previewBadgeText: {
        color: colors.text,
        fontSize: 11,
        fontWeight: '500',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: colors.surfaceHighlight,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: colors.text,
        fontWeight: '600',
    },
    submitButton: {
        flex: 1,
        backgroundColor: colors.success,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    submitButtonNeg: {
        backgroundColor: colors.error,
    },
    disabledButton: {
        opacity: 0.6,
    },
    submitButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    templateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 2,
        borderColor: colors.primary + '30',
        borderStyle: 'dashed',
    },
    templateButtonEmoji: {
        fontSize: 28,
        marginRight: 14,
    },
    templateButtonTextContainer: {
        flex: 1,
    },
    templateButtonTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2,
    },
    templateButtonSubtitle: {
        color: colors.textMuted,
        fontSize: 12,
    },
    templateButtonArrow: {
        color: colors.primary,
        fontSize: 20,
        fontWeight: 'bold',
    },
});
