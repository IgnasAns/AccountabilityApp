-- ============================================================================
-- MIGRATION 018: Freemium monetization layer
--
-- Google Play subscriptions via react-native-iap. The free tier keeps the
-- entire social core (goals, streaks, penalties, leaderboard, chat, invites,
-- public challenges) — the ONLY hard limit is group creation: a free account
-- may create ONE user-created group. Premium removes that cap and adds a
-- visual crown/badge (status only — no mechanic is locked behind it).
--
-- What it adds:
--   1. profiles.premium_until / premium_plan — entitlement state.
--   2. set_premium() — SECURITY DEFINER RPC. Maps a Google Play product id to
--      a plan + duration (monthly=1 month, yearly=12), then EXTENDS the user's
--      entitlement from max(premium_until, now()) so renewals and upgrades
--      stack instead of being overwritten. Purchase tokens are accepted but
--      NOT stored (kept client-side only for now); server-side receipt
--      verification is a later hardening step.
--   3. enforce_free_tier_group_limit() — BEFORE INSERT trigger on groups.
--      Free users get exactly one user-created group. Groups whose
--      invite_code starts with 'CH' are public-challenge groups (created via
--      join_public_challenge with a deterministic slug-derived code) and are
--      exempt — joining a challenge never hits the cap. The trigger keys on
--      auth.uid() so it follows whichever user performed the insert (client
--      insert or SECURITY DEFINER RPC); service_role / internal inserts
--      (no auth.uid()) are allowed through.
--   4. get_group_leaderboard() re-created with profiles.premium_until so the
--      leaderboard can show the 👑 premium badge next to members (the old
--      signature is dropped first — CREATE OR REPLACE cannot change a
--      function's return columns).
-- ============================================================================

-- 1. PROFILES: entitlement columns
-- ----------------------------------------------------------------------------

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS premium_until timestamptz NULL,
    ADD COLUMN IF NOT EXISTS premium_plan text NULL;

-- 2. set_premium RPC (SECURITY DEFINER, stacking renewals)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_premium(p_product_id text, p_purchase_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_plan text;
    v_months integer;
    v_new_until timestamptz;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Map Google Play product id -> plan duration. Unknown products are
    -- rejected so a bogus sku can never mint entitlement.
    CASE lower(p_product_id)
        WHEN 'doitmate_premium_monthly' THEN v_plan := 'monthly'; v_months := 1;
        WHEN 'doitmate_premium_yearly'  THEN v_plan := 'yearly';  v_months := 12;
        ELSE
            RETURN json_build_object(
                'success', false,
                'error', 'Unknown product: ' || coalesce(p_product_id, 'null')
            );
    END CASE;

    -- Stack renewals: extend from max(current entitlement, now) so a renewal
    -- or an upgrade adds on top instead of resetting the clock. p_purchase_token
    -- is intentionally not persisted yet — receipts stay client-side until a
    -- server-side verification endpoint exists.
    UPDATE public.profiles
    SET premium_until = GREATEST(COALESCE(premium_until, now()), now())
                            + make_interval(months => v_months),
        premium_plan   = v_plan,
        updated_at     = now()
    WHERE id = v_user_id
    RETURNING premium_until INTO v_new_until;

    IF v_new_until IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Profile not found');
    END IF;

    RETURN json_build_object(
        'success', true,
        'premium_until', v_new_until,
        'plan', v_plan
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.set_premium(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_premium(text, text) TO authenticated, service_role;

-- 3. FREE-TIER GROUP CAP TRIGGER
-- ----------------------------------------------------------------------------
-- Fires BEFORE INSERT on groups. Public-challenge groups carry the
-- deterministic 'CH...' invite code (see join_public_challenge) and are
-- exempt. Everyone else: if the caller has no active premium entitlement and
-- already created >= 1 user-created group, the insert is rejected with
-- FREE_TIER_GROUP_LIMIT (the client maps that to the paywall).

CREATE OR REPLACE FUNCTION public.enforce_free_tier_group_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_is_premium boolean;
    v_user_group_count bigint;
BEGIN
    -- Exempt public-challenge groups (invite_code is set by the caller and
    -- starts with 'CH'; user-created groups get a 64-hex digest default).
    IF NEW.invite_code IS NOT NULL AND NEW.invite_code LIKE 'CH%' THEN
        RETURN NEW;
    END IF;

    -- Internal / service_role inserts carry no auth.uid() — always allow.
    IF v_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT (premium_until IS NOT NULL AND premium_until > now())
    INTO v_is_premium
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_is_premium THEN
        RETURN NEW;
    END IF;

    SELECT count(*)
    INTO v_user_group_count
    FROM public.groups
    WHERE created_by = v_user_id
      AND (invite_code IS NULL OR invite_code NOT LIKE 'CH%');

    IF v_user_group_count >= 1 THEN
        RAISE EXCEPTION 'FREE_TIER_GROUP_LIMIT'
            USING HINT = 'Free accounts can create one group. Upgrade to Premium for unlimited groups.';
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_free_tier_group_limit ON public.groups;
CREATE TRIGGER enforce_free_tier_group_limit
    BEFORE INSERT ON public.groups
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_free_tier_group_limit();

-- 4. LEADERBOARD: expose premium_until for the 👑 badge
-- ----------------------------------------------------------------------------
-- The original get_group_leaderboard (migration 007) returns fixed columns;
-- changing the return type requires a drop + recreate. The body is otherwise
-- unchanged, with profiles.premium_until added to the SELECT/GROUP BY.

DROP FUNCTION IF EXISTS public.get_group_leaderboard(uuid, text);

CREATE OR REPLACE FUNCTION public.get_group_leaderboard(
    p_group_id UUID,
    p_period TEXT DEFAULT 'week' -- 'week', 'month', 'all'
) RETURNS TABLE (
    user_id UUID,
    user_name TEXT,
    avatar_url TEXT,
    premium_until TIMESTAMPTZ,
    completions_count INTEGER,
    streak_days INTEGER,
    failure_count INTEGER,
    score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_start_date DATE;
BEGIN
    -- Calculate start date based on period
    CASE p_period
        WHEN 'week' THEN v_start_date := DATE_TRUNC('week', CURRENT_DATE)::DATE;
        WHEN 'month' THEN v_start_date := DATE_TRUNC('month', CURRENT_DATE)::DATE;
        ELSE v_start_date := '1970-01-01'::DATE;
    END CASE;

    RETURN QUERY
    SELECT
        gm.user_id,
        p.name::TEXT,
        p.avatar_url::TEXT,
        p.premium_until,
        COALESCE(comp.completion_count, 0)::INTEGER,
        COALESCE(MAX(g.current_streak), 0)::INTEGER,
        gm.failure_count::INTEGER,
        (COALESCE(comp.completion_count, 0) * 10 - gm.failure_count * 5)::INTEGER as score
    FROM group_members gm
    JOIN profiles p ON gm.user_id = p.id
    LEFT JOIN goals g ON g.group_id = p_group_id
    LEFT JOIN (
        SELECT gc.user_id, COUNT(*)::INTEGER as completion_count
        FROM goal_completions gc
        JOIN goals g2 ON gc.goal_id = g2.id
        WHERE g2.group_id = p_group_id
          AND gc.completed_at >= v_start_date
        GROUP BY gc.user_id
    ) comp ON comp.user_id = gm.user_id
    WHERE gm.group_id = p_group_id
    GROUP BY gm.user_id, p.name, p.avatar_url, p.premium_until, comp.completion_count, gm.failure_count
    ORDER BY score DESC, completions_count DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_group_leaderboard(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_leaderboard(uuid, text) TO authenticated, service_role;
