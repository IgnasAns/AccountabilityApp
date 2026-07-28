/**
 * Notification settings card.
 *
 * Lives in the Profile screen. Deliberately explicit about *what* will be sent
 * and *when* — an app that fines you needs to be honest about its nagging, and
 * a visible off switch is what stops people uninstalling instead of muting.
 */

import React from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';

import { colors } from '../theme/colors';
import { useNotifications } from '../hooks/useNotifications';
import { safeHaptics } from '../utils/haptics';
import AppIcon from './AppIcon';

/** Sensible reminder times; a full time picker is overkill for one setting. */
const HOUR_PRESETS = [7, 9, 12, 18, 20] as const;

function formatHour(hour: number): string {
    return `${hour.toString().padStart(2, '0')}:00`;
}

export default function NotificationSettings() {
    const { prefs, scheduledCount, permissionGranted, updatePrefs } = useNotifications();

    const blocked = prefs.enabled && !permissionGranted;

    const toggle = (key: 'enabled' | 'dayBefore' | 'dayOf') => (value: boolean) => {
        safeHaptics('selection');
        updatePrefs({ [key]: value });
    };

    const pickHour = (hour: number) => {
        safeHaptics('selection');
        updatePrefs({ hour });
    };

    return (
        <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Reminders</Text>

            <View style={styles.row}>
                <View style={styles.rowLabel}>
                    <Text style={styles.rowTitle}>Goal reminders</Text>
                    <Text style={styles.rowHint}>
                        Get nudged before a deadline instead of finding out you owe money.
                    </Text>
                </View>
                <Switch
                    value={prefs.enabled}
                    onValueChange={toggle('enabled')}
                    trackColor={{ false: colors.border, true: colors.primaryMuted }}
                    thumbColor={prefs.enabled ? colors.primary : colors.textSubtle}
                />
            </View>

            {blocked && (
                <TouchableOpacity
                    style={styles.warning}
                    activeOpacity={0.8}
                    onPress={() => Linking.openSettings()}
                >
                    <AppIcon name="bell-off-outline" size={18} color={colors.warning} />
                    <Text style={styles.warningText}>
                        Notifications are blocked for Do It Mate in your {Platform.OS === 'ios' ? 'iOS' : 'Android'}{' '}
                        settings. Tap to open them.
                    </Text>
                </TouchableOpacity>
            )}

            {prefs.enabled && (
                <>
                    <View style={styles.divider} />

                    <View style={styles.row}>
                        <View style={styles.rowLabel}>
                            <Text style={styles.rowTitle}>Due tomorrow</Text>
                            <Text style={styles.rowHint}>A day of warning before the deadline.</Text>
                        </View>
                        <Switch
                            value={prefs.dayBefore}
                            onValueChange={toggle('dayBefore')}
                            trackColor={{ false: colors.border, true: colors.primaryMuted }}
                            thumbColor={prefs.dayBefore ? colors.primary : colors.textSubtle}
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={styles.rowLabel}>
                            <Text style={styles.rowTitle}>Last chance</Text>
                            <Text style={styles.rowHint}>On the day it is due, while you can still act.</Text>
                        </View>
                        <Switch
                            value={prefs.dayOf}
                            onValueChange={toggle('dayOf')}
                            trackColor={{ false: colors.border, true: colors.primaryMuted }}
                            thumbColor={prefs.dayOf ? colors.primary : colors.textSubtle}
                        />
                    </View>

                    <View style={styles.divider} />

                    <Text style={styles.rowTitle}>Remind me at</Text>
                    <View style={styles.chipRow}>
                        {HOUR_PRESETS.map((hour) => {
                            const active = prefs.hour === hour;
                            return (
                                <TouchableOpacity
                                    key={hour}
                                    onPress={() => pickHour(hour)}
                                    style={[styles.chip, active && styles.chipActive]}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                        {formatHour(hour)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <Text style={styles.footer}>
                        {scheduledCount > 0
                            ? `${scheduledCount} reminder${scheduledCount === 1 ? '' : 's'} scheduled.`
                            : 'No upcoming deadlines to remind you about yet.'}
                    </Text>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    sectionCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        gap: 12,
    },
    rowLabel: {
        flex: 1,
    },
    rowTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
    },
    rowHint: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 3,
        lineHeight: 17,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 12,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: colors.surfaceHighlight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    chipActive: {
        backgroundColor: colors.primaryMuted,
        borderColor: colors.primary,
    },
    chipText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textMuted,
    },
    chipTextActive: {
        color: colors.text,
    },
    footer: {
        fontSize: 12,
        color: colors.textSubtle,
        marginTop: 14,
    },
    warning: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.warning,
        padding: 12,
        marginTop: 12,
    },
    warningText: {
        flex: 1,
        fontSize: 12,
        color: colors.textMuted,
        lineHeight: 17,
    },
});
