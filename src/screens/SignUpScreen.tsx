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
import { sanitizeEmail, sanitizeName } from '../utils/sanitize';
import { safeHaptics } from '../utils/haptics';
import { rateLimiters } from '../utils/rateLimiter';
import AppIcon from '../components/AppIcon';

interface Props {
    navigation: NativeStackNavigationProp<any>;
}

export default function SignUpScreen({ navigation }: Props) {
    const { signUp } = useAuth();
    const insets = useSafeAreaInsets();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState<{
        name?: string;
        email?: string;
        password?: string;
        confirmPassword?: string;
    }>({});

    const validateForm = (): boolean => {
        const newErrors: typeof errors = {};

        const sanitizedName = sanitizeName(name);
        if (!sanitizedName || sanitizedName.length < 2) {
            newErrors.name = 'Name must be at least 2 characters';
        }

        const sanitizedEmail = sanitizeEmail(email);
        if (!sanitizedEmail) {
            newErrors.email = 'Please enter a valid email address';
        }

        if (!password || password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        if (password !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSignUp = async () => {
        if (!validateForm()) {
            safeHaptics('warning');
            return;
        }

        // Rate limit check
        if (!rateLimiters.auth.canProceed()) {
            StyledAlert.alert('Slow Down', 'Too many attempts. Please wait a moment.');
            return;
        }

        try {
            setLoading(true);
            safeHaptics('light');

            const sanitizedName = sanitizeName(name);
            const sanitizedEmail = sanitizeEmail(email);

            await signUp(sanitizedEmail, password, sanitizedName);
            safeHaptics('success');
            StyledAlert.alert(
                'Welcome! 🎉',
                'Your account has been created. Time to start your accountability journey!'
            );
        } catch (error: unknown) {
            safeHaptics('error');

            const message = error instanceof Error ? error.message : '';
            let errorMessage = 'Sign up failed. Please try again.';
            if (message.includes('already registered')) {
                errorMessage = 'This email is already registered. Try logging in instead.';
            } else if (message.includes('password')) {
                errorMessage = 'Password is too weak. Use at least 6 characters.';
            } else if (message.includes('valid email')) {
                errorMessage = 'Please enter a valid email address.';
            }

            StyledAlert.alert('Sign Up Failed', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const getPasswordStrength = (): { label: string; color: string; width: number } => {
        if (!password) return { label: '', color: colors.textMuted, width: 0 };

        let score = 0;
        if (password.length >= 6) score++;
        if (password.length >= 10) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;

        if (score <= 1) return { label: 'Weak', color: colors.error, width: 25 };
        if (score <= 2) return { label: 'Fair', color: colors.warning, width: 50 };
        if (score <= 3) return { label: 'Good', color: '#3B82F6', width: 75 };
        return { label: 'Strong', color: colors.success, width: 100 };
    };

    const passwordStrength = getPasswordStrength();

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
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backButton}
                            accessibilityLabel="Go back"
                        >
                            <AppIcon name="chevron-left" size={28} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.title}>Create Account</Text>
                        <Text style={styles.subtitle}>Join the accountability movement</Text>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        {/* Name Input */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Display Name</Text>
                            <TextInput
                                value={name}
                                onChangeText={(text) => {
                                    setName(text);
                                    if (errors.name) setErrors({ ...errors, name: undefined });
                                }}
                                placeholder="Your name"
                                placeholderTextColor={colors.textMuted}
                                autoComplete="name"
                                textContentType="name"
                                style={[styles.input, errors.name ? styles.inputError : undefined]}
                                editable={!loading}
                                returnKeyType="next"
                            />
                            {errors.name && (
                                <Text style={styles.errorText}>{errors.name}</Text>
                            )}
                        </View>

                        {/* Email Input */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                value={email}
                                onChangeText={(text) => {
                                    setEmail(text);
                                    if (errors.email) setErrors({ ...errors, email: undefined });
                                }}
                                placeholder="your@email.com"
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                autoComplete="email"
                                textContentType="emailAddress"
                                style={[styles.input, errors.email ? styles.inputError : undefined]}
                                editable={!loading}
                                returnKeyType="next"
                            />
                            {errors.email && (
                                <Text style={styles.errorText}>{errors.email}</Text>
                            )}
                        </View>

                        {/* Password Input */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Password</Text>
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    value={password}
                                    onChangeText={(text) => {
                                        setPassword(text);
                                        if (errors.password) setErrors({ ...errors, password: undefined });
                                    }}
                                    placeholder="Password"
                                    placeholderTextColor={colors.textMuted}
                                    secureTextEntry={!showPassword}
                                    autoComplete="new-password"
                                    textContentType="newPassword"
                                    style={[styles.passwordInput, errors.password ? styles.inputError : undefined]}
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
                            {errors.password && (
                                <Text style={styles.errorText}>{errors.password}</Text>
                            )}

                            {/* Password Strength Indicator */}
                            {password.length > 0 && (
                                <View style={styles.strengthContainer}>
                                    <View style={styles.strengthBarBg}>
                                        <View
                                            style={[
                                                styles.strengthBarFill,
                                                {
                                                    width: `${passwordStrength.width}%`,
                                                    backgroundColor: passwordStrength.color,
                                                },
                                            ]}
                                        />
                                    </View>
                                    <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                                        {passwordStrength.label}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Confirm Password Input */}
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
                                onSubmitEditing={handleSignUp}
                            />
                            {errors.confirmPassword && (
                                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                            )}
                            {confirmPassword.length > 0 && password === confirmPassword && (
                                <Text style={styles.matchText}>✓ Passwords match</Text>
                            )}
                        </View>

                        {/* Sign Up Button */}
                        <TouchableOpacity
                            onPress={handleSignUp}
                            disabled={loading}
                            style={[styles.signUpButton, loading && styles.disabledButton]}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.signUpButtonText}>Create Account</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Login Link */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Already have an account? </Text>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Text style={styles.loginLink}>Sign In</Text>
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
        paddingTop: 20,
        paddingBottom: 40,
    },
    header: {
        marginBottom: 32,
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 22,
        backgroundColor: colors.surface,
        marginBottom: 24,
        alignSelf: 'flex-start',
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: colors.textMuted,
    },
    form: {
        marginBottom: 32,
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
        borderRadius: 16,
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
    matchText: {
        color: colors.success,
        fontSize: 12,
        marginTop: 6,
    },
    passwordContainer: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 16,
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
    strengthContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
    },
    strengthBarBg: {
        flex: 1,
        height: 4,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 2,
        overflow: 'hidden',
    },
    strengthBarFill: {
        height: '100%',
        borderRadius: 2,
    },
    strengthLabel: {
        fontSize: 11,
        fontWeight: '600',
    },
    signUpButton: {
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 8,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    disabledButton: {
        opacity: 0.6,
    },
    signUpButtonText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 18,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    footerText: {
        color: colors.textMuted,
        fontSize: 15,
    },
    loginLink: {
        color: colors.primary,
        fontWeight: '700',
        fontSize: 15,
    },
});
