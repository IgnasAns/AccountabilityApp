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
    Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyledAlert } from '../components/StyledAlert';
import ConfirmModal from '../components/ConfirmModal';
import { pickImage, uploadAvatar } from '../services/photoService';

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
                window?.alert(`Error: ${error.message} `);
            } else {
                StyledAlert.alert('Error', error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarPress = async () => {
        if (loading) return;
        if (profile?.id === 'guest_user_id') {
            StyledAlert.alert('Guest Mode', 'You cannot update the guest profile.');
            return;
        }

        try {
            const uri = await pickImage();
            if (uri) {
                setLoading(true);
                const publicUrl = await uploadAvatar(uri);
                await updateProfile({ avatar_url: publicUrl });
                StyledAlert.alert('Success', 'Profile picture updated');
            }
        } catch (error: any) {
            StyledAlert.alert('Error', error.message || 'Failed to update profile picture');
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
                <TouchableOpacity
                    style={styles.avatarCircle}
                    onPress={handleAvatarPress}
                    disabled={loading}
                    activeOpacity={0.8}
                >
                    {profile?.avatar_url ? (
                        <Image
                            source={{ uri: profile.avatar_url }}
                            style={styles.avatarImage}
                        />
                    ) : (
                        <Text style={styles.avatarText}>
                            {profile?.name?.charAt(0).toUpperCase() || '?'}
                        </Text>
                    )}

                    {/* Camera Icon Overlay */}
                    <View style={styles.cameraIconContainer}>
                        <Text style={styles.cameraIcon}>📷</Text>
                    </View>
                </TouchableOpacity>
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
        paddingHorizontal: 24,
        paddingTop: 30,
        paddingBottom: 40,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    avatarCircle: {
        width: 100,
        height: 100,
        backgroundColor: colors.surface,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 8,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 50,
    },
    cameraIconContainer: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 6,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    cameraIcon: {
        fontSize: 14,
    },
    avatarText: {
        color: colors.primary,
        fontSize: 40,
        fontWeight: '800',
    },
    profileName: {
        color: colors.text,
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    sectionCard: {
        backgroundColor: colors.surface,
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.border,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 20,
    },
    dangerTitle: {
        color: colors.error,
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
        backgroundColor: colors.surfaceHighlight,
        color: colors.text,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        fontSize: 16,
    },
    helperText: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 8,
        lineHeight: 18,
    },
    saveButton: {
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 10,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    disabledButton: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 16,
    },
    signOutButton: {
        backgroundColor: colors.error + '10',
        borderWidth: 1,
        borderColor: colors.error + '30',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    signOutButtonText: {
        color: colors.error,
        fontWeight: '800',
        fontSize: 16,
    },
});
