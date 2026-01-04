import React, { useState, useEffect, useRef } from 'react';
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
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';

interface InviteCodeModalProps {
    visible: boolean;
    inviteCode: string;
    groupName: string;
    onClose: () => void;
}

export default function InviteCodeModal({
    visible,
    inviteCode,
    groupName,
    onClose,
}: InviteCodeModalProps) {
    const [copied, setCopied] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const checkmarkScale = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setCopied(false);
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

    const handleCopy = async () => {
        try {
            await Clipboard.setStringAsync(inviteCode);

            // Haptic feedback
            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            setCopied(true);

            // Animate checkmark
            Animated.spring(checkmarkScale, {
                toValue: 1,
                damping: 10,
                stiffness: 200,
                useNativeDriver: true,
            }).start();

            // Reset after delay
            setTimeout(() => {
                checkmarkScale.setValue(0);
            }, 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                {Platform.OS === 'ios' ? (
                    <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                ) : (
                    <View style={[StyleSheet.absoluteFill, styles.androidOverlay]} />
                )}
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

                <Animated.View
                    style={[
                        styles.modalContainer,
                        {
                            opacity: fadeAnim,
                            transform: [{ scale: scaleAnim }],
                        },
                    ]}
                >
                    <View style={styles.modal}>
                        {/* Success Icon with Glow */}
                        <View style={styles.iconGlow} />
                        <View style={styles.iconContainer}>
                            <Text style={styles.iconText}>🎉</Text>
                        </View>

                        {/* Title */}
                        <Text style={styles.title}>Group Created!</Text>
                        <Text style={styles.subtitle}>"{groupName}"</Text>

                        {/* Invite Code Box - Tap to Copy */}
                        <TouchableOpacity
                            style={[styles.codeBox, copied && styles.codeBoxCopied]}
                            onPress={handleCopy}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.codeLabel}>
                                {copied ? '✓ Copied!' : 'Tap to copy invite code'}
                            </Text>
                            <View style={styles.codeRow}>
                                <Text style={styles.codeText}>{inviteCode}</Text>
                                <Animated.View style={{ transform: [{ scale: checkmarkScale }] }}>
                                    {copied && <Text style={styles.checkmark}>✓</Text>}
                                </Animated.View>
                            </View>
                            <View style={styles.copyHint}>
                                <Text style={styles.copyIcon}>📋</Text>
                                <Text style={styles.copyHintText}>
                                    {copied ? 'Code copied to clipboard' : 'Share this code with friends'}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* Instructions */}
                        <View style={styles.instructions}>
                            <Text style={styles.instructionTitle}>Next Steps:</Text>
                            <Text style={styles.instructionText}>
                                1️⃣ Share the code with friends{'\n'}
                                2️⃣ They enter it in "Join Group"{'\n'}
                                3️⃣ Start holding each other accountable!
                            </Text>
                        </View>

                        {/* Done Button */}
                        <TouchableOpacity
                            style={styles.doneButton}
                            onPress={onClose}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.doneButtonText}>Done</Text>
                        </TouchableOpacity>
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
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
    },
    modalContainer: {
        width: '100%',
        maxWidth: 360,
    },
    modal: {
        backgroundColor: colors.surface,
        borderRadius: 28,
        padding: 28,
        alignItems: 'center',
        shadowColor: colors.success,
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
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.success,
        opacity: 0.15,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: `${colors.success}20`,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    iconText: {
        fontSize: 42,
    },
    title: {
        color: colors.text,
        fontSize: 26,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 4,
    },
    subtitle: {
        color: colors.textMuted,
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
    },
    codeBox: {
        width: '100%',
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 16,
        padding: 20,
        borderWidth: 2,
        borderColor: colors.primary,
        borderStyle: 'dashed',
        marginBottom: 20,
    },
    codeBoxCopied: {
        borderColor: colors.success,
        borderStyle: 'solid',
        backgroundColor: `${colors.success}10`,
    },
    codeLabel: {
        color: colors.textMuted,
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    codeRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    codeText: {
        color: colors.primary,
        fontSize: 32,
        fontWeight: 'bold',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        letterSpacing: 4,
        textAlign: 'center',
    },
    checkmark: {
        color: colors.success,
        fontSize: 24,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    copyHint: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    copyIcon: {
        fontSize: 16,
        marginRight: 6,
    },
    copyHintText: {
        color: colors.textMuted,
        fontSize: 13,
    },
    instructions: {
        width: '100%',
        backgroundColor: `${colors.primary}10`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    instructionTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    instructionText: {
        color: colors.textMuted,
        fontSize: 13,
        lineHeight: 22,
    },
    doneButton: {
        width: '100%',
        backgroundColor: colors.success,
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        shadowColor: colors.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    doneButtonText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 18,
    },
});
