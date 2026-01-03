import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
    StyleSheet,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../theme/colors';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
    navigation: NativeStackNavigationProp<any>;
}

export default function LoginScreen({ navigation }: Props) {
    const { signIn, signInAsGuest } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const insets = useSafeAreaInsets();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        try {
            setLoading(true);
            await signIn(email, password);
        } catch (error: any) {
            console.error('Login error full object:', error);
            // Handle specific Supabase error for Invalid API Key
            if (error.message && error.message.includes('Invalid API key')) {
                Alert.alert(
                    'Configuration Error',
                    'The Supabase credentials configured in the app are invalid. Please check your .env file or project settings.'
                );
            } else {
                Alert.alert('Login Error', error.message || 'An unexpected error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.container, { paddingTop: insets.top }]}
        >
            <View style={styles.content}>
                {/* Logo/Header */}
                <View style={styles.header}>
                    <Text style={styles.logoEmoji}>⚖️</Text>
                    <Text style={styles.title}>
                        Social Ledger
                    </Text>
                    <Text style={styles.subtitle}>
                        Track accountability bets with friends
                    </Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
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
                            onChangeText={setPassword}
                            placeholder="••••••••"
                            placeholderTextColor={colors.textMuted}
                            secureTextEntry
                            style={styles.input}
                            editable={!loading}
                        />
                    </View>
                </View>

                {/* Login Button */}
                <TouchableOpacity
                    onPress={handleLogin}
                    disabled={loading}
                    style={[styles.loginButton, loading && styles.disabledButton]}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.loginButtonText}>Sign In</Text>
                    )}
                </TouchableOpacity>

                {/* Sign Up Link */}
                <TouchableOpacity
                    onPress={() => navigation.navigate('SignUp')}
                    style={styles.signUpLink}
                    disabled={loading}
                >
                    <Text style={styles.signUpText}>
                        Don't have an account?{' '}
                        <Text style={styles.signUpTextHighlight}>Sign up</Text>
                    </Text>
                </TouchableOpacity>

                {/* Guest Mode */}
                <TouchableOpacity
                    onPress={async () => {
                        try {
                            setLoading(true);
                            await signInAsGuest();
                        } catch (e) {
                            Alert.alert('Error', 'Failed to sign in as guest');
                        } finally {
                            setLoading(false);
                        }
                    }}
                    style={styles.guestButton}
                    disabled={loading}
                >
                    <Text style={styles.guestButtonText}>Continue as Guest (Test Mode)</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    logoEmoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    title: {
        color: colors.text,
        fontSize: 32,
        fontWeight: 'bold',
    },
    subtitle: {
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: 8,
    },
    form: {
        gap: 16,
    },
    inputGroup: {
        marginBottom: 4,
    },
    label: {
        color: colors.textMuted,
        fontSize: 14,
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        backgroundColor: colors.surface,
        color: colors.text,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        fontSize: 16,
    },
    loginButton: {
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 32,
    },
    disabledButton: {
        opacity: 0.7,
    },
    loginButtonText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 18,
    },
    signUpLink: {
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 16,
    },
    signUpText: {
        color: colors.textMuted,
    },
    signUpTextHighlight: {
        color: colors.primary,
        fontWeight: '600',
    },
    guestButton: {
        marginTop: 8,
        alignItems: 'center',
        padding: 12,
    },
    guestButtonText: {
        color: colors.textMuted,
        textDecorationLine: 'underline',
    },
});
