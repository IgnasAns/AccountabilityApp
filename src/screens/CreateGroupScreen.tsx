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
import InviteCodeModal from '../components/InviteCodeModal';
import { colors } from '../theme/colors';

// Declare window for web platform
declare const window: { alert: (message: string) => void } | undefined;

interface Props {
    navigation: NativeStackNavigationProp<any>;
}

export default function CreateGroupScreen({ navigation }: Props) {
    const { createGroup } = useGroups();
    const { user } = useAuth(); // Import user to check for guest
    const insets = useSafeAreaInsets();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [penalty, setPenalty] = useState('1');
    const [loading, setLoading] = useState(false);

    // For invite code modal
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [createdInviteCode, setCreatedInviteCode] = useState('');
    const [createdGroupName, setCreatedGroupName] = useState('');

    const showAlert = (title: string, message: string, onOk?: () => void) => {
        if (Platform.OS === 'web') {
            window?.alert(`${title}\n\n${message}`);
            onOk?.();
        } else {
            StyledAlert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
        }
    };

    const handleCreate = async () => {
        if (user?.id === 'guest_user_id') {
            showAlert('Guest Mode', 'You must sign up to create groups.');
            return;
        }

        if (!name.trim()) {
            showAlert('Error', 'Please enter a group name');
            return;
        }

        const penaltyAmount = parseFloat(penalty);
        if (isNaN(penaltyAmount) || penaltyAmount <= 0) {
            showAlert('Error', 'Please enter a valid penalty amount');
            return;
        }

        try {
            setLoading(true);

            // Add timeout to prevent infinite loading
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timed out. Please run the SQL setup scripts in your Supabase Dashboard.')), 15000)
            );

            const group = await Promise.race([
                createGroup(name.trim(), description.trim() || undefined, penaltyAmount),
                timeoutPromise
            ]) as any;

            // Store the invite code and show the modal
            setCreatedInviteCode(group.invite_code);
            setCreatedGroupName(name.trim());
            setShowInviteModal(true);
        } catch (error: any) {
            console.error('Create group error:', error);
            if (error.message?.includes('timed out')) {
                showAlert('Setup Required', 'Database not configured.\n\nRun "supabase/full_setup.sql" in your Supabase Dashboard SQL Editor.');
            } else if (error.message?.includes('403') || error.message?.includes('permission')) {
                showAlert('Permission Error', 'You do not have permission to create a group.\n\nRun "supabase/full_setup.sql" in Supabase SQL Editor to fix RLS policies.');
            } else {
                showAlert('Error', error.message || 'Failed to create group');
            }
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
                            Create New Group
                        </Text>
                        <Text style={styles.subtitle}>
                            Start a new accountability group and invite friends
                        </Text>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Group Name *</Text>
                            <TextInput
                                value={name}
                                onChangeText={setName}
                                placeholder="e.g., No Smoking Club"
                                placeholderTextColor={colors.textMuted}
                                style={styles.input}
                                editable={!loading}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Description (optional)</Text>
                            <TextInput
                                value={description}
                                onChangeText={setDescription}
                                placeholder="What's this group about?"
                                placeholderTextColor={colors.textMuted}
                                multiline
                                numberOfLines={3}
                                style={[styles.input, styles.multilineInput]}
                                editable={!loading}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>
                                Default Penalty Amount (€) *
                            </Text>
                            <TextInput
                                value={penalty}
                                onChangeText={setPenalty}
                                placeholder="1.00"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="decimal-pad"
                                style={styles.input}
                                editable={!loading}
                            />
                            <Text style={styles.helperText}>
                                This amount is charged to each group member when someone fails
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Create Button - Fixed at bottom */}
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                <TouchableOpacity
                    onPress={handleCreate}
                    disabled={loading}
                    style={[styles.createButton, loading && styles.disabledButton]}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.createButtonText}>Create Group</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Invite Code Modal */}
            <InviteCodeModal
                visible={showInviteModal}
                inviteCode={createdInviteCode}
                groupName={createdGroupName}
                onClose={() => {
                    setShowInviteModal(false);
                    navigation.goBack();
                }}
            />
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
    multilineInput: {
        textAlignVertical: 'top',
        minHeight: 80,
    },
    helperText: {
        color: colors.textMuted,
        opacity: 0.7,
        fontSize: 12,
        marginTop: 8,
        marginLeft: 4,
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
    createButton: {
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    disabledButton: {
        opacity: 0.7,
    },
    createButtonText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 18,
    },
});
