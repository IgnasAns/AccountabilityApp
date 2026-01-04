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
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSubmit: (
        name: string,
        emoji: string,
        frequencyDays: number,
        penaltyAmount: number,
        description?: string
    ) => Promise<void>;
    groupName: string;
    defaultPenalty: number;
}

const EMOJI_OPTIONS = ['🏃', '💪', '📚', '🧘', '🥗', '💧', '😴', '🚭', '🎯', '✍️', '🧹', '💊'];

const FREQUENCY_OPTIONS = [
    { label: 'Daily', days: 1 },
    { label: 'Every 2 days', days: 2 },
    { label: 'Every 3 days', days: 3 },
    { label: 'Weekly', days: 7 },
    { label: 'Custom', days: 0 },
];

export default function CreateGoalModal({
    visible,
    onClose,
    onSubmit,
    groupName,
    defaultPenalty,
}: Props) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedEmoji, setSelectedEmoji] = useState('🎯');
    const [frequencyDays, setFrequencyDays] = useState(3);
    const [customDays, setCustomDays] = useState('3');
    const [penalty, setPenalty] = useState(defaultPenalty.toString());
    const [loading, setLoading] = useState(false);
    const [selectedFrequency, setSelectedFrequency] = useState(2); // Default to "Every 3 days"

    const safeHaptics = () => {
        if (Platform.OS !== 'web') {
            try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (e) { }
        }
    };

    const handleFrequencySelect = (index: number) => {
        safeHaptics();
        setSelectedFrequency(index);
        const option = FREQUENCY_OPTIONS[index];
        if (option.days > 0) {
            setFrequencyDays(option.days);
        }
    };

    const handleSubmit = async () => {
        if (!name.trim()) return;

        try {
            setLoading(true);
            safeHaptics();

            const finalDays = selectedFrequency === 4 ? parseInt(customDays) || 1 : frequencyDays;
            const penaltyAmount = parseFloat(penalty) || defaultPenalty;

            await onSubmit(
                name.trim(),
                selectedEmoji,
                finalDays,
                penaltyAmount,
                description.trim() || undefined
            );

            // Reset form
            setName('');
            setDescription('');
            setSelectedEmoji('🎯');
            setFrequencyDays(3);
            setSelectedFrequency(2);
            setPenalty(defaultPenalty.toString());

            onClose();
        } catch (error) {
            console.error('Failed to create goal:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            onClose();
        }
    };

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
                                <Text style={styles.title}>Create Goal</Text>
                                <Text style={styles.subtitle}>in {groupName}</Text>
                            </View>

                            {/* Goal Name */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Goal Name *</Text>
                                <TextInput
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="e.g., Go to the gym"
                                    placeholderTextColor={colors.textMuted}
                                    style={styles.input}
                                    editable={!loading}
                                />
                            </View>

                            {/* Emoji Picker */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Choose an Icon</Text>
                                <View style={styles.emojiGrid}>
                                    {EMOJI_OPTIONS.map((emoji) => (
                                        <TouchableOpacity
                                            key={emoji}
                                            style={[
                                                styles.emojiButton,
                                                selectedEmoji === emoji && styles.emojiButtonSelected,
                                            ]}
                                            onPress={() => {
                                                safeHaptics();
                                                setSelectedEmoji(emoji);
                                            }}
                                        >
                                            <Text style={styles.emojiText}>{emoji}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Frequency */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>How Often?</Text>
                                <Text style={styles.helperText}>
                                    You must complete this goal at least once within this period
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

                                {selectedFrequency === 4 && (
                                    <View style={styles.customDaysContainer}>
                                        <Text style={styles.customDaysLabel}>Every</Text>
                                        <TextInput
                                            value={customDays}
                                            onChangeText={setCustomDays}
                                            keyboardType="number-pad"
                                            style={styles.customDaysInput}
                                            editable={!loading}
                                        />
                                        <Text style={styles.customDaysLabel}>days</Text>
                                    </View>
                                )}
                            </View>

                            {/* Penalty */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Penalty Amount (€)</Text>
                                <Text style={styles.helperText}>
                                    Amount charged when missing the deadline
                                </Text>
                                <TextInput
                                    value={penalty}
                                    onChangeText={setPenalty}
                                    placeholder="1.00"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="decimal-pad"
                                    style={styles.input}
                                    editable={!loading}
                                />
                            </View>

                            {/* Description */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Description (optional)</Text>
                                <TextInput
                                    value={description}
                                    onChangeText={setDescription}
                                    placeholder="Additional details about this goal..."
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    numberOfLines={2}
                                    style={[styles.input, styles.multilineInput]}
                                    editable={!loading}
                                />
                            </View>

                            {/* Preview */}
                            <View style={styles.previewCard}>
                                <Text style={styles.previewTitle}>Preview</Text>
                                <View style={styles.previewContent}>
                                    <Text style={styles.previewEmoji}>{selectedEmoji}</Text>
                                    <View style={styles.previewInfo}>
                                        <Text style={styles.previewName}>{name || 'Goal Name'}</Text>
                                        <Text style={styles.previewFrequency}>
                                            Every {selectedFrequency === 4 ? customDays : frequencyDays} days •
                                            €{parseFloat(penalty) || defaultPenalty} penalty
                                        </Text>
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
                                    disabled={loading || !name.trim()}
                                    style={[
                                        styles.submitButton,
                                        (loading || !name.trim()) && styles.disabledButton,
                                    ]}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.submitButtonText}>Create Goal</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </KeyboardAvoidingView>
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
        maxHeight: '90%',
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
        marginBottom: 24,
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
    multilineInput: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    emojiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    emojiButton: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    emojiButtonSelected: {
        borderColor: colors.primary,
        backgroundColor: `${colors.primary}20`,
    },
    emojiText: {
        fontSize: 24,
    },
    frequencyGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    frequencyButton: {
        paddingHorizontal: 16,
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
        fontSize: 14,
    },
    frequencyTextSelected: {
        color: '#fff',
        fontWeight: '600',
    },
    customDaysContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        gap: 8,
    },
    customDaysLabel: {
        color: colors.textMuted,
    },
    customDaysInput: {
        backgroundColor: colors.surfaceHighlight,
        color: colors.text,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        width: 60,
        textAlign: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    previewCard: {
        backgroundColor: `${colors.primary}10`,
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: `${colors.primary}30`,
    },
    previewTitle: {
        color: colors.textMuted,
        fontSize: 12,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    previewContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    previewEmoji: {
        fontSize: 40,
        marginRight: 16,
    },
    previewInfo: {
        flex: 1,
    },
    previewName: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '600',
    },
    previewFrequency: {
        color: colors.textMuted,
        fontSize: 13,
        marginTop: 4,
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
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    disabledButton: {
        opacity: 0.6,
    },
    submitButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});
