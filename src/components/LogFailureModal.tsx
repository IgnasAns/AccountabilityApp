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
import { logFailure } from '../services/supabase';
import { uploadProofPhoto } from '../services/photoService';
import { StyledAlert } from './StyledAlert';
import PhotoProofPicker from './PhotoProofPicker';
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
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState('');

    const totalDebt = penaltyAmount * memberCount;

    // Safe haptics helper (no-op on web)
    const safeHaptics = (type: 'success' | 'warning' | 'error') => {
        if (Platform.OS === 'web') return;
        try {
            if (type === 'success') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else if (type === 'warning') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        } catch (e) {
            // Ignore haptics errors
        }
    };

    const handleConfirm = async () => {
        try {
            setLoading(true);
            safeHaptics('warning');

            let proofPhotoUrl: string | undefined;

            // Upload photo if one was selected
            if (photoUri) {
                setUploadProgress('Uploading photo...');
                try {
                    proofPhotoUrl = await uploadProofPhoto(photoUri, groupId);
                    setUploadProgress('');
                } catch (uploadError: any) {
                    console.error('Photo upload failed:', uploadError);
                    // Continue without photo if upload fails
                    StyledAlert.alert(
                        'Photo Upload Failed',
                        'The failure will be logged without the photo. ' + uploadError.message
                    );
                }
            }

            setUploadProgress('Logging failure...');
            const result = await logFailure(groupId, description || undefined, proofPhotoUrl);

            safeHaptics('success');
            setDescription('');
            setPhotoUri(null);
            setUploadProgress('');

            // Call onSuccess immediately to close modal and refresh data
            onSuccess();

            // Show confirmation after modal is closed
            setTimeout(() => {
                if (result) {
                    const photoText = proofPhotoUrl ? '\n📸 Photo proof attached' : '';
                    StyledAlert.alert(
                        'Failure Logged 😔',
                        `${result.transactions_created} debt${result.transactions_created !== 1 ? 's' : ''} created.\nTotal: €${result.total_debt.toFixed(2)}${photoText}`
                    );
                } else {
                    StyledAlert.alert('Failure Logged', 'Your failure has been recorded.');
                }
            }, 100);
        } catch (error: any) {
            safeHaptics('error');
            StyledAlert.alert('Error', error.message);
            setUploadProgress('');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setDescription('');
            setPhotoUri(null);
            setUploadProgress('');
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

                            {/* Photo Proof Picker */}
                            <PhotoProofPicker
                                photoUri={photoUri}
                                onPhotoSelected={setPhotoUri}
                                disabled={loading}
                            />

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
                                        <View style={styles.loadingContainer}>
                                            <ActivityIndicator color="#fff" size="small" />
                                            {uploadProgress ? (
                                                <Text style={styles.uploadProgressText}>{uploadProgress}</Text>
                                            ) : null}
                                        </View>
                                    ) : (
                                        <Text style={styles.confirmButtonText}>
                                            {photoUri ? '📸 Confirm with Photo' : 'Confirm Failure'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {memberCount === 0 && (
                                <Text style={styles.warningText}>
                                    ⚠️ No other members in the group. Invite friends first!
                                </Text>
                            )}
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
    scrollView: {
        flexGrow: 0,
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
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadProgressText: {
        color: '#ffffff',
        fontSize: 12,
        marginLeft: 8,
    },
    warningText: {
        color: colors.warning,
        textAlign: 'center',
        marginTop: 16,
        fontSize: 14,
    },
});
