import Constants from 'expo-constants';

import { supabase } from './supabase';
import { env } from '../config/env';

/**
 * Fire-and-forget analytics / crash event tracking.
 *
 * Inserts a row into the `app_events` table (schema lives in
 * hermes_tmp/016b_analytics.sql, applied by the owner). Tracking must never
 * break app flow: all failures are caught and ignored, and the whole call is
 * a no-op unless analytics are enabled via EXPO_PUBLIC_ENABLE_ANALYTICS.
 */
export async function track(event: string, props?: Record<string, unknown>): Promise<void> {
    if (!env.enableAnalytics) return;

    try {
        const { data: { user } } = await supabase.auth.getUser();

        await supabase.from('app_events').insert({
            event,
            props: props ?? {},
            user_id: user?.id ?? null,
            app_version: Constants.expoConfig?.version ?? null,
            created_at: new Date().toISOString(),
        });
    } catch (err) {
        if (env.enableDebugLogs) {
            console.warn(`[Analytics] Failed to track "${event}":`, err);
        }
    }
}
