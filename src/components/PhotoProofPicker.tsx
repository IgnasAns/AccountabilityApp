import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    StyleSheet,
    ActivityIndicator,
    Platform,
    Modal,
    Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { colors } from '../theme/colors';
import { takePhoto, pickImage } from '../services/photoService';

interface PhotoProofPickerProps {
    photoUri: string | null;
    onPhotoSelected: (uri: string | null) => void;
    disabled?: boolean;
}

export default function PhotoProofPicker({
    photoUri,
    onPhotoSelected,
    disabled = false,
}: PhotoProofPickerProps) {
    const [loading, setLoading] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const safeHaptics = () => {
        if (Platform.OS !== 'web') {
            try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (e) {
                // Ignore
            }
        }
    };

    const handleTakePhoto = async () => {
        setShowOptions(false);
        setLoading(true);
        try {
            const uri = await takePhoto();
            if (uri) {
                safeHaptics();
                onPhotoSelected(uri);
            }
        } catch (error) {
            console.error('Take photo error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePickImage = async () => {
        setShowOptions(false);
        setLoading(true);
        try {
            const uri = await pickImage();
            if (uri) {
                safeHaptics();
                onPhotoSelected(uri);
            }
        } catch (error) {
            console.error('Pick image error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = () => {
        safeHaptics();
        onPhotoSelected(null);
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Processing...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.label}>
                📷 Proof Photo (Optional)
            </Text>
            <Text style={styles.sublabel}>
                Add a photo as proof of your failure confession
            </Text>

            {photoUri ? (
                // Photo selected - show preview
                <View style={styles.previewContainer}>
                    <TouchableOpacity
                        onPress={() => setShowPreview(true)}
                        activeOpacity={0.8}
                    >
                        <Image
                            source={{ uri: photoUri }}
                            style={styles.previewImage}
                            resizeMode="cover"
                        />
                        <View style={styles.previewOverlay}>
                            <Text style={styles.tapToViewText}>Tap to view</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.removeButton}
                        onPress={handleRemove}
                    >
                        <Text style={styles.removeButtonText}>✕</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                // No photo - show add button
                <TouchableOpacity
                    style={[styles.addPhotoButton, disabled && styles.disabledButton]}
                    onPress={() => setShowOptions(true)}
                    disabled={disabled}
                    activeOpacity={0.7}
                >
                    <Text style={styles.cameraIcon}>📸</Text>
                    <Text style={styles.addPhotoText}>Add Proof Photo</Text>
                    <Text style={styles.addPhotoHint}>Take a photo or choose from gallery</Text>
                </TouchableOpacity>
            )}

            {/* Options Modal */}
            <Modal
                visible={showOptions}
                transparent
                animationType="fade"
                onRequestClose={() => setShowOptions(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowOptions(false)}
                >
                    {Platform.OS === 'ios' ? (
                        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                    ) : (
                        <View style={[StyleSheet.absoluteFill, styles.androidOverlay]} />
                    )}
                    <View style={styles.optionsCard}>
                        <Text style={styles.optionsTitle}>Add Proof Photo</Text>

                        <TouchableOpacity
                            style={styles.optionButton}
                            onPress={handleTakePhoto}
                        >
                            <Text style={styles.optionIcon}>📷</Text>
                            <View style={styles.optionTextContainer}>
                                <Text style={styles.optionTitle}>Take Photo</Text>
                                <Text style={styles.optionSubtitle}>Use your camera</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.optionButton}
                            onPress={handlePickImage}
                        >
                            <Text style={styles.optionIcon}>🖼️</Text>
                            <View style={styles.optionTextContainer}>
                                <Text style={styles.optionTitle}>Choose from Gallery</Text>
                                <Text style={styles.optionSubtitle}>Select an existing photo</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => setShowOptions(false)}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>

            {/* Full Preview Modal */}
            <Modal
                visible={showPreview}
                transparent
                animationType="fade"
                onRequestClose={() => setShowPreview(false)}
            >
                <Pressable
                    style={styles.previewModalOverlay}
                    onPress={() => setShowPreview(false)}
                >
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.95)' }]} />
                    {photoUri && (
                        <Image
                            source={{ uri: photoUri }}
                            style={styles.fullPreviewImage}
                            resizeMode="contain"
                        />
                    )}
                    <TouchableOpacity
                        style={styles.closePreviewButton}
                        onPress={() => setShowPreview(false)}
                    >
                        <Text style={styles.closePreviewText}>✕</Text>
                    </TouchableOpacity>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 16,
    },
    label: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    sublabel: {
        color: colors.textMuted,
        fontSize: 13,
        marginBottom: 16,
    },
    loadingBox: {
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 16,
        padding: 40,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.border,
        borderStyle: 'dashed',
    },
    loadingText: {
        color: colors.textMuted,
        marginTop: 12,
    },
    addPhotoButton: {
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.border,
        borderStyle: 'dashed',
    },
    disabledButton: {
        opacity: 0.5,
    },
    cameraIcon: {
        fontSize: 40,
        marginBottom: 12,
    },
    addPhotoText: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    addPhotoHint: {
        color: colors.textMuted,
        fontSize: 13,
    },
    previewContainer: {
        position: 'relative',
        borderRadius: 16,
        overflow: 'hidden',
    },
    previewImage: {
        width: '100%',
        height: 200,
        borderRadius: 16,
    },
    previewOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 12,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    tapToViewText: {
        color: '#fff',
        textAlign: 'center',
        fontSize: 13,
    },
    removeButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.error,
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        padding: 16,
    },
    androidOverlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    optionsCard: {
        backgroundColor: colors.surface,
        borderRadius: 24,
        padding: 24,
        marginBottom: Platform.OS === 'ios' ? 34 : 16,
    },
    optionsTitle: {
        color: colors.text,
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    optionIcon: {
        fontSize: 28,
        marginRight: 16,
    },
    optionTextContainer: {
        flex: 1,
    },
    optionTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '600',
    },
    optionSubtitle: {
        color: colors.textMuted,
        fontSize: 13,
        marginTop: 2,
    },
    cancelButton: {
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 14,
        padding: 16,
        marginTop: 8,
    },
    cancelButtonText: {
        color: colors.textMuted,
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    previewModalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullPreviewImage: {
        width: '100%',
        height: '80%',
    },
    closePreviewButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closePreviewText: {
        color: '#fff',
        fontSize: 24,
    },
});
