import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import AppIcon, { AppIconName } from './AppIcon';

interface EmptyStateProps {
    emoji?: string;
    icon?: AppIconName;
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onAction?: () => void;
    style?: ViewStyle;
}

/**
 * Polished empty state component with optional CTA button.
 */
export default function EmptyState({
    emoji,
    icon,
    title,
    subtitle,
    actionLabel,
    onAction,
    style,
}: EmptyStateProps) {
    return (
        <View style={[styles.container, style]}>
            {(icon || emoji) && (
                <View style={styles.iconCircle}>
                    {icon ? (
                        <AppIcon name={icon} size={34} color={colors.primary} />
                    ) : (
                        <Text style={styles.emoji}>{emoji}</Text>
                    )}
                </View>
            )}
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            {actionLabel && onAction && (
                <TouchableOpacity style={styles.actionButton} onPress={onAction} activeOpacity={0.8}>
                    <Text style={styles.actionButtonText}>{actionLabel}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: 48,
        paddingHorizontal: 32,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 16,
        backgroundColor: colors.primaryMuted,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emoji: {
        fontSize: 36,
    },
    title: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        color: colors.textMuted,
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    actionButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    actionButtonText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 15,
    },
});
