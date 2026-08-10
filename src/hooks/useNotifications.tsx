/**
 * useNotifications
 *
 * Mounted once, inside the auth provider. Owns the whole notification
 * lifecycle so no screen has to think about it:
 *
 *  - configures channels + the foreground handler on mount
 *  - asks for permission once the user is actually signed in (never on the
 *    login screen — asking before the user has anything to be reminded about
 *    is how you get a permanent denial)
 *  - registers/removes the remote push token alongside the session
 *  - recomputes and reschedules local deadline reminders on sign-in, on app
 *    foreground, and whenever a goal changes
 *
 * Deadline maths deliberately mirrors `useGoals.getGoalStatus` so the reminder
 * a user gets and the countdown they see on the card can never disagree.
 */

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../services/supabase';
import { navigationRef } from '../services/navigationRef';
import { useAuth } from './useAuth';
import { StyledAlert } from '../components/StyledAlert';
import {
    DEFAULT_PREFS,
    GoalReminder,
    NotificationPrefs,
    cancelAllGoalReminders,
    configureNotifications,
    ensurePermissions,
    loadPrefs,
    registerPushToken,
    savePrefs,
    syncGoalReminders,
} from '../services/notifications';

interface NotificationContextType {
    prefs: NotificationPrefs;
    /** Number of reminders currently scheduled — surfaced in settings. */
    scheduledCount: number;
    permissionGranted: boolean;
    updatePrefs: (updates: Partial<NotificationPrefs>) => Promise<void>;
    /** Recompute deadlines and reschedule. Call after creating/completing a goal. */
    refreshReminders: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
    prefs: DEFAULT_PREFS,
    scheduledCount: 0,
    permissionGranted: false,
    updatePrefs: async () => {},
    refreshReminders: async () => {},
});

/** Shape returned by the reminder query — only the columns we need. */
interface ReminderRow {
    id: string;
    name: string;
    emoji: string;
    frequency_days: number;
    penalty_amount: number;
    goal_mode: 'positive' | 'negative';
    is_paused: boolean;
    paused_until: string | null;
    groups: { name: string } | null;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { user, isGuest } = useAuth();
    const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
    const [scheduledCount, setScheduledCount] = useState(0);
    const [permissionGranted, setPermissionGranted] = useState(false);

    // Avoids overlapping syncs when foreground + goal-change fire together.
    const syncing = useRef(false);
    const prefsRef = useRef(prefs);
    prefsRef.current = prefs;

    // ---- Load persisted prefs + configure channels once ----
    useEffect(() => {
        let cancelled = false;

        (async () => {
            await configureNotifications();
            const stored = await loadPrefs();
            if (!cancelled) setPrefs(stored);
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    /**
     * Build the reminder list for the signed-in user.
     *
     * A goal only earns a reminder when the user is a member of its group, it is
     * active and unpaused, and it is a "positive" goal — negative (habit-breaking)
     * goals have no deadline to miss, so reminding about them is just noise.
     */
    const buildReminders = useCallback(async (userId: string): Promise<GoalReminder[]> => {
        const { data: memberships, error: membershipError } = await supabase
            .from('group_members')
            .select('group_id')
            .eq('user_id', userId);

        if (membershipError) throw membershipError;

        const groupIds = (memberships || []).map((m: { group_id: string }) => m.group_id);
        if (groupIds.length === 0) return [];

        const { data: goals, error: goalsError } = await supabase
            .from('goals')
            .select('id, name, emoji, frequency_days, penalty_amount, goal_mode, is_paused, paused_until, groups(name)')
            .in('group_id', groupIds)
            .eq('is_active', true)
            .eq('goal_mode', 'positive');

        if (goalsError) throw goalsError;

        const rows = (goals || []) as unknown as ReminderRow[];
        const activeRows = rows.filter((row) => !isPaused(row));
        if (activeRows.length === 0) return [];

        // One query for this user's latest completion per goal, rather than N.
        const { data: completions, error: completionsError } = await supabase
            .from('goal_completions')
            .select('goal_id, completed_at')
            .eq('user_id', userId)
            .in('goal_id', activeRows.map((row) => row.id))
            .order('completed_at', { ascending: false });

        if (completionsError) throw completionsError;

        const lastCompletion = new Map<string, string>();
        for (const row of (completions || []) as { goal_id: string; completed_at: string }[]) {
            // Ordered newest-first, so the first hit per goal is the latest.
            if (!lastCompletion.has(row.goal_id)) {
                lastCompletion.set(row.goal_id, row.completed_at);
            }
        }

        return activeRows.map((row) => {
            const last = lastCompletion.get(row.id);
            // Mirrors useGoals.getGoalStatus: deadline runs from the last
            // completion, or from now as a grace period if there is none yet.
            const deadline = new Date(last ?? new Date().toISOString());
            deadline.setDate(deadline.getDate() + row.frequency_days);

            return {
                goalId: row.id,
                goalName: row.name,
                emoji: row.emoji || '🎯',
                groupName: row.groups?.name || 'Your group',
                penaltyAmount: row.penalty_amount,
                deadline: deadline.toISOString(),
            };
        });
    }, []);

    const refreshReminders = useCallback(async () => {
        if (!user || syncing.current) return;

        syncing.current = true;
        try {
            const reminders = await buildReminders(user.id);
            const count = await syncGoalReminders(reminders, prefsRef.current);
            setScheduledCount(count);
        } catch (err) {
            // Never surface this: reminders failing must not block the UI.
            console.error('[Notifications] Reminder refresh failed:', err);
        } finally {
            syncing.current = false;
        }
    }, [user, buildReminders]);

    // ---- Session-driven setup / teardown ----
    useEffect(() => {
        if (!user) {
            setPermissionGranted(false);
            setScheduledCount(0);
            cancelAllGoalReminders();
            return;
        }

        let cancelled = false;

        (async () => {
            // First sign-in on this install: explain WHY the app wants
            // notification permission before the OS prompt fires. If the user
            // declines the explainer, skip the system prompt entirely — the
            // permission can still be granted later from notification settings.
            if (await shouldShowExplainer()) {
                await markExplainerShown();
                const optedIn = await promptExplainer();
                if (!optedIn) {
                    if (!cancelled) setPermissionGranted(false);
                    return;
                }
            }

            if (cancelled) return;
            const granted = await ensurePermissions();
            if (cancelled) return;
            setPermissionGranted(granted);
            if (!granted) return;

            // Guests are ephemeral — no point storing a push token for them.
            if (!isGuest) {
                await registerPushToken(user.id);
            }
            if (!cancelled) await refreshReminders();
        })();

        return () => {
            cancelled = true;
        };
    }, [user, isGuest, refreshReminders]);

    // ---- Reschedule when the app comes back to the foreground ----
    useEffect(() => {
        if (!user) return;

        const handler = (state: AppStateStatus) => {
            if (state === 'active') {
                refreshReminders();
            }
        };

        const subscription = AppState.addEventListener('change', handler);
        return () => subscription.remove();
    }, [user, refreshReminders]);

    // ---- Tap a notification → jump into the group it came from ----
    // Remote push notifications carry data.groupId (see send-push edge
    // function / 012_push_notifications.sql); local reminders carry goalId
    // but no groupId, so they are ignored here.
    useEffect(() => {
        const subscription = Notifications.addNotificationResponseReceivedListener(
            (response) => {
                const data = response.notification.request.content.data as
                    | Record<string, unknown>
                    | undefined;
                const groupId = data?.groupId;

                if (typeof groupId !== 'string' || !groupId) return;

                if (navigationRef.isReady()) {
                    navigationRef.navigate('GroupDetail', { groupId });
                }
            }
        );

        return () => subscription.remove();
    }, []);

    // ---- Reschedule when goals or completions change anywhere ----
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel('goal-reminders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, () => {
                refreshReminders();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'goal_completions' }, () => {
                refreshReminders();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, refreshReminders]);

    const updatePrefs = useCallback(
        async (updates: Partial<NotificationPrefs>) => {
            const next = { ...prefsRef.current, ...updates };
            prefsRef.current = next;
            setPrefs(next);
            await savePrefs(next);

            if (next.enabled) {
                const granted = await ensurePermissions();
                setPermissionGranted(granted);
            }

            await refreshReminders();
        },
        [refreshReminders]
    );

    return (
        <NotificationContext.Provider
            value={{ prefs, scheduledCount, permissionGranted, updatePrefs, refreshReminders }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

export const useNotifications = () => useContext(NotificationContext);

// ---- First-run permission explainer (UX audit #8) ----
//
// The OS permission prompt is the wrong first touch: a user who has just
// signed in and has no idea the app will text them is likely to tap "don't
// allow" forever. Show a one-line explainer (via the app's own StyledAlert,
// which never triggers the OS dialog) BEFORE the system prompt fires, and
// only fire the system prompt if the user opts in. Shown once per install.

const EXPLAINER_KEY = '@doitmate/notif_explainer_shown';

async function shouldShowExplainer(): Promise<boolean> {
    try {
        return (await AsyncStorage.getItem(EXPLAINER_KEY)) !== 'true';
    } catch {
        return true;
    }
}

async function markExplainerShown(): Promise<void> {
    try {
        await AsyncStorage.setItem(EXPLAINER_KEY, 'true');
    } catch {
        // Non-fatal: worst case the explainer shows again next launch.
    }
}

/** Resolves true when the user opts in, false when they decline. */
function promptExplainer(): Promise<boolean> {
    return new Promise((resolve) => {
        StyledAlert.alert(
            'Enable reminders?',
            "We'll nudge you before a deadline so you don't get fined in your sleep — enable notifications?",
            [
                { text: 'Enable', onPress: () => resolve(true) },
                { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
            ]
        );
    });
}

function isPaused(row: ReminderRow): boolean {
    if (!row.is_paused) return false;
    // A pause with an elapsed end date is no longer a pause.
    if (row.paused_until && new Date(row.paused_until) < new Date()) return false;
    return true;
}
