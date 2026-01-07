import React, { useEffect, useRef } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Pressable,
    Animated,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { colors } from '../theme/colors';

interface ConfirmModalProps {
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmStyle?: 'danger' | 'primary';
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
}

export default function ConfirmModal({
    visible,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmStyle = 'primary',
    onConfirm,
    onCancel,
    loading = false,
}: ConfirmModalProps) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    damping: 20,
                    stiffness: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 0.9,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible, fadeAnim, scaleAnim]);

    const getIconBackground = () => {
        return confirmStyle === 'danger' ? colors.error : colors.primary;
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={loading ? undefined : onCancel}
            statusBarTranslucent
        >
            <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                {Platform.OS === 'ios' ? (
                    <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                ) : (
                    <View style={[StyleSheet.absoluteFill, styles.androidOverlay]} />
                )}
                <Pressable style={StyleSheet.absoluteFill} onPress={loading ? undefined : onCancel} />

                <Animated.View
                    style={[
                        styles.modalContainer,
                        {
                            opacity: fadeAnim,
                            transform: [{ scale: scaleAnim }],
                        }
                    ]}
                >
                    <View style={styles.modal}>
                        {/* Header Icon Wrapper - Popped out */}
                        <View style={styles.iconWrapper}>
                            <View style={[styles.iconGlow, { backgroundColor: getIconBackground() }]} />
                            <View style={[
                                styles.iconContainer,
                                confirmStyle === 'danger' ? styles.iconDanger : styles.iconPrimary
                            ]}>
                                <Text style={styles.iconText}>
                                    {confirmStyle === 'danger' ? '🚪' : '❓'}
                                </Text>
                            </View>
                        </View>

                        {/* Content */}
                        <View style={styles.contentContainer}>
                            <Text style={styles.title}>{title}</Text>
                            <Text style={styles.message}>{message}</Text>

                            {/* Buttons */}
                            <View style={styles.buttonContainer}>
                                <TouchableOpacity
                                    style={[
                                        styles.button,
                                        confirmStyle === 'danger' ? styles.dangerButton : styles.primaryButton,
                                        loading && { opacity: 0.7 }
                                    ]}
                                    onPress={loading ? undefined : onConfirm}
                                    activeOpacity={0.7}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.confirmButtonText}>{confirmText}</Text>
                                    )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.button, styles.cancelButton]}
                                    onPress={onCancel}
                                    activeOpacity={0.7}
                                    disabled={loading}
                                >
                                    <Text style={styles.cancelButtonText}>{cancelText}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    androidOverlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
    },
    modalContainer: {
        width: '100%',
        maxWidth: 340,
    },
    modal: {
        backgroundColor: colors.surface,
        borderRadius: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.4,
        shadowRadius: 40,
        elevation: 20,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'visible', // Critical for pop-out
    },
    iconWrapper: {
        marginTop: -36, // Pull up by half the icon height
        alignItems: 'center',
        justifyContent: 'center',
        width: 100,
        height: 100,
        marginBottom: 8,
    },
    iconGlow: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        opacity: 0.15,
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        // Shadow for the icon itself to make it pop
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    contentContainer: {
        paddingHorizontal: 32,
        paddingBottom: 32,
        alignItems: 'center',
        width: '100%',
    },
    iconPrimary: {
        backgroundColor: colors.primary,
    },
    iconDanger: {
        backgroundColor: colors.error,
    },
    iconText: {
        fontSize: 32,
    },
    title: {
        color: colors.text,
        fontSize: 24,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    message: {
        color: colors.textMuted,
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    buttonContainer: {
        flexDirection: 'column',
        gap: 16,
        width: '100%',
    },
    button: {
        width: '100%',
        height: 72, // Increased from 64
        borderRadius: 24, // Increased to match height
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: colors.surfaceHighlight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cancelButtonText: {
        color: colors.text,
        fontWeight: '800',
        fontSize: 18, // Increased from 16
    },
    primaryButton: {
        backgroundColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    dangerButton: {
        backgroundColor: colors.error,
        shadowColor: colors.error,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    confirmButtonText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 18, // Increased from 16
    },
});

