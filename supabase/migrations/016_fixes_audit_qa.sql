-- ============================================================================
-- MIGRATION 016: Audit + QA fixes (timezone bucketing, stats membership
-- checks, streak trigger fix)
--
-- Run this on EXISTING databases only — fresh databases get everything from
-- supabase/bootstrap.sql (which includes this file via scripts/build_bootstrap_sql.py).
--
-- What it does:
--   1. get_goal_weekly_stats / get_goal_performance now accept
--      p_tz_offset_minutes (the caller's UTC offset, e.g. -360 for Mexico
--      City) and bucket completions on the CLIENT's local calendar day
--      instead of the DB's UTC date (M4). Both also gained a membership
--      check: as SECURITY DEFINER functions they previously let ANY
--      authenticated user read any goal's stats cross-group (M5).
--   2. update_goal_streak now only advances the streak on the FIRST
--      completion of a calendar day. Same-day duplicates (the 1-tap
--      complete button and the photo-proof path both insert a completion
--      row) used to add one phantom streak day each, inflating current AND
--      longest streaks — live-confirmed as 'Best streak: 8' on a goal with a
--      real 5-day streak. The trigger now passes the new row's id so the
--      dedupe check can exclude the row that fired it.
--
-- NOTE: existing rows already inflated by the buggy trigger are NOT
-- rewritten here — recomputing historical streaks from raw completions is a
-- data migration of its own; the trigger fix stops new inflation.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Streak trigger fix
-- ---------------------------------------------------------------------------

-- Drop the pre-fix overloads (a bare uuid / uuid,uuid signature from the old
-- definitions would otherwise remain callable and skip the new guards).
DROP FUNCTION IF EXISTS public.update_goal_streak(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_goal_weekly_stats(uuid);
DROP FUNCTION IF EXISTS public.get_goal_performance(uuid);

CREATE OR REPLACE FUNCTION public.update_goal_streak(
    p_goal_id UUID,
    p_user_id UUID,
    p_completion_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_goal RECORD;
    v_last_completion TIMESTAMPTZ;
    v_streak_continued BOOLEAN;
    v_new_streak INTEGER;
    v_result JSONB;
    v_already_today BOOLEAN;
BEGIN
    -- Get goal details
    SELECT * INTO v_goal FROM goals WHERE id = p_goal_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Goal not found');
    END IF;

    -- Only the FIRST completion of a calendar day may advance the streak.
    SELECT EXISTS (
        SELECT 1 FROM goal_completions
        WHERE goal_id = p_goal_id
          AND user_id = p_user_id
          AND completed_at >= CURRENT_DATE
          AND (p_completion_id IS NULL OR id != p_completion_id)
    ) INTO v_already_today;

    IF v_already_today THEN
        -- Same-day duplicate: streak stays where it is.
        v_new_streak := GREATEST(COALESCE(v_goal.current_streak, 0), 1);
        v_streak_continued := true;
    ELSE
        -- Get last completion before today
        SELECT completed_at INTO v_last_completion
        FROM goal_completions
        WHERE goal_id = p_goal_id
          AND user_id = p_user_id
          AND completed_at < CURRENT_DATE
        ORDER BY completed_at DESC
        LIMIT 1;

        -- Determine if streak continues
        IF v_last_completion IS NULL THEN
            -- First completion ever
            v_new_streak := 1;
            v_streak_continued := false;
        ELSIF (CURRENT_DATE - v_last_completion::DATE) <= v_goal.frequency_days THEN
            -- Streak continues
            v_new_streak := COALESCE(v_goal.current_streak, 0) + 1;
            v_streak_continued := true;
        ELSE
            -- Streak broken, starting fresh
            v_new_streak := 1;
            v_streak_continued := false;
        END IF;
    END IF;

    -- Update goal with new streak
    UPDATE goals
    SET
        current_streak = v_new_streak,
        longest_streak = GREATEST(COALESCE(longest_streak, 0), v_new_streak),
        consecutive_failures = 0, -- Reset failures on success
        updated_at = NOW()
    WHERE id = p_goal_id;

    -- Log streak achievement if milestone reached
    IF v_new_streak IN (7, 30, 100, 365) THEN
        PERFORM log_activity(
            v_goal.group_id,
            p_user_id,
            'streak_achieved',
            p_goal_id,
            'goal',
            jsonb_build_object('streak_days', v_new_streak, 'goal_name', v_goal.name)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'new_streak', v_new_streak,
        'longest_streak', GREATEST(COALESCE(v_goal.longest_streak, 0), v_new_streak),
        'streak_continued', v_streak_continued
    );
END;
$$;

-- The completion trigger must pass the new row's id, otherwise the dedupe
-- check above would see the trigger's own row and NEVER advance the streak.
CREATE OR REPLACE FUNCTION public.log_completion_activity() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_goal RECORD;
BEGIN
    SELECT * INTO v_goal FROM goals WHERE id = NEW.goal_id;

    PERFORM log_activity(
        v_goal.group_id,
        NEW.user_id,
        'goal_completed',
        NEW.id,
        'completion',
        jsonb_build_object(
            'goal_name', v_goal.name,
            'goal_emoji', v_goal.emoji,
            'has_proof', NEW.proof_photo_url IS NOT NULL
        )
    );

    -- Update streak (pass the new row's id so same-day duplicate
    -- completions don't each advance the streak)
    PERFORM update_goal_streak(NEW.goal_id, NEW.user_id, NEW.id);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_completion ON goal_completions;
CREATE TRIGGER trigger_log_completion
    AFTER INSERT ON goal_completions
    FOR EACH ROW
    EXECUTE FUNCTION public.log_completion_activity();

-- ---------------------------------------------------------------------------
-- 2. Weekly stats + performance: timezone-aware bucketing + membership checks
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_goal_weekly_stats(
    p_goal_id UUID,
    p_tz_offset_minutes INTEGER DEFAULT 0
)
RETURNS TABLE (
    user_id UUID,
    user_name TEXT,
    day_date DATE,
    completion_count INTEGER,
    has_photo BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today_local DATE;
    v_group_id UUID;
BEGIN
    -- M5: SECURITY DEFINER must not let non-members read another group's
    -- goal stats.
    SELECT g.group_id INTO v_group_id FROM goals g WHERE g.id = p_goal_id;
    IF v_group_id IS NULL THEN
        RETURN;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM group_members gm
        WHERE gm.group_id = v_group_id AND gm.user_id = auth.uid()
    ) THEN
        RETURN;
    END IF;

    -- M4: "today" in the caller's local timezone.
    v_today_local := (now() AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE;

    RETURN QUERY
    SELECT
        gc.user_id,
        p.name as user_name,
        (gc.completed_at AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE as day_date,
        COALESCE(SUM(gc.occurrence_count)::INTEGER, 0) as completion_count,
        BOOL_OR(gc.proof_photo_url IS NOT NULL) as has_photo
    FROM goal_completions gc
    JOIN profiles p ON p.id = gc.user_id
    WHERE gc.goal_id = p_goal_id
    AND (gc.completed_at AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE >= v_today_local - INTERVAL '6 days'
    GROUP BY gc.user_id, p.name, (gc.completed_at AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE
    ORDER BY (gc.completed_at AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_goal_performance(
    p_goal_id UUID,
    p_tz_offset_minutes INTEGER DEFAULT 0
)
RETURNS TABLE (
    user_id UUID,
    user_name TEXT,
    completions_this_week INTEGER,
    target_completions INTEGER,
    percentage NUMERIC,
    is_on_track BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_goal RECORD;
    v_week_start DATE;
BEGIN
    -- Get goal details
    SELECT * INTO v_goal FROM goals WHERE id = p_goal_id;

    IF v_goal IS NULL THEN
        RETURN;
    END IF;

    -- M5: SECURITY DEFINER must not leak other groups' stats to non-members.
    IF NOT EXISTS (
        SELECT 1 FROM group_members gm
        WHERE gm.group_id = v_goal.group_id AND gm.user_id = auth.uid()
    ) THEN
        RETURN;
    END IF;

    -- M4: start of the caller's local week (Monday), not the DB's UTC Monday.
    v_week_start := date_trunc(
        'week',
        now() AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes)
    )::DATE;

    -- Calculate target based on goal type
    -- If target_per_week is set, use it; otherwise calculate from frequency_days

    RETURN QUERY
    SELECT
        gm.user_id,
        p.name as user_name,
        COALESCE((
            SELECT SUM(gc.occurrence_count)::INTEGER
            FROM goal_completions gc
            WHERE gc.goal_id = p_goal_id
            AND gc.user_id = gm.user_id
            AND (gc.completed_at AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE >= v_week_start
        ), 0) as completions_this_week,
        COALESCE(v_goal.target_per_week, GREATEST(7 / v_goal.frequency_days, 1))::INTEGER as target_completions,
        CASE
            WHEN COALESCE(v_goal.target_per_week, GREATEST(7 / v_goal.frequency_days, 1)) = 0 THEN 0
            ELSE LEAST(100, ROUND(
                COALESCE((
                    SELECT SUM(gc.occurrence_count)
                    FROM goal_completions gc
                    WHERE gc.goal_id = p_goal_id
                    AND gc.user_id = gm.user_id
                    AND (gc.completed_at AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE >= v_week_start
                ), 0)::NUMERIC /
                COALESCE(v_goal.target_per_week, GREATEST(7 / v_goal.frequency_days, 1))::NUMERIC * 100
            , 0))
        END as percentage,
        COALESCE((
            SELECT SUM(gc.occurrence_count)
            FROM goal_completions gc
            WHERE gc.goal_id = p_goal_id
            AND gc.user_id = gm.user_id
            AND (gc.completed_at AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE >= v_week_start
        ), 0) >= COALESCE(v_goal.target_per_week, GREATEST(7 / v_goal.frequency_days, 1)) as is_on_track
    FROM group_members gm
    JOIN profiles p ON p.id = gm.user_id
    WHERE gm.group_id = v_goal.group_id
    ORDER BY percentage DESC;
END;
$$;
