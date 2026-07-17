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
import { sanitizeName, sanitizeUrl } from '../utils/sanitize';
import { safeHaptics } from '../utils/haptics';
import AppIcon from '../components/AppIcon';
import appConfig from '../../app.json';

// Declare window for web platform
declare const window: { alert: (message: string) => void } | undefined;

const APP_VERSION = appConfig.expo.version;

interface Props {
    navigation: NativeStackNavigationProp<any>;
}

export default function ProfileScreen({ navigation }: Props) {
    const { profile, updateProfile, signOut, isGuest } = useAuth();
    const insets = useSafeAreaInsets();
    const [name, setName] = useState(profile?.name || '');
    const [paymentLink, setPaymentLink] = useState(profile?.payment_link || '');
    const [loading, setLoading] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [errors, setErrors] = useState<{ name?: string; paymentLink?: string }>({});

    const validateForm = (): boolean => {
        const newErrors: typeof errors = {};

        const sanitizedName = sanitizeName(name);
        if (!sanitizedName || sanitizedName.length < 2) {
            newErrors.name = 'Name must be at least 2 characters';
        }

        if (paymentLink.trim()) {
            const sanitizedUrl = sanitizeUrl(paymentLink);
            if (!sanitizedUrl) {
                newErrors.paymentLink = 'Please enter a valid URL';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) {
            safeHaptics('warning');
            return;
        }

        try {
            setLoading(true);
            safeHaptics('light');

            const sanitizedName = sanitizeName(name);
            const sanitizedPaymentLink = paymentLink.trim() ? sanitizeUrl(paymentLink) : null;

            await updateProfile({
                name: sanitizedName,
                payment_link: sanitizedPaymentLink,
            });

            safeHaptics('success');

            if (Platform.OS === 'web') {
                window?.alert('Profile updated successfully!');
            } else {
                StyledAlert.alert('Success', 'Profile updated successfully');
            }
        } catch (error: unknown) {
            safeHaptics('error');
            if (Platform.OS === 'web') {
                window?.alert(`Error: ${(error instanceof Error ? error.message : "An error occurred")} `);
            } else {
                StyledAlert.alert('Error', (error instanceof Error ? error.message : "An error occurred"));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarPress = async () => {
        if (loading) return;

        try {
            const uri = await pickImage();
            if (uri) {
                setLoading(true);
                safeHaptics('light');
                const publicUrl = await uploadAvatar(uri);
                await updateProfile({ avatar_url: publicUrl });
                safeHaptics('success');
                StyledAlert.alert('Success', 'Profile picture updated');
            }
        } catch (error: unknown) {
            safeHaptics('error');
            StyledAlert.alert('Error', (error instanceof Error ? error.message : "Failed to update profile picture"));
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = () => {
        setShowLogoutModal(true);
    };

    const handleChangePassword = () => {
        if (isGuest) {
            StyledAlert.alert('Password Not Available', 'Guest accounts do not have passwords. Create an account to use password security.');
            return;
        }

        navigation.navigate('ChangePassword');
    };

    const doSignOut = async () => {
        setShowLogoutModal(false);
        try {
            await signOut();
        } catch {
            // Sign out handled gracefully
        }
    };

    const getInitial = (): string => {
        if (profile?.name) {
            return profile.name.charAt(0).toUpperCase();
        }
        if (profile?.email) {
            return profile.email.charAt(0).toUpperCase();
        }
        return '?';
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
                        <Text style={styles.avatarText}>{getInitial()}</Text>
                    )}

                    <View style={styles.cameraIconContainer}>
                        <AppIcon name="camera-outline" size={16} color={colors.text} />
                    </View>
                </TouchableOpacity>
                <Text style={styles.profileName}>
                    {profile?.name || 'User'}
                </Text>
                {profile?.email && (
                    <Text style={styles.profileEmail}>{profile.email}</Text>
                )}
            </View>

            {/* Profile Form */}
            <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Profile Settings</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Display Name</Text>
                    <TextInput
                        value={name}
                        onChangeText={(text) => {
                            setName(text);
                            if (errors.name) setErrors({ ...errors, name: undefined });
                        }}
                        placeholder="Your name"
                        placeholderTextColor={colors.textMuted}
                        style={[styles.input, errors.name ? styles.inputError : undefined]}
                        editable={!loading}
                        maxLength={50}
                    />
                    {errors.name && (
                        <Text style={styles.errorText}>{errors.name}</Text>
                    )}
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Payment Link</Text>
                    <TextInput
                        value={paymentLink}
                        onChangeText={(text) => {
                            setPaymentLink(text);
                            if (errors.paymentLink) setErrors({ ...errors, paymentLink: undefined });
                        }}
                        placeholder="e.g., paypal.me/username"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        style={[styles.input, errors.paymentLink ? styles.inputError : undefined]}
                        editable={!loading}
                    />
                    {errors.paymentLink && (
                        <Text style={styles.errorText}>{errors.paymentLink}</Text>
                    )}
                    <Text style={styles.helperText}>
                        Share this so friends know where to send payments
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={handleSave}
                    disabled={loading}
                    style={[styles.saveButton, loading && styles.disabledButton]}
                    activeOpacity={0.8}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Account Section */}
            <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, styles.dangerTitle]}>Account</Text>

                <TouchableOpacity
                    onPress={handleChangePassword}
                    style={styles.accountButton}
                    activeOpacity={0.8}
                >
                    <AppIcon name="lock-outline" size={20} color={colors.text} />
                    <Text style={styles.accountButtonText}>Change Password</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleSignOut}
                    style={styles.signOutButton}
                    activeOpacity={0.8}
                >
                    <Text style={styles.signOutButtonText}>Sign Out</Text>
                </TouchableOpacity>
            </View>

            {/* Version Info */}
            <View style={styles.versionContainer}>
                <Text style={styles.versionText}>Do It Mate! v{APP_VERSION}</Text>
            </View>

            {/* Logout Confirmation Modal */}
            <ConfirmModal
                visible={showLogoutModal}
                title="Sign Out"
                message="Are you sure you want to sign out?"
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
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 4,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 24,
    },
    cameraIconContainer: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderRadius: 8,
        padding: 6,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
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
    profileEmail: {
        color: colors.textMuted,
        fontSize: 14,
        marginTop: 4,
    },
    sectionCard: {
        backgroundColor: colors.surface,
        borderRadius: 8,
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
    helperText: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 8,
        lineHeight: 18,
    },
    saveButton: {
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
        elevation: 3,
    },
    disabledButton: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 16,
    },
    accountButton: {
        flexDirection: 'row',
        gap: 10,
        backgroundColor: colors.surfaceHighlight,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    accountButtonText: {
        color: colors.text,
        fontWeight: '800',
        fontSize: 16,
    },
    signOutButton: {
        backgroundColor: colors.error + '10',
        borderWidth: 1,
        borderColor: colors.error + '30',
        paddingVertical: 16,
        borderRadius: 10,
        alignItems: 'center',
    },
    signOutButtonText: {
        color: colors.error,
        fontWeight: '800',
        fontSize: 16,
    },
    versionContainer: {
        alignItems: 'center',
        marginTop: 16,
    },
    versionText: {
        color: colors.textMuted,
        fontSize: 12,
    },
});
