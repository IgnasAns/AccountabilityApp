/**
 * send-push — drains the notification outbox to Expo's push service.
 *
 * Deploy:  npx supabase functions deploy send-push
 * Invoke:  POST /functions/v1/send-push   (Authorization: Bearer <anon or service key>)
 *
 * There is no pg_cron on the Supabase free tier, so this is designed to be
 * poked from outside — a GitHub Action on a schedule, an uptime pinger, or the
 * Windows Task Scheduler. It is idempotent: only 'pending' rows are claimed,
 * and each row is marked before the response is returned.
 *
 * Local deadline reminders do NOT go through here — they are scheduled
 * on-device and keep working even if this function is never deployed.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Expo accepts up to 100 messages per request. */
const EXPO_BATCH_SIZE = 100;

/** Cap work per invocation so a backlog can't blow the function timeout. */
const MAX_ROWS_PER_RUN = 500;

/** Give up on a row after this many failed attempts. */
const MAX_ATTEMPTS = 3;

interface OutboxRow {
    id: string;
    recipient_id: string;
    group_id: string | null;
    event_type: string;
    title: string;
    body: string;
    data: Record<string, unknown> | null;
    attempts: number;
}

interface ExpoTicket {
    status: 'ok' | 'error';
    id?: string;
    message?: string;
    details?: { error?: string };
}

Deno.serve(async (req: Request) => {
    if (req.method !== 'POST') {
        return json({ error: 'Method not allowed' }, 405);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
        return json({ error: 'Function is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }, 500);
    }

    // Service role: the worker must read every recipient's tokens, which RLS
    // deliberately forbids for normal users.
    const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
    });

    const { data: pending, error: fetchError } = await supabase
        .from('notification_outbox')
        .select('id, recipient_id, group_id, event_type, title, body, data, attempts')
        .eq('status', 'pending')
        .lt('attempts', MAX_ATTEMPTS)
        .order('created_at', { ascending: true })
        .limit(MAX_ROWS_PER_RUN);

    if (fetchError) {
        return json({ error: `Failed to read outbox: ${fetchError.message}` }, 500);
    }

    const rows = (pending ?? []) as OutboxRow[];
    if (rows.length === 0) {
        return json({ processed: 0, sent: 0, failed: 0, message: 'Nothing pending.' });
    }

    // One token lookup for every recipient in this batch.
    const recipientIds = [...new Set(rows.map((r) => r.recipient_id))];
    const { data: tokenRows, error: tokenError } = await supabase
        .from('push_tokens')
        .select('user_id, token')
        .in('user_id', recipientIds);

    if (tokenError) {
        return json({ error: `Failed to read push tokens: ${tokenError.message}` }, 500);
    }

    const tokensByUser = new Map<string, string[]>();
    for (const row of (tokenRows ?? []) as { user_id: string; token: string }[]) {
        const list = tokensByUser.get(row.user_id) ?? [];
        list.push(row.token);
        tokensByUser.set(row.user_id, list);
    }

    // Build the message list, remembering which outbox row each message came
    // from so tickets can be attributed back.
    const messages: Record<string, unknown>[] = [];
    const messageOwner: string[] = [];
    const tokenForMessage: string[] = [];
    const noTokenRowIds: string[] = [];

    for (const row of rows) {
        const tokens = tokensByUser.get(row.recipient_id) ?? [];
        if (tokens.length === 0) {
            // Recipient has no registered device. Not an error worth retrying.
            noTokenRowIds.push(row.id);
            continue;
        }

        for (const token of tokens) {
            messages.push({
                to: token,
                title: row.title,
                body: row.body,
                sound: 'default',
                channelId: 'group-activity',
                priority: 'default',
                data: { ...(row.data ?? {}), eventType: row.event_type, groupId: row.group_id },
            });
            messageOwner.push(row.id);
            tokenForMessage.push(token);
        }
    }

    if (noTokenRowIds.length > 0) {
        await supabase
            .from('notification_outbox')
            .update({ status: 'failed', last_error: 'No registered device for recipient' })
            .in('id', noTokenRowIds);
    }

    const failedRowIds = new Set<string>();
    const rowErrors = new Map<string, string>();
    const deadTokens = new Set<string>();
    let ticketIndex = 0;

    for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
        const batch = messages.slice(i, i + EXPO_BATCH_SIZE);

        try {
            const response = await fetch(EXPO_PUSH_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'Accept-Encoding': 'gzip, deflate',
                },
                body: JSON.stringify(batch),
            });

            if (!response.ok) {
                const text = await response.text();
                for (let k = 0; k < batch.length; k++) {
                    const rowId = messageOwner[ticketIndex + k];
                    failedRowIds.add(rowId);
                    rowErrors.set(rowId, `Expo HTTP ${response.status}: ${text.slice(0, 200)}`);
                }
                ticketIndex += batch.length;
                continue;
            }

            const payload = (await response.json()) as { data?: ExpoTicket[] };
            const tickets = payload.data ?? [];

            for (let k = 0; k < batch.length; k++) {
                const rowId = messageOwner[ticketIndex + k];
                const ticket = tickets[k];

                if (!ticket || ticket.status === 'error') {
                    failedRowIds.add(rowId);
                    rowErrors.set(rowId, ticket?.message ?? 'No ticket returned by Expo');

                    // A token Expo rejects as unregistered will never work again.
                    if (ticket?.details?.error === 'DeviceNotRegistered') {
                        deadTokens.add(tokenForMessage[ticketIndex + k]);
                    }
                }
            }

            ticketIndex += batch.length;
        } catch (err) {
            for (let k = 0; k < batch.length; k++) {
                const rowId = messageOwner[ticketIndex + k];
                failedRowIds.add(rowId);
                rowErrors.set(rowId, err instanceof Error ? err.message : 'Network error');
            }
            ticketIndex += batch.length;
        }
    }

    // Clean up tokens for uninstalled apps so we stop paying for them.
    if (deadTokens.size > 0) {
        await supabase.from('push_tokens').delete().in('token', [...deadTokens]);
    }

    const attemptedRowIds = [...new Set(messageOwner)];
    const sentRowIds = attemptedRowIds.filter((id) => !failedRowIds.has(id));

    if (sentRowIds.length > 0) {
        await supabase
            .from('notification_outbox')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .in('id', sentRowIds);
    }

    // Bump attempts rather than failing outright, so transient errors retry
    // until MAX_ATTEMPTS and then stop on their own.
    for (const rowId of failedRowIds) {
        const row = rows.find((r) => r.id === rowId);
        const attempts = (row?.attempts ?? 0) + 1;
        await supabase
            .from('notification_outbox')
            .update({
                status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
                attempts,
                last_error: rowErrors.get(rowId)?.slice(0, 500) ?? 'Unknown error',
            })
            .eq('id', rowId);
    }

    await supabase.rpc('prune_notification_outbox').catch(() => {
        // Housekeeping is best-effort.
    });

    return json({
        processed: rows.length,
        sent: sentRowIds.length,
        failed: failedRowIds.size + noTokenRowIds.length,
        deadTokensRemoved: deadTokens.size,
    });
});

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}
