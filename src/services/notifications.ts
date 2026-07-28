/**
 * Notifications Service
 *
 * Two independent delivery paths:
 *
 * 1. LOCAL scheduled reminders (works today, no backend, no FCM credentials).
 *    Deadline reminders for the signed-in user's own goals. This is what makes
 *    an accountability app actually hold you accountable, so it must never
 *    depend on server availability.
 *
 * 2. REMOTE push via Expo's push service, for things only the server knows
 *    about (a mate logged a failure, someone nudged you). Requires a valid
 *    EAS projectId + FCM credentials; degrades silently to "local only" when
 *    those are missing so the app never breaks over it.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import { supabase } from './supabase';
import { colors } from '../theme/colors';
import { env } from '../config/env';

// ============ Channels ============

export const ANDROID_CHANNELS = {
    reminders: 'goal-reminders',
    social: 'group-activity',
} as const;

// ============ Preference storage ============

const PREFS_KEY = '@doitmate/notification_prefs';

export interface NotificationPrefs {
    /** Master switch. When false nothing is scheduled and no token is stored. */
    enabled: boolean;
    /** "Due tomorrow" nudge, at `hour` on the day before the deadline. */
    dayBefore: boolean;
    /** Last-chance nudge shortly before the deadline itself. */
    dayOf: boolean;
    /** Hour of day (0-23, local) for the "due tomorrow" nudge. */
    hour: number;
}

export const DEFAULT_PREFS: NotificationPrefs = {
    enabled: true,
    dayBefore: true,
    dayOf: true,
    hour: 9,
};

export async function loadPrefs(): Promise<NotificationPrefs> {
    try {
        const raw = await AsyncStorage.getItem(PREFS_KEY);
        if (!raw) return DEFAULT_PREFS;
        const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
        return {
            enabled: parsed.enabled ?? DEFAULT_PREFS.enabled,
            dayBefore: parsed.dayBefore ?? DEFAULT_PREFS.dayBefore,
            dayOf: parsed.dayOf ?? DEFAULT_PREFS.dayOf,
            hour: clampHour(parsed.hour),
        };
    } catch {
        return DEFAULT_PREFS;
    }
}

export async function savePrefs(prefs: NotificationPrefs): Promise<void> {
    try {
        await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (err) {
        console.error('[Notifications] Failed to persist prefs:', err);
    }
}

function clampHour(hour: number | undefined): number {
    if (typeof hour !== 'number' || Number.isNaN(hour)) return DEFAULT_PREFS.hour;
    return Math.min(23, Math.max(0, Math.floor(hour)));
}

// ============ Setup ============

let handlerConfigured = false;

/**
 * Foreground presentation + Android channels. Safe to call more than once.
 */
export async function configureNotifications(): Promise<void> {
    if (!handlerConfigured) {
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowBanner: true,
                shouldShowList: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
            }),
        });
        handlerConfigured = true;
    }

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.reminders, {
            name: 'Goal reminders',
            description: 'Deadline reminders for your own goals.',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: colors.primary,
        });

        await Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.social, {
            name: 'Group activity',
            description: 'Failures, nudges and comments from your groups.',
            importance: Notifications.AndroidImportance.DEFAULT,
            lightColor: colors.primary,
        });
    }
}

/**
 * Ask for permission if we do not already have it.
 * Returns true when we are allowed to post notifications.
 */
export async function ensurePermissions(): Promise<boolean> {
    if (!Device.isDevice) {
        // Emulators can post local notifications but never get a push token.
        if (env.enableDebugLogs) {
            console.log('[Notifications] Not a physical device.');
        }
    }

    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;

    // Don't re-prompt once the user has explicitly said no; iOS only allows
    // one prompt anyway and Android 13+ behaves the same after a denial.
    if (!existing.canAskAgain) return false;

    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
}

// ============ Remote push token ============

function getProjectId(): string | null {
    const fromConfig =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    if (typeof fromConfig !== 'string') return null;
    // app.json historically shipped the literal placeholder; treat it as absent.
    if (!fromConfig || fromConfig === 'your-project-id') return null;
    return fromConfig;
}

/**
 * Fetch the Expo push token and store it against the user so the backend can
 * reach them. No-ops (returning null) when push isn't configured yet — remote
 * push is a bonus, local reminders are the load-bearing part.
 */
export async function registerPushToken(userId: string): Promise<string | null> {
    if (!Device.isDevice) return null;

    const projectId = getProjectId();
    if (!projectId) {
        if (env.enableDebugLogs) {
            console.log('[Notifications] No EAS projectId — skipping push token registration.');
        }
        return null;
    }

    try {
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (!token) return null;

        const { error } = await supabase.from('push_tokens').upsert(
            {
                user_id: userId,
                token,
                platform: Platform.OS,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'token' }
        );

        if (error) {
            console.error('[Notifications] Failed to store push token:', error.message);
            return null;
        }

        return token;
    } catch (err) {
        // Missing FCM credentials land here. Not fatal.
        console.error('[Notifications] Push token unavailable:', err);
        return null;
    }
}

export async function unregisterPushToken(userId: string): Promise<void> {
    const projectId = getProjectId();
    if (!projectId || !Device.isDevice) return;

    try {
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (!token) return;
        await supabase.from('push_tokens').delete().eq('user_id', userId).eq('token', token);
    } catch {
        // Signing out must never fail because of notification cleanup.
    }
}

// ============ Local deadline reminders ============

export interface GoalReminder {
    goalId: string;
    goalName: string;
    emoji: string;
    groupName: string;
    penaltyAmount: number;
    /** ISO timestamp of the next deadline for this user. */
    deadline: string;
}

/** Marks a scheduled notification as one of ours so we can safely replace it. */
const REMINDER_TAG = 'goal-reminder';

/**
 * How far ahead of the deadline the "last chance" nudge fires.
 *
 * Anchored to the deadline rather than a fixed clock hour on purpose. A
 * deadline is `lastCompletion + frequency_days`, so it inherits the time of day
 * the user last completed the goal — a fixed-hour reminder lands *after* the
 * deadline for roughly half of all goals, and daily goals would get no
 * last-chance nudge at all.
 */
const LAST_CHANCE_LEAD_MS = 3 * 60 * 60 * 1000;

/**
 * Floor for any reminder we schedule. A deadline closer than LAST_CHANCE_LEAD_MS
 * would otherwise be silently skipped — the exact case where a nudge matters
 * most — so it collapses to "about a minute from now" instead.
 */
const MIN_LEAD_MS = 60 * 1000;

interface ReminderData {
    kind: typeof REMINDER_TAG;
    goalId: string;
    variant: 'day-before' | 'day-of';
    // expo-notifications types `content.data` as Record<string, unknown>, so an
    // index signature is required for this to be assignable.
    [key: string]: unknown;
}

function isOurReminder(request: Notifications.NotificationRequest): boolean {
    const data = request.content.data as Partial<ReminderData> | undefined;
    return data?.kind === REMINDER_TAG;
}

/**
 * Replace all scheduled goal reminders with a fresh set derived from `reminders`.
 *
 * Cancel-then-reschedule (rather than diffing) keeps this idempotent: it can run
 * on every foreground and after every goal change without stacking duplicates.
 * Only our own reminders are cancelled, so an incoming remote push is untouched.
 */
export async function syncGoalReminders(
    reminders: GoalReminder[],
    prefs: NotificationPrefs
): Promise<number> {
    try {
        await configureNotifications();

        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        await Promise.all(
            scheduled
                .filter(isOurReminder)
                .map((request) =>
                    Notifications.cancelScheduledNotificationAsync(request.identifier).catch(() => {})
                )
        );

        if (!prefs.enabled) return 0;

        const granted = await Notifications.getPermissionsAsync();
        if (!granted.granted) return 0;

        const now = Date.now();
        let count = 0;

        for (const reminder of reminders) {
            const deadline = new Date(reminder.deadline);
            if (Number.isNaN(deadline.getTime())) continue;

            const stake = formatStake(reminder.penaltyAmount);

            if (prefs.dayBefore) {
                const at = atHourOn(addDays(deadline, -1), prefs.hour);
                if (at.getTime() > now) {
                    await schedule(at, {
                        title: `${reminder.emoji} ${reminder.goalName} is due tomorrow`,
                        body: `${reminder.groupName} — ${stake} on the line if you miss it.`,
                        goalId: reminder.goalId,
                        variant: 'day-before',
                    });
                    count++;
                }
            }

            if (prefs.dayOf) {
                const at = lastChanceAt(deadline, now);
                if (at) {
                    await schedule(at, {
                        title: `⏰ Last chance: ${reminder.goalName}`,
                        body: `Due soon in ${reminder.groupName}. ${stake} at stake.`,
                        goalId: reminder.goalId,
                        variant: 'day-of',
                    });
                    count++;
                }
            }
        }

        if (env.enableDebugLogs) {
            console.log(`[Notifications] Scheduled ${count} reminder(s) for ${reminders.length} goal(s).`);
        }

        return count;
    } catch (err) {
        console.error('[Notifications] Failed to sync reminders:', err);
        return 0;
    }
}

async function schedule(
    date: Date,
    opts: { title: string; body: string; goalId: string; variant: ReminderData['variant'] }
): Promise<void> {
    const data: ReminderData = {
        kind: REMINDER_TAG,
        goalId: opts.goalId,
        variant: opts.variant,
    };

    await Notifications.scheduleNotificationAsync({
        content: {
            title: opts.title,
            body: opts.body,
            data,
            ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNELS.reminders } : {}),
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date,
            ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNELS.reminders } : {}),
        },
    });
}

export async function cancelAllGoalReminders(): Promise<void> {
    try {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        await Promise.all(
            scheduled
                .filter(isOurReminder)
                .map((request) =>
                    Notifications.cancelScheduledNotificationAsync(request.identifier).catch(() => {})
                )
        );
    } catch (err) {
        console.error('[Notifications] Failed to cancel reminders:', err);
    }
}

// ============ Helpers ============

function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function atHourOn(date: Date, hour: number): Date {
    const next = new Date(date);
    next.setHours(clampHour(hour), 0, 0, 0);
    return next;
}

/**
 * When to fire the last-chance nudge, or null if the deadline has already passed.
 *
 * Normally LAST_CHANCE_LEAD_MS before the deadline; nudged forward to
 * `now + MIN_LEAD_MS` when that moment is already behind us but the deadline
 * itself is not, so an imminent deadline still produces exactly one reminder.
 */
function lastChanceAt(deadline: Date, now: number): Date | null {
    const deadlineMs = deadline.getTime();
    if (deadlineMs <= now) return null;

    const ideal = deadlineMs - LAST_CHANCE_LEAD_MS;
    if (ideal > now) return new Date(ideal);

    const fallback = now + MIN_LEAD_MS;
    // Don't schedule a "last chance" that would arrive after the deadline.
    return fallback < deadlineMs ? new Date(fallback) : null;
}

function formatStake(amount: number): string {
    if (!amount || amount <= 0) return 'Your streak';
    return `€${amount.toFixed(2).replace(/\.00$/, '')}`;
}
