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

export default function ForgotPasswordScreen({ navigation }: Props) {
    const { requestPasswordReset } = useAuth();
    const insets = useSafeAreaInsets();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | undefined>();

    const handleSendReset = async () => {
        const sanitizedEmail = sanitizeEmail(email);

        if (!sanitizedEmail) {
            setError('Please enter a valid email address');
            safeHaptics('warning');
            return;
        }

        if (!rateLimiters.auth.canProceed()) {
            StyledAlert.alert('Slow Down', 'Too many password reset attempts. Please wait a moment.');
            return;
        }

        try {
            setLoading(true);
            safeHaptics('light');
            await requestPasswordReset(sanitizedEmail);
            setSent(true);
            safeHaptics('success');
            StyledAlert.alert('Check Your Email', 'Open the password reset link on this device to set a new password.');
        } catch (resetError: unknown) {
            safeHaptics('error');
            const message = resetError instanceof Error ? resetError.message : 'Unable to send reset email.';
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
                            <AppIcon name="lock-reset" size={38} color={colors.primary} />
                        </View>
                        <Text style={styles.title}>Recover Password</Text>
                        <Text style={styles.subtitle}>
                            Enter your account email and we will send a secure reset link.
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                value={email}
                                onChangeText={(text) => {
                                    setEmail(text);
                                    if (error) setError(undefined);
                                }}
                                placeholder="your@email.com"
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                autoComplete="email"
                                textContentType="emailAddress"
                                style={[styles.input, error ? styles.inputError : undefined]}
                                editable={!loading}
                                returnKeyType="send"
                                onSubmitEditing={handleSendReset}
                            />
                            {error && <Text style={styles.errorText}>{error}</Text>}
                        </View>

                        <TouchableOpacity
                            onPress={handleSendReset}
                            disabled={loading}
                            style={[styles.primaryButton, loading && styles.disabledButton]}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.primaryButtonText}>
                                    {sent ? 'Send Link Again' : 'Send Reset Link'}
                                </Text>
                            )}
                        </TouchableOpacity>

                        {sent && (
                            <View style={styles.sentBox}>
                                <AppIcon name="email-outline" size={22} color={colors.success} />
                                <Text style={styles.sentText}>
                                    If that email is registered, a reset link is on the way.
                                </Text>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.footerLink}>
                        <Text style={styles.footerLinkText}>Back to Sign In</Text>
                    </TouchableOpacity>
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
    sentBox: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
        backgroundColor: colors.success + '12',
        borderWidth: 1,
        borderColor: colors.success + '35',
        borderRadius: 10,
        padding: 14,
        marginTop: 16,
    },
    sentText: {
        flex: 1,
        color: colors.text,
        fontSize: 14,
        lineHeight: 20,
    },
    footerLink: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    footerLinkText: {
        color: colors.primary,
        fontSize: 15,
        fontWeight: '700',
    },
});
