-- ============================================================================
-- MIGRATION 012: Push Notifications
-- Run this AFTER 007_activity_log_and_enhancements.sql
--
-- Local deadline reminders are scheduled entirely on-device and need nothing
-- here. This migration only covers REMOTE push: storing device tokens, and an
-- outbox that group events write into so a worker can deliver them.
-- ============================================================================

-- ============================================================================
-- 1. PUSH TOKENS - one row per device
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    -- Expo push token, e.g. ExponentPushToken[xxxxxxxx]. Unique so the same
    -- device re-registering updates in place instead of accumulating rows.
    token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- A user may only ever see or touch their own tokens. Knowing another user's
-- token would let you spoof notifications at them via the Expo API.
DROP POLICY IF EXISTS "Users manage their own push tokens" ON push_tokens;
CREATE POLICY "Users manage their own push tokens" ON push_tokens
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 2. NOTIFICATION OUTBOX - what still needs delivering
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Who should receive it (not who caused it).
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

-- Partial index: the worker only ever scans pending rows.
CREATE INDEX IF NOT EXISTS idx_outbox_pending
    ON notification_outbox(created_at)
    WHERE status = 'pending';

ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;

-- Recipients may read their own notifications (useful for an in-app inbox).
-- Nobody may write from the client: rows are created by triggers, and updated
-- only by the delivery worker using the service role, which bypasses RLS.
DROP POLICY IF EXISTS "Recipients can read their notifications" ON notification_outbox;
CREATE POLICY "Recipients can read their notifications" ON notification_outbox
    FOR SELECT USING (recipient_id = auth.uid());

-- ============================================================================
-- 3. ENQUEUE HELPER
-- ============================================================================

-- Fans an event out to every member of a group except the actor.
CREATE OR REPLACE FUNCTION enqueue_group_notification(
    p_group_id UUID,
    p_actor_id UUID,
    p_event_type TEXT,
    p_title TEXT,
    p_body TEXT,
    p_data JSONB DEFAULT '{}'
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT;
BEGIN
    INSERT INTO notification_outbox (recipient_id, group_id, event_type, title, body, data)
    SELECT gm.user_id, p_group_id, p_event_type, p_title, p_body, p_data
    FROM group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id IS DISTINCT FROM p_actor_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ============================================================================
-- 4. TRIGGERS - the events worth interrupting someone for
-- ============================================================================

-- 4a. A mate logged a failure, so you are owed money.
CREATE OR REPLACE FUNCTION notify_on_failure_logged()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_name TEXT;
    v_group_name TEXT;
BEGIN
    SELECT name INTO v_actor_name FROM profiles WHERE id = NEW.from_user_id;
    SELECT name INTO v_group_name FROM groups WHERE id = NEW.group_id;

    -- transactions are written one row per creditor, so notify the creditor
    -- directly rather than fanning out to the whole group.
    INSERT INTO notification_outbox (recipient_id, group_id, event_type, title, body, data)
    VALUES (
        NEW.to_user_id,
        NEW.group_id,
        'failure_logged',
        format('%s slipped up', COALESCE(v_actor_name, 'Someone')),
        format('You are owed EUR %s in %s.', to_char(NEW.amount, 'FM999999990.00'), COALESCE(v_group_name, 'your group')),
        jsonb_build_object('groupId', NEW.group_id, 'transactionId', NEW.id)
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_failure_logged ON transactions;
CREATE TRIGGER trg_notify_on_failure_logged
    AFTER INSERT ON transactions
    FOR EACH ROW
    WHEN (NEW.to_user_id IS DISTINCT FROM NEW.from_user_id)
    EXECUTE FUNCTION notify_on_failure_logged();

-- 4b. Someone in the group completed a goal — social proof, keeps groups warm.
CREATE OR REPLACE FUNCTION notify_on_goal_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_name TEXT;
    v_goal_name TEXT;
    v_goal_emoji TEXT;
    v_group_id UUID;
BEGIN
    SELECT name INTO v_actor_name FROM profiles WHERE id = NEW.user_id;
    SELECT name, emoji, group_id INTO v_goal_name, v_goal_emoji, v_group_id
    FROM goals WHERE id = NEW.goal_id;

    IF v_group_id IS NULL THEN
        RETURN NEW;
    END IF;

    PERFORM enqueue_group_notification(
        v_group_id,
        NEW.user_id,
        'goal_completed',
        format('%s %s done it', COALESCE(v_goal_emoji, ''), COALESCE(v_actor_name, 'Someone')),
        format('%s was just completed. Your turn.', COALESCE(v_goal_name, 'A goal')),
        jsonb_build_object('groupId', v_group_id, 'goalId', NEW.goal_id)
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_goal_completed ON goal_completions;
CREATE TRIGGER trg_notify_on_goal_completed
    AFTER INSERT ON goal_completions
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_goal_completed();

-- 4c. A new member joined.
CREATE OR REPLACE FUNCTION notify_on_member_joined()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_name TEXT;
    v_group_name TEXT;
BEGIN
    SELECT name INTO v_actor_name FROM profiles WHERE id = NEW.user_id;
    SELECT name INTO v_group_name FROM groups WHERE id = NEW.group_id;

    PERFORM enqueue_group_notification(
        NEW.group_id,
        NEW.user_id,
        'member_joined',
        format('%s joined %s', COALESCE(v_actor_name, 'Someone'), COALESCE(v_group_name, 'the group')),
        'Say hello and set them a goal.',
        jsonb_build_object('groupId', NEW.group_id)
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_member_joined ON group_members;
CREATE TRIGGER trg_notify_on_member_joined
    AFTER INSERT ON group_members
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_member_joined();

-- ============================================================================
-- 5. HOUSEKEEPING
-- ============================================================================

-- Delivered notifications older than 30 days are dead weight. Call from the
-- delivery worker; there is no pg_cron on the free tier.
CREATE OR REPLACE FUNCTION prune_notification_outbox()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT;
BEGIN
    DELETE FROM notification_outbox
    WHERE status IN ('sent', 'failed')
      AND created_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ============================================================================
-- DONE
-- ============================================================================
