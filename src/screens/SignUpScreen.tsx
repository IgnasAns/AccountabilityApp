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
    ScrollView,
    StyleSheet,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../theme/colors';

interface Props {
    navigation: NativeStackNavigationProp<any>;
}

export default function SignUpScreen({ navigation }: Props) {
    const { signUp } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSignUp = async () => {
        if (!name || !email || !password || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }

        try {
            setLoading(true);
            await signUp(email, password, name);
            Alert.alert(
                'Success!',
                'Please check your email to verify your account.',
                [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
            );
        } catch (error: any) {
            Alert.alert('Sign Up Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerEmoji}>👋</Text>
                    <Text style={styles.title}>
                        Create Account
                    </Text>
                    <Text style={styles.subtitle}>
                        Join Social Ledger and start holding yourself accountable
                    </Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Your Name</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="John Doe"
                            placeholderTextColor={colors.textMuted}
                            autoCapitalize="words"
                            style={styles.input}
                            editable={!loading}
                        />
                    </View>

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

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Confirm Password</Text>
                        <TextInput
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="••••••••"
                            placeholderTextColor={colors.textMuted}
                            secureTextEntry
                            style={styles.input}
                            editable={!loading}
                        />
                    </View>
                </View>

                {/* Sign Up Button */}
                <TouchableOpacity
                    onPress={handleSignUp}
                    disabled={loading}
                    style={[styles.signUpButton, loading && styles.disabledButton]}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.signUpButtonText}>Create Account</Text>
                    )}
                </TouchableOpacity>

                {/* Login Link */}
                <TouchableOpacity
                    onPress={() => navigation.navigate('Login')}
                    style={styles.loginLink}
                    disabled={loading}
                >
                    <Text style={styles.loginText}>
                        Already have an account?{' '}
                        <Text style={styles.loginTextHighlight}>Sign in</Text>
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingVertical: 48,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    headerEmoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    title: {
        color: colors.text,
        fontSize: 24,
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
    signUpButton: {
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 32,
    },
    disabledButton: {
        opacity: 0.7,
    },
    signUpButtonText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 18,
    },
    loginLink: {
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 16,
    },
    loginText: {
        color: colors.textMuted,
    },
    loginTextHighlight: {
        color: colors.primary,
        fontWeight: '600',
    },
});
