import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { StyledAlert } from '../components/StyledAlert';
import { colors } from '../theme/colors';
import { safeHaptics } from '../utils/haptics';
import { rateLimiters } from '../utils/rateLimiter';
import AppIcon from '../components/AppIcon';

interface Props {
    navigation: NativeStackNavigationProp<any>;
}

export default function ChangePasswordScreen({ navigation }: Props) {
    const { changePassword } = useAuth();
    const insets = useSafeAreaInsets();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{
        currentPassword?: string;
        newPassword?: string;
        confirmPassword?: string;
    }>({});

    const validateForm = (): boolean => {
        const nextErrors: typeof errors = {};

        if (!currentPassword || currentPassword.length < 6) {
            nextErrors.currentPassword = 'Enter your current password';
        }

        if (!newPassword || newPassword.length < 6) {
            nextErrors.newPassword = 'New password must be at least 6 characters';
        }

        if (newPassword && currentPassword === newPassword) {
            nextErrors.newPassword = 'New password must be different from your current password';
        }

        if (newPassword !== confirmPassword) {
            nextErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleChangePassword = async () => {
        if (!validateForm()) {
            safeHaptics('warning');
            return;
        }

        if (!rateLimiters.auth.canProceed()) {
            StyledAlert.alert('Slow Down', 'Too many password attempts. Please wait a moment.');
            return;
        }

        try {
            setLoading(true);
            safeHaptics('light');
            await changePassword(currentPassword, newPassword);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            safeHaptics('success');
            StyledAlert.alert('Password Updated', 'Your password has been changed successfully.', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (error: unknown) {
            safeHaptics('error');
            const message = error instanceof Error ? error.message : 'Unable to change your password.';
            StyledAlert.alert('Change Failed', message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.header}>
                        <View style={styles.iconCircle}>
                            <AppIcon name="lock-outline" size={36} color={colors.primary} />
                        </View>
                        <Text style={styles.title}>Change Password</Text>
                        <Text style={styles.subtitle}>
                            Confirm your current password, then choose a new one.
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Current Password</Text>
                            <View style={[styles.passwordContainer, errors.currentPassword ? styles.inputError : undefined]}>
                                <TextInput
                                    value={currentPassword}
                                    onChangeText={(text) => {
                                        setCurrentPassword(text);
                                        if (errors.currentPassword) {
                                            setErrors({ ...errors, currentPassword: undefined });
                                        }
                                    }}
                                    placeholder="Current password"
                                    placeholderTextColor={colors.textMuted}
                                    secureTextEntry={!showPassword}
                                    autoComplete="current-password"
                                    textContentType="password"
                                    style={styles.passwordInput}
                                    editable={!loading}
                                    returnKeyType="next"
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.eyeButton}
                                    accessibilityLabel={showPassword ? 'Hide passwords' : 'Show passwords'}
                                >
                                    <AppIcon
                                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={22}
                                        color={colors.textMuted}
                                    />
                                </TouchableOpacity>
                            </View>
                            {errors.currentPassword && (
                                <Text style={styles.errorText}>{errors.currentPassword}</Text>
                            )}
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>New Password</Text>
                            <TextInput
                                value={newPassword}
                                onChangeText={(text) => {
                                    setNewPassword(text);
                                    if (errors.newPassword) setErrors({ ...errors, newPassword: undefined });
                                }}
                                placeholder="New password"
                                placeholderTextColor={colors.textMuted}
                                secureTextEntry={!showPassword}
                                autoComplete="new-password"
                                textContentType="newPassword"
                                style={[styles.input, errors.newPassword ? styles.inputError : undefined]}
                                editable={!loading}
                                returnKeyType="next"
                            />
                            {errors.newPassword && <Text style={styles.errorText}>{errors.newPassword}</Text>}
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Confirm Password</Text>
                            <TextInput
                                value={confirmPassword}
                                onChangeText={(text) => {
                                    setConfirmPassword(text);
                                    if (errors.confirmPassword) {
                                        setErrors({ ...errors, confirmPassword: undefined });
                                    }
                                }}
                                placeholder="Confirm password"
                                placeholderTextColor={colors.textMuted}
                                secureTextEntry={!showPassword}
                                autoComplete="new-password"
                                textContentType="newPassword"
                                style={[styles.input, errors.confirmPassword ? styles.inputError : undefined]}
                                editable={!loading}
                                returnKeyType="go"
                                onSubmitEditing={handleChangePassword}
                            />
                            {errors.confirmPassword && (
                                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                            )}
                        </View>

                        <TouchableOpacity
                            onPress={handleChangePassword}
                            disabled={loading}
                            style={[styles.primaryButton, loading && styles.disabledButton]}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.primaryButtonText}>Change Password</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 24,
        paddingTop: 30,
        paddingBottom: 40,
    },
    header: {
        marginBottom: 32,
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 18,
        backgroundColor: colors.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 10,
    },
    subtitle: {
        color: colors.textMuted,
        fontSize: 16,
        lineHeight: 23,
    },
    form: {
        marginBottom: 28,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        color: colors.textMuted,
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
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
    passwordContainer: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    passwordInput: {
        flex: 1,
        color: colors.text,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
    },
    eyeButton: {
        paddingHorizontal: 16,
        justifyContent: 'center',
    },
    primaryButton: {
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 10,
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
        elevation: 3,
    },
    disabledButton: {
        opacity: 0.6,
    },
    primaryButtonText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 17,
    },
});
