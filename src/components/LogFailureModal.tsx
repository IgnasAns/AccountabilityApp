import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { logFailure } from '../services/supabase';
import { colors } from '../theme/colors';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    groupId: string;
    groupName: string;
    penaltyAmount: number;
    memberCount: number;
}

export default function LogFailureModal({
    visible,
    onClose,
    onSuccess,
    groupId,
    groupName,
    penaltyAmount,
    memberCount,
}: Props) {
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    const totalDebt = penaltyAmount * memberCount;

    const handleConfirm = async () => {
        try {
            setLoading(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

            const result = await logFailure(groupId, description || undefined);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            if (result) {
                Alert.alert(
                    'Failure Logged 😔',
                    `${result.transactions_created} debt${result.transactions_created !== 1 ? 's' : ''} created.\nTotal: €${result.total_debt.toFixed(2)}`,
                    [{ text: 'OK', onPress: onSuccess }]
                );
            } else {
                Alert.alert('Failure Logged', 'Your failure has been recorded.', [{ text: 'OK', onPress: onSuccess }]);
            }

            setDescription('');
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setDescription('');
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

                        <View style={styles.contentContainer}>
                            {/* Header */}
                            <View style={styles.header}>
                                <Text style={styles.headerEmoji}>😔</Text>
                                <Text style={styles.title}>
                                    Log a Failure
                                </Text>
                                <Text style={styles.subtitle}>
                                    in {groupName}
                                </Text>
                            </View>

                            {/* Debt Summary */}
                            <View style={styles.debtSummaryCard}>
                                <Text style={styles.debtSummaryTitle}>
                                    This will create the following debts:
                                </Text>
                                <View style={styles.benefitRow}>
                                    <Text style={styles.benefitLabel}>Penalty per person</Text>
                                    <Text style={styles.benefitValue}>€{penaltyAmount.toFixed(2)}</Text>
                                </View>
                                <View style={styles.benefitRow}>
                                    <Text style={styles.benefitLabel}>Number of members</Text>
                                    <Text style={styles.memberCountValue}>× {memberCount}</Text>
                                </View>
                                <View style={styles.separator} />
                                <View style={styles.benefitRow}>
                                    <Text style={styles.totalLabel}>Total debt</Text>
                                    <Text style={styles.totalValue}>€{totalDebt.toFixed(2)}</Text>
                                </View>
                            </View>

                            {/* Description Input */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>
                                    What happened? (optional)
                                </Text>
                                <TextInput
                                    value={description}
                                    onChangeText={setDescription}
                                    placeholder="e.g., Smoked 1 cigarette..."
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    numberOfLines={2}
                                    style={styles.input}
                                    editable={!loading}
                                />
                            </View>

                            {/* Action Buttons */}
                            <View style={styles.buttonRow}>
                                <TouchableOpacity
                                    onPress={handleClose}
                                    disabled={loading}
                                    style={styles.cancelButton}
                                >
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleConfirm}
                                    disabled={loading || memberCount === 0}
                                    style={[
                                        styles.confirmButton,
                                        (loading || memberCount === 0) && styles.disabledButton
                                    ]}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.confirmButtonText}>Confirm Failure</Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {memberCount === 0 && (
                                <Text style={styles.warningText}>
                                    ⚠️ No other members in the group. Invite friends first!
                                </Text>
                            )}
                        </View>
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
    contentContainer: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    headerEmoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    title: {
        color: colors.text,
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    subtitle: {
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: 8,
    },
    debtSummaryCard: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)', // error with opacity
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    debtSummaryTitle: {
        color: colors.error,
        textAlign: 'center',
        marginBottom: 16,
        fontWeight: '500',
    },
    benefitRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    benefitLabel: {
        color: colors.textMuted,
    },
    benefitValue: {
        color: colors.error,
        fontWeight: 'bold',
    },
    memberCountValue: {
        color: colors.text,
        fontWeight: 'bold',
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        marginVertical: 12,
    },
    totalLabel: {
        color: colors.text,
        fontWeight: '600',
    },
    totalValue: {
        color: colors.error,
        fontSize: 24,
        fontWeight: 'bold',
    },
    inputContainer: {
        marginBottom: 24,
    },
    label: {
        color: colors.textMuted,
        fontSize: 14,
        marginBottom: 8,
    },
    input: {
        backgroundColor: colors.surfaceHighlight,
        color: colors.text,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        textAlignVertical: 'top',
        minHeight: 70,
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
    confirmButton: {
        flex: 1,
        backgroundColor: colors.error,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    disabledButton: {
        opacity: 0.6,
    },
    confirmButtonText: {
        color: '#ffffff',
        fontWeight: 'bold',
    },
    warningText: {
        color: colors.warning,
        textAlign: 'center',
        marginTop: 16,
        fontSize: 14,
    },
});
