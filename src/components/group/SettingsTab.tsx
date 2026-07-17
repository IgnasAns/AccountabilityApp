import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
    inviteCode: string;
    isCreator: boolean;
    hasBalance: boolean;
    onCopyCode: () => void;
    onShareInvite: () => void;
    onLeaveGroup: () => void;
    onDeleteGroup: () => void;
}

export default function SettingsTab({
    inviteCode,
    isCreator,
    hasBalance,
    onCopyCode,
    onShareInvite,
    onLeaveGroup,
    onDeleteGroup,
}: Props) {
    return (
        <View style={styles.container}>
            {/* Invite Code Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Invite Friends</Text>
                <Text style={styles.sectionSubtitle}>
                    Share this code so others can join your group
                </Text>

                <TouchableOpacity style={styles.codeCard} onPress={onCopyCode}>
                    <View style={styles.codeContainer}>
                        {inviteCode.split('').map((char, index) => (
                            <View key={index} style={styles.codeCharBox}>
                                <Text style={styles.codeChar}>{char}</Text>
                            </View>
                        ))}
                    </View>
                    <Text style={styles.tapHint}>Tap to copy</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.shareButton} onPress={onShareInvite}>
                    <Text style={styles.shareButtonText}>📤 Share Invite</Text>
                </TouchableOpacity>
            </View>

            {/* Danger Zone */}
            <View style={styles.section}>
                <Text style={styles.dangerTitle}>Danger Zone</Text>

                <TouchableOpacity
                    style={[styles.leaveButton, hasBalance && styles.disabledButton]}
                    onPress={onLeaveGroup}
                    disabled={hasBalance}
                >
                    <Text style={styles.leaveButtonText}>Leave Group</Text>
                    {hasBalance && (
                        <Text style={styles.disabledHint}>
                            Settle your balance first
                        </Text>
                    )}
                </TouchableOpacity>

                {isCreator && (
                    <TouchableOpacity style={styles.deleteButton} onPress={onDeleteGroup}>
                        <Text style={styles.deleteButtonText}>🗑️ Delete Group</Text>
                        <Text style={styles.deleteHint}>
                            This will permanently delete all group data
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    section: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 4,
    },
    sectionSubtitle: {
        color: colors.textMuted,
        fontSize: 14,
        marginBottom: 20,
    },
    codeCard: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.primary,
        borderStyle: 'dashed',
        marginBottom: 16,
    },
    codeContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    codeCharBox: {
        width: 40,
        height: 48,
        backgroundColor: colors.primary + '15',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    codeChar: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.primary,
    },
    tapHint: {
        color: colors.textMuted,
        fontSize: 13,
    },
    shareButton: {
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
    },
    shareButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
    dangerTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.error,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    leaveButton: {
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        marginBottom: 12,
    },
    disabledButton: {
        opacity: 0.6,
    },
    leaveButtonText: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '500',
    },
    disabledHint: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 4,
    },
    deleteButton: {
        backgroundColor: colors.error + '10',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.error,
        alignItems: 'center',
    },
    deleteButtonText: {
        color: colors.error,
        fontSize: 16,
        fontWeight: '600',
    },
    deleteHint: {
        color: colors.error,
        fontSize: 12,
        marginTop: 4,
        opacity: 0.7,
    },
});
