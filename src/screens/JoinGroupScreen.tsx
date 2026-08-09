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
import { useGroups } from '../hooks/useGroups';
import { useAuth } from '../hooks/useAuth';
import { StyledAlert } from '../components/StyledAlert';
import { colors } from '../theme/colors';
import { sanitizeInviteCode } from '../utils/sanitize';
import AppIcon from '../components/AppIcon';

interface Props {
    navigation: NativeStackNavigationProp<any>;
    route?: {
        params?: {
            inviteCode?: string;
        };
    };
}

export default function JoinGroupScreen({ navigation, route }: Props) {
    const { joinGroup } = useGroups();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const [inviteCode, setInviteCode] = useState(route?.params?.inviteCode?.toUpperCase() || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Prefill from deep links (doitmate://join?code=XXXXXXXX) whenever the
    // param arrives, cold start or warm.
    React.useEffect(() => {
        const code = route?.params?.inviteCode;
        if (code) {
            setInviteCode(code.toUpperCase());
            if (error) setError(null);
        }
    }, [route?.params?.inviteCode, error]);

    const handleJoin = async () => {
        // Sanitize the invite code
        const code = sanitizeInviteCode(inviteCode);
        if (!code) {
            setError('Please enter an invite code');
            return;
        }

        if (code.length !== 8) {
            setError('Invite code should be 8 characters');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const result = await joinGroup(code);

            // Navigate directly to the new group
            if (result?.group_id) {
                StyledAlert.alert('Success! 🎉', 'You have joined the group!');
                navigation.replace('GroupDetail' as any, { groupId: result.group_id });
            } else {
                StyledAlert.alert('Success! 🎉', 'You have joined the group!');
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'MainTabs' as any }],
                });
            }
        } catch (error: unknown) {
            StyledAlert.alert('Error', (error instanceof Error ? error.message : "An error occurred"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.keyboardView}
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 96 }]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>
                            Join a Group
                        </Text>
                        <Text style={styles.subtitle}>
                            Enter the invite code shared by a friend
                        </Text>
                    </View>

                    {/* Invite Code Input */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Invite Code</Text>
                        <TextInput
                            value={inviteCode}
                            onChangeText={(text) => {
                                setInviteCode(text.toUpperCase());
                                if (error) setError(null);
                            }}
                            placeholder="ABC12345"
                            placeholderTextColor={colors.textMuted}
                            autoCapitalize="characters"
                            maxLength={8}
                            style={[styles.codeInput, error ? styles.inputError : undefined]}
                            editable={!loading}
                        />
                        {error && (
                            <Text style={styles.errorText}>{error}</Text>
                        )}
                        <Text style={styles.helperText}>
                            The code is case-insensitive
                        </Text>
                    </View>

                    {/* Visual explanation */}
                    <View style={styles.explanationCard}>
                        <View style={styles.explanationRow}>
                            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                            <View style={styles.stepTextContainer}>
                                <Text style={styles.stepTitle}>Get the code</Text>
                                <Text style={styles.stepDescription}>
                                    Ask a friend to share their group's invite code
                                </Text>
                            </View>
                        </View>
                        <View style={styles.explanationRow}>
                            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                            <View style={styles.stepTextContainer}>
                                <Text style={styles.stepTitle}>Enter it above</Text>
                                <Text style={styles.stepDescription}>
                                    Type the 8-character code
                                </Text>
                            </View>
                        </View>
                        <View style={styles.explanationRow}>
                            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
                            <View style={styles.stepTextContainer}>
                                <Text style={styles.stepTitle}>Start tracking</Text>
                                <Text style={styles.stepDescription}>
                                    Hold each other accountable!
                                </Text>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Join Button - Fixed at bottom */}
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                <TouchableOpacity
                    onPress={handleJoin}
                    disabled={loading}
                    style={[
                        styles.joinButton,
                        loading && styles.disabledButton
                    ]}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <AppIcon name="login-variant" size={20} color="#fff" />
                            <Text style={styles.joinButtonText}>Join Group</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
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
        padding: 24,
        paddingBottom: 24,
    },
    header: {
        marginBottom: 32,
    },
    title: {
        color: colors.text,
        fontSize: 24,
        fontWeight: 'bold',
    },
    subtitle: {
        color: colors.textMuted,
        marginTop: 8,
    },
    inputContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    label: {
        color: colors.textMuted,
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 16,
    },
    codeInput: {
        backgroundColor: colors.surfaceHighlight, // Premium look
        color: colors.text,
        textAlign: 'center',
        fontSize: 30,
        fontWeight: 'bold',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        paddingHorizontal: 32,
        paddingVertical: 24,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        width: '100%',
        letterSpacing: 8,
    },
    inputError: {
        borderColor: colors.error,
    },
    errorText: {
        color: colors.error,
        fontSize: 12,
        marginTop: 10,
        textAlign: 'center',
    },
    helperText: {
        color: colors.textMuted,
        opacity: 0.7,
        fontSize: 14,
        marginTop: 12,
    },
    explanationCard: {
        backgroundColor: colors.surface,
        borderRadius: 8,
        padding: 24,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: colors.border,
    },
    explanationRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    stepNumber: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: colors.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    stepNumberText: {
        color: colors.primary,
        fontWeight: '800',
    },
    stepTextContainer: {
        flex: 1,
    },
    stepTitle: {
        color: colors.text,
        fontWeight: '700',
        fontSize: 16,
    },
    stepDescription: {
        color: colors.textMuted,
        fontSize: 14,
        marginTop: 4,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.background,
        paddingHorizontal: 24,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        // Shadow for depth
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 6,
    },
    joinButton: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        // Premium shadow
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
        elevation: 3,
    },
    disabledButton: {
        opacity: 0.6,
    },
    joinButtonText: {
        color: '#ffffff',
        fontWeight: '800', // Consistent weight
        fontSize: 18,
    },
});
