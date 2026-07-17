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

export default function ResetPasswordScreen({ navigation }: Props) {
    const { resetPassword, clearPasswordRecovery } = useAuth();
    const insets = useSafeAreaInsets();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});

    const validateForm = (): boolean => {
        const nextErrors: typeof errors = {};

        if (!password || password.length < 6) {
            nextErrors.password = 'Password must be at least 6 characters';
        }

        if (password !== confirmPassword) {
            nextErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleResetPassword = async () => {
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
            await resetPassword(password);
            setPassword('');
            setConfirmPassword('');
            clearPasswordRecovery();
            safeHaptics('success');
            StyledAlert.alert('Password Updated', 'Your password has been updated successfully.');
        } catch (error: unknown) {
            safeHaptics('error');
            const message = error instanceof Error ? error.message : 'Unable to update your password.';
            StyledAlert.alert('Reset Failed', message);
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
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backButton}
                            accessibilityLabel="Go back"
                        >
                            <AppIcon name="chevron-left" size={28} color={colors.text} />
                        </TouchableOpacity>
                        <View style={styles.iconCircle}>
                            <AppIcon name="lock-check-outline" size={36} color={colors.primary} />
                        </View>
                        <Text style={styles.title}>Set New Password</Text>
                        <Text style={styles.subtitle}>
                            Choose a new password for your Do It Mate! account.
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>New Password</Text>
                            <View style={[styles.passwordContainer, errors.password ? styles.inputError : undefined]}>
                                <TextInput
                                    value={password}
                                    onChangeText={(text) => {
                                        setPassword(text);
                                        if (errors.password) setErrors({ ...errors, password: undefined });
                                    }}
                                    placeholder="New password"
                                    placeholderTextColor={colors.textMuted}
                                    secureTextEntry={!showPassword}
                                    autoComplete="new-password"
                                    textContentType="newPassword"
                                    style={styles.passwordInput}
                                    editable={!loading}
                                    returnKeyType="next"
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.eyeButton}
                                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    <AppIcon
                                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={22}
                                        color={colors.textMuted}
                                    />
                                </TouchableOpacity>
                            </View>
                            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Confirm Password</Text>
                            <TextInput
                                value={confirmPassword}
                                onChangeText={(text) => {
                                    setConfirmPassword(text);
                                    if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined });
                                }}
                                placeholder="Confirm password"
                                placeholderTextColor={colors.textMuted}
                                secureTextEntry={!showPassword}
                                autoComplete="new-password"
                                textContentType="newPassword"
                                style={[styles.input, errors.confirmPassword ? styles.inputError : undefined]}
                                editable={!loading}
                                returnKeyType="go"
                                onSubmitEditing={handleResetPassword}
                            />
                            {errors.confirmPassword && (
                                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                            )}
                        </View>

                        <TouchableOpacity
                            onPress={handleResetPassword}
                            disabled={loading}
                            style={[styles.primaryButton, loading && styles.disabledButton]}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.primaryButtonText}>Update Password</Text>
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
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 40,
        justifyContent: 'center',
    },
    header: {
        marginBottom: 32,
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 14,
        backgroundColor: colors.surface,
        marginBottom: 28,
        alignSelf: 'flex-start',
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
