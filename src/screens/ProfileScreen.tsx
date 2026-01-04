
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    StyleSheet,
    Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyledAlert } from '../components/StyledAlert';
import ConfirmModal from '../components/ConfirmModal';

// Declare window for web platform
declare const window: { alert: (message: string) => void } | undefined;

interface Props {
    navigation: NativeStackNavigationProp<any>;
}

export default function ProfileScreen({ navigation }: Props) {
    const { profile, updateProfile, signOut } = useAuth();
    const insets = useSafeAreaInsets();
    const [name, setName] = useState(profile?.name || '');
    const [paymentLink, setPaymentLink] = useState(profile?.payment_link || '');
    const [loading, setLoading] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const handleSave = async () => {
        if (profile?.id === 'guest_user_id') {
            StyledAlert.alert('Guest Mode', 'You cannot update the guest profile.');
            return;
        }

        try {
            setLoading(true);
            await updateProfile({ name, payment_link: paymentLink || null });
            if (Platform.OS === 'web') {
                window?.alert('Profile updated successfully!');
            } else {
                StyledAlert.alert('Success', 'Profile updated successfully');
            }
        } catch (error: any) {
            if (Platform.OS === 'web') {
                window?.alert(`Error: ${error.message}`);
            } else {
                StyledAlert.alert('Error', error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = () => {
        setShowLogoutModal(true);
    };

    const doSignOut = async () => {
        setShowLogoutModal(false);
        try {
            await signOut();
        } catch (error: any) {
            // Sign out handled gracefully
        }
    };

    return (
        <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.contentContainer}>
            {/* Avatar */}
            <View style={styles.avatarContainer}>
                <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>
                        {profile?.name?.charAt(0).toUpperCase() || '?'}
                    </Text>
                </View>
                <Text style={styles.profileName}>
                    {profile?.name || 'User'}
                </Text>
            </View>

            {/* Profile Form */}
            <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Profile Settings</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Display Name</Text>
                    <TextInput
                        value={name}
                        onChangeText={setName}
                        placeholder="Your name"
                        placeholderTextColor={colors.textMuted}
                        style={styles.input}
                        editable={!loading}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Payment Link</Text>
                    <TextInput
                        value={paymentLink}
                        onChangeText={setPaymentLink}
                        placeholder="e.g., paypal.me/username or revolut.me/username"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        keyboardType="url"
                        style={styles.input}
                        editable={!loading}
                    />
                    <Text style={styles.helperText}>
                        Share this link so friends know where to send payments
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={handleSave}
                    disabled={loading}
                    style={[styles.saveButton, loading && styles.disabledButton]}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Danger Zone */}
            <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, styles.dangerTitle]}>Account</Text>

                <TouchableOpacity
                    onPress={handleSignOut}
                    style={styles.signOutButton}
                >
                    <Text style={styles.signOutButtonText}>Sign Out</Text>
                </TouchableOpacity>
            </View>

            {/* Logout Confirmation Modal */}
            <ConfirmModal
                visible={showLogoutModal}
                title="Sign Out"
                message="Are you sure you want to sign out? You'll need to log in again to access your account."
                confirmText="Sign Out"
                cancelText="Cancel"
                confirmStyle="danger"
                onConfirm={doSignOut}
                onCancel={() => setShowLogoutModal(false)}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    contentContainer: {
        padding: 24,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    avatarCircle: {
        width: 96,
        height: 96,
        backgroundColor: colors.primary,
        borderRadius: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    avatarText: {
        color: '#ffffff',
        fontSize: 36,
        fontWeight: 'bold',
    },
    profileName: {
        color: colors.text,
        fontSize: 20,
        fontWeight: 'bold',
    },
    sectionCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
    },
    sectionTitle: {
        color: colors.text,
        fontWeight: '600',
        marginBottom: 16,
    },
    dangerTitle: {
        color: colors.error,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        color: colors.textMuted,
        fontSize: 14,
        marginBottom: 8,
    },
    input: {
        backgroundColor: colors.surfaceHighlight,
        color: colors.text,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    helperText: {
        color: colors.textMuted,
        opacity: 0.7,
        fontSize: 12,
        marginTop: 8,
    },
    saveButton: {
        backgroundColor: colors.primary,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    disabledButton: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: '#ffffff',
        fontWeight: '600',
    },
    signOutButton: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)', // colors.error with opacity
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    signOutButtonText: {
        color: colors.error,
        fontWeight: '600',
    },
});
