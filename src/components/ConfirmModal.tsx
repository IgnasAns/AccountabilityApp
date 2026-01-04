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
            onRequestClose={onCancel}
            statusBarTranslucent
        >
            <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                {Platform.OS === 'ios' ? (
                    <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                ) : (
                    <View style={[StyleSheet.absoluteFill, styles.androidOverlay]} />
                )}
                <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />

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
                        {/* Glow effect behind icon */}
                        <View style={[styles.iconGlow, { backgroundColor: getIconBackground() }]} />

                        {/* Icon */}
                        <View style={[
                            styles.iconContainer,
                            confirmStyle === 'danger' ? styles.iconDanger : styles.iconPrimary
                        ]}>
                            <Text style={styles.iconText}>
                                {confirmStyle === 'danger' ? '🚪' : '❓'}
                            </Text>
                        </View>

                        {/* Content */}
                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.message}>{message}</Text>

                        {/* Buttons */}
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={[styles.button, styles.cancelButton]}
                                onPress={onCancel}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.cancelButtonText}>{cancelText}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.button,
                                    confirmStyle === 'danger' ? styles.dangerButton : styles.primaryButton
                                ]}
                                onPress={onConfirm}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.confirmButtonText}>{confirmText}</Text>
                            </TouchableOpacity>
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
        padding: 28,
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
        elevation: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    iconGlow: {
        position: 'absolute',
        top: -20,
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
        marginBottom: 20,
    },
    iconPrimary: {
        backgroundColor: `${colors.primary}20`,
    },
    iconDanger: {
        backgroundColor: `${colors.error}20`,
    },
    iconText: {
        fontSize: 36,
    },
    title: {
        color: colors.text,
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 12,
    },
    message: {
        color: colors.textMuted,
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: colors.surfaceHighlight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cancelButtonText: {
        color: colors.textMuted,
        fontWeight: '600',
        fontSize: 16,
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
        fontWeight: '600',
        fontSize: 16,
    },
});

