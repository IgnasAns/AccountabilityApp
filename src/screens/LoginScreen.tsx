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
import { sanitizeEmail } from '../utils/sanitize';
import { safeHaptics } from '../utils/haptics';
import { rateLimiters } from '../utils/rateLimiter';
import AppIcon from '../components/AppIcon';

interface Props {
    navigation: NativeStackNavigationProp<any>;
}

export default function LoginScreen({ navigation }: Props) {
    const { signIn, signInAsGuest } = useAuth();
    const insets = useSafeAreaInsets();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

    const validateForm = (): boolean => {
        const newErrors: { email?: string; password?: string } = {};

        const sanitizedEmail = sanitizeEmail(email);
        if (!sanitizedEmail) {
            newErrors.email = 'Please enter a valid email address';
        }

        if (!password || password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleLogin = async () => {
        if (!validateForm()) {
            safeHaptics('warning');
            return;
        }

        // Rate limit check
        if (!rateLimiters.auth.canProceed()) {
            StyledAlert.alert('Slow Down', 'Too many login attempts. Please wait a moment.');
            return;
        }

        try {
            setLoading(true);
            safeHaptics('light');

            const sanitizedEmail = sanitizeEmail(email);
            await signIn(sanitizedEmail, password);
            safeHaptics('success');
        } catch (error: unknown) {
            safeHaptics('error');

            const message = error instanceof Error ? error.message : '';
            let errorMessage = 'Login failed. Please try again.';
            if (message.includes('Invalid login credentials')) {
                errorMessage = 'Invalid email or password. Please check your credentials.';
            } else if (message.includes('Email not confirmed')) {
                errorMessage = 'Please verify your email before logging in.';
            } else if (message.includes('Too many')) {
                errorMessage = 'Too many attempts. Please wait a few minutes.';
            }

            StyledAlert.alert('Login Failed', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleGuestMode = async () => {
        try {
            setLoading(true);
            safeHaptics('light');
            await signInAsGuest();
            safeHaptics('success');
        } catch (error: unknown) {
            safeHaptics('error');
            StyledAlert.alert('Error', (error instanceof Error ? error.message : "An error occurred"));
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
                    {/* Logo / Branding */}
                    <View style={styles.logoSection}>
                        <View style={styles.logoContainer}>
                            <AppIcon name="check-decagram-outline" size={44} color={colors.primary} />
                        </View>
                        <Text style={styles.appName}>Do It Mate!</Text>
                        <Text style={styles.tagline}>Accountability with actual stakes.</Text>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
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
                                    autoComplete="password"
                                    textContentType="password"
                                    style={[styles.passwordInput, errors.password ? styles.inputError : undefined]}
                                    editable={!loading}
                                    returnKeyType="go"
                                    onSubmitEditing={handleLogin}
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
                        </View>

                        <TouchableOpacity
                            onPress={() => navigation.navigate('ForgotPassword')}
                            style={styles.forgotPasswordButton}
                        >
                            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                        </TouchableOpacity>

                        {/* Login Button */}
                        <TouchableOpacity
                            onPress={handleLogin}
                            disabled={loading}
                            style={[styles.loginButton, loading && styles.disabledButton]}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.loginButtonText}>Sign In</Text>
                            )}
                        </TouchableOpacity>

                        {/* Divider */}
                        <View style={styles.dividerContainer}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>or</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Guest Mode Button */}
                        <TouchableOpacity
                            onPress={handleGuestMode}
                            disabled={loading}
                            style={[styles.guestButton, loading && styles.disabledButton]}
                            activeOpacity={0.8}
                        >
                            <AppIcon name="account-eye-outline" size={20} color={colors.text} />
                            <Text style={styles.guestButtonText}>Explore as Guest</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Sign Up Link */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Don't have an account? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                            <Text style={styles.signUpLink}>Sign Up</Text>
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
        justifyContent: 'center',
        paddingVertical: 28,
    },
    logoSection: {
        alignItems: 'center',
        marginBottom: 48,
    },
    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: 20,
        backgroundColor: colors.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
        elevation: 4,
    },
    appName: {
        fontSize: 32,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: -0.5,
    },
    tagline: {
        fontSize: 16,
        color: colors.textMuted,
        marginTop: 8,
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
    forgotPasswordButton: {
        alignSelf: 'flex-end',
        marginTop: -8,
        marginBottom: 20,
        paddingVertical: 4,
    },
    forgotPasswordText: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: '700',
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
    loginButton: {
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
    loginButtonText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 18,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border,
    },
    dividerText: {
        color: colors.textMuted,
        paddingHorizontal: 16,
        fontSize: 14,
    },
    guestButton: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: colors.surface,
        paddingVertical: 16,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    guestButtonText: {
        color: colors.text,
        fontWeight: '600',
        fontSize: 16,
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
    signUpLink: {
        color: colors.primary,
        fontWeight: '700',
        fontSize: 15,
    },
});
