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

interface Props {
    navigation: NativeStackNavigationProp<any>;
}

export default function JoinGroupScreen({ navigation }: Props) {
    const { joinGroup } = useGroups();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const [inviteCode, setInviteCode] = useState('');
    const [loading, setLoading] = useState(false);

    const handleJoin = async () => {
        if (user?.id === 'guest_user_id') {
            StyledAlert.alert('Guest Mode', 'You must sign up to join groups.');
            return;
        }

        const code = inviteCode.trim().toUpperCase();
        if (!code) {
            StyledAlert.alert('Error', 'Please enter an invite code');
            return;
        }

        if (code.length !== 8) {
            StyledAlert.alert('Error', 'Invite code should be 8 characters');
            return;
        }

        try {
            setLoading(true);
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
        } catch (error: any) {
            StyledAlert.alert('Error', error.message);
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
                    contentContainerStyle={styles.content}
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
                            onChangeText={(text) => setInviteCode(text.toUpperCase())}
                            placeholder="ABC12345"
                            placeholderTextColor={colors.textMuted}
                            autoCapitalize="characters"
                            maxLength={8}
                            style={styles.codeInput}
                            editable={!loading}
                        />
                        <Text style={styles.helperText}>
                            The code is case-insensitive
                        </Text>
                    </View>

                    {/* Visual explanation */}
                    <View style={styles.explanationCard}>
                        <View style={styles.explanationRow}>
                            <Text style={styles.stepEmoji}>1️⃣</Text>
                            <View style={styles.stepTextContainer}>
                                <Text style={styles.stepTitle}>Get the code</Text>
                                <Text style={styles.stepDescription}>
                                    Ask a friend to share their group's invite code
                                </Text>
                            </View>
                        </View>
                        <View style={styles.explanationRow}>
                            <Text style={styles.stepEmoji}>2️⃣</Text>
                            <View style={styles.stepTextContainer}>
                                <Text style={styles.stepTitle}>Enter it above</Text>
                                <Text style={styles.stepDescription}>
                                    Type the 8-character code
                                </Text>
                            </View>
                        </View>
                        <View style={styles.explanationRow}>
                            <Text style={styles.stepEmoji}>3️⃣</Text>
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
                    disabled={loading || inviteCode.length !== 8}
                    style={[
                        styles.joinButton,
                        (loading || inviteCode.length !== 8) && styles.disabledButton
                    ]}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.joinButtonText}>Join Group</Text>
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
        fontSize: 14,
        marginBottom: 16,
    },
    codeInput: {
        backgroundColor: colors.surface,
        color: colors.text,
        textAlign: 'center',
        fontSize: 30,
        fontWeight: 'bold',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        paddingHorizontal: 32,
        paddingVertical: 24,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        width: '100%',
        letterSpacing: 8,
    },
    helperText: {
        color: colors.textMuted,
        opacity: 0.7,
        fontSize: 14,
        marginTop: 12,
    },
    explanationCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 32,
    },
    explanationRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    stepEmoji: {
        fontSize: 24,
        marginRight: 12,
    },
    stepTextContainer: {
        flex: 1,
    },
    stepTitle: {
        color: colors.text,
        fontWeight: '500',
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
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
    },
    joinButton: {
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    disabledButton: {
        opacity: 0.6,
    },
    joinButtonText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 18,
    },
});
