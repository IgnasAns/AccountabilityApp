import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    StyleSheet,
    Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import PhotoProofPicker from './PhotoProofPicker';
import { uploadProofPhoto } from '../services/photoService';
import { StyledAlert } from './StyledAlert';
import { GoalWithCompletions } from '../types/database';
import { colors } from '../theme/colors';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSubmit: (goalId: string, proofPhotoUrl: string, notes?: string) => Promise<void>;
    goal: GoalWithCompletions | null;
    groupId: string;
}

export default function CompleteGoalModal({
    visible,
    onClose,
    onSubmit,
    goal,
    groupId,
}: Props) {
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');

    const safeHaptics = () => {
        if (Platform.OS !== 'web') {
            try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e) { }
        }
    };

    const handleSubmit = async () => {
        if (!goal || !photoUri) {
            StyledAlert.alert('Photo Required', 'You must take a photo as proof of completion.');
            return;
        }

        try {
            setLoading(true);
            setUploadProgress('Uploading photo...');

            // Upload photo first
            const proofPhotoUrl = await uploadProofPhoto(photoUri, groupId);

            setUploadProgress('Saving completion...');

            // Submit completion with photo URL
            await onSubmit(goal.id, proofPhotoUrl, notes.trim() || undefined);

            safeHaptics();

            // Reset form
            setPhotoUri(null);
            setNotes('');
            setUploadProgress('');

            onClose();
        } catch (error: any) {
            console.error('Complete goal error:', error);
            StyledAlert.alert('Error', error.message || 'Failed to complete goal');
        } finally {
            setLoading(false);
            setUploadProgress('');
        }
    };

    const handleClose = () => {
        if (!loading) {
            setPhotoUri(null);
            setNotes('');
            setUploadProgress('');
            onClose();
        }
    };

    if (!goal) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={handleClose}
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
                            <Text style={styles.emoji}>{goal.emoji}</Text>
                            <Text style={styles.title}>Complete Goal</Text>
                            <Text style={styles.goalName}>{goal.name}</Text>
                        </View>

                        {/* Photo Requirement Notice */}
                        <View style={styles.requirementBadge}>
                            <Text style={styles.requirementIcon}>📸</Text>
                            <Text style={styles.requirementText}>
                                Photo proof is required to mark this goal complete
                            </Text>
                        </View>

                        {/* Photo Picker */}
                        <PhotoProofPicker
                            photoUri={photoUri}
                            onPhotoSelected={setPhotoUri}
                            disabled={loading}
                        />

                        {/* Notes */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Notes (optional)</Text>
                            <TextInput
                                value={notes}
                                onChangeText={setNotes}
                                placeholder="How did it go?"
                                placeholderTextColor={colors.textMuted}
                                multiline
                                numberOfLines={2}
                                style={styles.input}
                                editable={!loading}
                            />
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
                                disabled={loading || !photoUri}
                                style={[
                                    styles.submitButton,
                                    (!photoUri || loading) && styles.disabledButton,
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
                                    <Text style={styles.submitButtonText}>
                                        {photoUri ? '✓ Complete with Photo' : '📸 Add Photo First'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {!photoUri && (
                            <Text style={styles.hintText}>
                                Take or select a photo to enable completion
                            </Text>
                        )}
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
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
    contentContainer: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    emoji: {
        fontSize: 48,
        marginBottom: 12,
    },
    title: {
        color: colors.text,
        fontSize: 24,
        fontWeight: 'bold',
    },
    goalName: {
        color: colors.textMuted,
        fontSize: 16,
        marginTop: 4,
    },
    requirementBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: `${colors.primary}15`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: `${colors.primary}30`,
    },
    requirementIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    requirementText: {
        flex: 1,
        color: colors.primary,
        fontWeight: '500',
    },
    inputContainer: {
        marginTop: 8,
        marginBottom: 20,
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
        minHeight: 60,
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
        flex: 2,
        backgroundColor: colors.success,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    disabledButton: {
        opacity: 0.5,
        backgroundColor: colors.border,
    },
    submitButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    uploadProgressText: {
        color: '#fff',
        fontSize: 12,
        marginLeft: 8,
    },
    hintText: {
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: 12,
        fontSize: 13,
    },
});
