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
    Dimensions,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuth } from '../hooks/useAuth';
import { StyledAlert } from '../components/StyledAlert';
import { colors } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

interface Props {
    navigation: NativeStackNavigationProp<any>;
}

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }: Props) {
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const insets = useSafeAreaInsets();

    const [error, setError] = useState('');

    const handleLogin = async () => {
        if (!email || !password) {
            setError('Please fill in all fields');
            return;
        }
        setError('');

        try {
            setLoading(true);
            await signIn(email, password);
        } catch (error: any) {
            console.error('Login error full object:', error);

            if (error.message && error.message.includes('Email not confirmed')) {
                setError('📧 Email not confirmed.\n\nPlease check your inbox/spam for the confirmation link.\n\nOR: Ask the developer to run the "critical_fix.sql" script to auto-confirm your account.');
            } else if (error.message && error.message.includes('Invalid login credentials')) {
                setError('Invalid email or password.');
            } else {
                setError(error.message || 'An unexpected error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={[styles.keyboardView, { paddingTop: insets.top }]}
            >
                <View style={styles.content}>
                    {/* Header Section */}
                    <Animated.View
                        entering={FadeInDown.delay(200).duration(1000).springify()}
                        style={styles.header}
                    >
                        <View style={styles.iconContainer}>
                            <Text style={styles.logoEmoji}>🤜🤛</Text>
                        </View>
                        <Text style={styles.title}>
                            Do It Mate!
                        </Text>
                        <Text style={styles.subtitle}>
                            Social Accountability Ledger
                        </Text>
                    </Animated.View>

                    {/* Form Section */}
                    <Animated.View
                        entering={FadeInDown.delay(400).duration(1000).springify()}
                        style={styles.formContainer}
                    >
                        {/* Error Message */}
                        {error ? (
                            <Animated.View entering={FadeInUp} style={styles.errorContainer}>
                                <Text style={styles.errorText}>{error}</Text>
                            </Animated.View>
                        ) : null}

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                value={email}
                                onChangeText={(text) => { setEmail(text); setError(''); }}
                                placeholder="your@email.com"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoComplete="email"
                                style={styles.input}
                                editable={!loading}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Password</Text>
                            <TextInput
                                value={password}
                                onChangeText={(text) => { setPassword(text); setError(''); }}
                                placeholder="••••••••"
                                placeholderTextColor={colors.textMuted}
                                secureTextEntry
                                style={styles.input}
                                editable={!loading}
                            />
                        </View>

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

                        <View style={styles.footer}>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('SignUp')}
                                disabled={loading}
                            >
                                <Text style={styles.signUpText}>
                                    New here? <Text style={styles.signUpTextHighlight}>Create account</Text>
                                </Text>
                            </TouchableOpacity>

                        </View>
                    </Animated.View>
                </View>
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
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    iconContainer: {
        padding: 24,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    logoEmoji: {
        fontSize: 48,
        textAlign: 'center',
    },
    title: {
        color: colors.text,
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: -0.5,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        color: colors.textMuted,
        fontSize: 16,
        fontWeight: '500',
        letterSpacing: 0.5,
        opacity: 0.8,
        textAlign: 'center',
    },
    formContainer: {
        gap: 20,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        color: colors.textMuted,
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginLeft: 4,
    },
    input: {
        backgroundColor: colors.surface,
        color: colors.text,
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        fontSize: 16,
    },
    loginButton: {
        backgroundColor: colors.primary,
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 12,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    disabledButton: {
        opacity: 0.7,
    },
    loginButtonText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 18,
        letterSpacing: 0.5,
    },
    errorContainer: {
        padding: 16,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        marginBottom: 8,
    },
    errorText: {
        color: colors.error,
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '500',
    },
    footer: {
        marginTop: 24,
        alignItems: 'center',
        gap: 24,
    },
    signUpText: {
        color: colors.textMuted,
        fontSize: 15,
    },
    signUpTextHighlight: {
        color: colors.primary,
        fontWeight: '700',
    },
});
