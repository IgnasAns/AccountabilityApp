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
import { useGroups } from '../hooks/useGroups';
import { colors } from '../theme/colors';

interface Props {
    navigation: NativeStackNavigationProp<any>;
}

export default function CreateGroupScreen({ navigation }: Props) {
    const { createGroup } = useGroups();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [penalty, setPenalty] = useState('1');
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Please enter a group name');
            return;
        }

        const penaltyAmount = parseFloat(penalty);
        if (isNaN(penaltyAmount) || penaltyAmount <= 0) {
            Alert.alert('Error', 'Please enter a valid penalty amount');
            return;
        }

        try {
            setLoading(true);
            const group = await createGroup(name.trim(), description.trim() || undefined, penaltyAmount);
            Alert.alert(
                'Group Created! 🎉',
                `Invite code: ${group.invite_code}\n\nShare this code with friends to join!`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.content}>
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

                {/* Create Button */}
                <View style={styles.footer}>
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
        padding: 24,
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
        flex: 1,
        justifyContent: 'flex-end',
        paddingBottom: 16,
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
