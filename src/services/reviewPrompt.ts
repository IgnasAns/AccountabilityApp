/**
 * In-app review prompt.
 *
 * The listing shows no star rating at all, which is one of only three things
 * visible in a Play search row (icon, title, rating). Rows without stars get
 * skipped, and no amount of ASO fixes that — it needs actual reviews.
 *
 * Google's In-App Review API is quota-limited and silently ignores requests it
 * considers too frequent, so a prompt fired at the wrong moment is wasted
 * rather than merely annoying. Rules here:
 *
 *   - only after a genuine success (a completion, ideally a streak milestone)
 *   - never on a failure, a penalty, or an error
 *   - never before the user has completed a few goals — a first-day prompt
 *     produces either nothing or a 1-star
 *   - at most once per release, and not within 60 days of the last ask
 */

import { Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import { env } from '../config/env';

const STATE_KEY = '@doitmate/review_prompt';

/** Don't ask until the user has this many completions behind them. */
const MIN_COMPLETIONS = 5;

/** Minimum gap between asks, in days. */
const MIN_DAYS_BETWEEN_ASKS = 60;

interface ReviewState {
    /** ISO timestamp of the last time we asked. */
    lastAskedAt?: string;
    /** App version we last asked on, so a new release may ask again. */
    lastAskedVersion?: string;
    /** Set once the user actually acts, so we stop asking for good. */
    completed?: boolean;
}

async function loadState(): Promise<ReviewState> {
    try {
        const raw = await AsyncStorage.getItem(STATE_KEY);
        return raw ? (JSON.parse(raw) as ReviewState) : {};
    } catch {
        return {};
    }
}

async function saveState(state: ReviewState): Promise<void> {
    try {
        await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (err) {
        console.error('[Review] Failed to persist state:', err);
    }
}

function currentVersion(): string {
    return Constants.expoConfig?.version ?? 'unknown';
}

function daysSince(iso: string): number {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
    return (Date.now() - then) / (1000 * 60 * 60 * 24);
}

export interface ReviewTrigger {
    /** Total completions this user has logged, across all groups. */
    totalCompletions: number;
    /** Current streak, if the trigger was a streak milestone. */
    streak?: number;
}

/**
 * Ask for a review if this is a good moment. Safe to call on every completion —
 * it decides for itself and does nothing the vast majority of the time.
 *
 * Returns true only when a prompt was actually requested.
 */
export async function maybeRequestReview(trigger: ReviewTrigger): Promise<boolean> {
    // Web has no store review; iOS/Android both do.
    if (Platform.OS === 'web') return false;

    if (trigger.totalCompletions < MIN_COMPLETIONS) return false;

    const state = await loadState();
    if (state.completed) return false;

    if (state.lastAskedAt && daysSince(state.lastAskedAt) < MIN_DAYS_BETWEEN_ASKS) {
        return false;
    }

    // Allow one fresh ask per released version, but still respect the day gap.
    if (state.lastAskedVersion === currentVersion() && state.lastAskedAt) {
        return false;
    }

    try {
        // isAvailableAsync() is false on emulators without Play Store, and
        // hasAction() reports whether the platform will actually show anything.
        const available = await StoreReview.isAvailableAsync();
        if (!available) return false;

        const hasAction = await StoreReview.hasAction();
        if (!hasAction) return false;

        await StoreReview.requestReview();

        await saveState({
            ...state,
            lastAskedAt: new Date().toISOString(),
            lastAskedVersion: currentVersion(),
        });

        if (env.enableDebugLogs) {
            console.log('[Review] Prompt requested', trigger);
        }
        return true;
    } catch (err) {
        // Never surface this — a failed review prompt is not the user's problem.
        console.error('[Review] Prompt failed:', err);
        return false;
    }
}

/** Stop asking permanently (e.g. if a "leave a review" menu item is used). */
export async function markReviewCompleted(): Promise<void> {
    const state = await loadState();
    await saveState({ ...state, completed: true });
}
