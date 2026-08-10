-- ============================================================================
-- MIGRATION 017: Public Challenges (cold-start growth mechanic)
--
-- Fixes the #1 growth problem: a solo user has no one to pact with, so the
-- core loop (streaks, penalties, leaderboard) never lights up. Public
-- challenges are shared, opt-in group challenges (Habitica-style): one tap
-- JOIN lands the user in a SHARED group per challenge with instant social
-- context — other participants, a leaderboard, streaks and penalties — with
-- no invites required.
--
-- What it adds:
--   1. public_challenges      — the catalog of joinable challenges (seed data).
--   2. challenge_participants — who joined which challenge, and which shared
--                               group they landed in.
--   3. join_public_challenge  — SECURITY DEFINER RPC. Idempotent and
--      race-safe: creates-or-returns ONE shared group per challenge, adds the
--      caller as a group member (balance 0), records participation and
--      auto-creates ONE shared goal per challenge group (name/emoji/penalty/
--      frequency from the challenge row, created_by = first joiner).
--   4. get_challenge_stats    — SECURITY DEFINER read path for the Explore
--      tab: every display field + live participant_count + whether the
--      caller already joined. One cheap RPC call, RLS-safe.
--
-- Design notes:
--   * ONE shared group per challenge. A goal is a group-level object in this
--     app (every member completes the same goal; streaks/leaderboard compare
--     members on it), so the auto-created goal is created once per group by
--     the first joiner — NOT one goal per member (that would pile N goals
--     onto the dashboard). "No duplicate goals" is guaranteed by serializing
--     goal creation on the group row lock (SELECT ... FOR UPDATE).
--   * Concurrency: the shared group's invite_code is derived deterministically
--     from the challenge slug, so the groups.invite_code UNIQUE constraint
--     makes concurrent first-joins safe (ON CONFLICT DO NOTHING + re-select).
--   * The group name is "<Challenge Name> #<code>" so the shared group is
--     recognizable and distinct from any user-created group.
--   * Search path is pinned on both definer functions; execution is revoked
--     from PUBLIC/anon and granted only to authenticated + service_role.
-- ============================================================================

-- 1. TABLES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.public_challenges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text UNIQUE NOT NULL,
    name text NOT NULL,
    emoji text NOT NULL DEFAULT '🏆',
    description text NOT NULL DEFAULT '',
    goal_name text NOT NULL,
    goal_emoji text NOT NULL DEFAULT '🎯',
    penalty_amount numeric NOT NULL DEFAULT 5.00 CHECK (penalty_amount > 0 AND penalty_amount <= 10000),
    frequency_days integer NOT NULL DEFAULT 1 CHECK (frequency_days > 0),
    starts_at timestamptz NOT NULL DEFAULT now(),
    ends_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
    participant_cap integer NOT NULL DEFAULT 100 CHECK (participant_cap > 0),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.challenge_participants (
    challenge_id uuid NOT NULL REFERENCES public.public_challenges(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    joined_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_group_id ON public.challenge_participants(group_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user_id ON public.challenge_participants(user_id);

-- 2. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

ALTER TABLE public.public_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

-- The challenge catalog is public to every signed-in user (that is the point
-- of the Explore section). Writes are service_role only — challenges are
-- curated seed data, not user content.
DROP POLICY IF EXISTS "Public challenges are viewable by authenticated users" ON public.public_challenges;
CREATE POLICY "Public challenges are viewable by authenticated users"
    ON public.public_challenges FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Only service role can modify public challenges" ON public.public_challenges;
CREATE POLICY "Only service role can modify public challenges"
    ON public.public_challenges FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Participants can only read their OWN membership rows. The group header tag
-- ("Public challenge") works because the caller queries their own row for a
-- given group. Everyone else's rows are invisible — counts come from the
-- SECURITY DEFINER get_challenge_stats() instead.
DROP POLICY IF EXISTS "Participants can view their own challenge memberships" ON public.challenge_participants;
CREATE POLICY "Participants can view their own challenge memberships"
    ON public.challenge_participants FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Insert is permitted for own rows as defense-in-depth; the real join path is
-- the RPC below (which also creates the shared group + goal atomically).
DROP POLICY IF EXISTS "Participants can insert their own challenge memberships" ON public.challenge_participants;
CREATE POLICY "Participants can insert their own challenge memberships"
    ON public.challenge_participants FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- 3. JOIN RPC (SECURITY DEFINER, idempotent, race-safe)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.join_public_challenge(p_challenge_slug text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_challenge public.public_challenges%ROWTYPE;
    v_group_id uuid;
    v_invite_code text;
    v_participant_count bigint;
    v_goal_exists boolean;
    v_goal_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    SELECT * INTO v_challenge
    FROM public.public_challenges
    WHERE slug = lower(p_challenge_slug)
      AND is_active = true;

    IF v_challenge.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Challenge not found or not active');
    END IF;

    -- Idempotent: already joined → return the existing shared group untouched.
    SELECT cp.group_id INTO v_group_id
    FROM public.challenge_participants cp
    WHERE cp.challenge_id = v_challenge.id
      AND cp.user_id = v_user_id;

    IF v_group_id IS NOT NULL THEN
        SELECT invite_code INTO v_invite_code FROM public.groups WHERE id = v_group_id;
        RETURN json_build_object(
            'success', true,
            'already_joined', true,
            'group_id', v_group_id,
            'invite_code', v_invite_code
        );
    END IF;

    -- Participant cap (only applies to NEW joins).
    SELECT count(*) INTO v_participant_count
    FROM public.challenge_participants
    WHERE challenge_id = v_challenge.id;

    IF v_participant_count >= v_challenge.participant_cap THEN
        RETURN json_build_object('success', false, 'error', 'This challenge is full');
    END IF;

    -- One shared group per challenge. The invite code is derived from the
    -- slug (deterministic), so the groups.invite_code UNIQUE constraint
    -- resolves the create race: the loser of a concurrent first-join gets no
    -- row back and falls through to a re-select of the winner's group.
    -- The code is exactly 8 chars ("CH" + 6 hex) so the existing share
    -- machinery works as-is: JoinGroupScreen validates 8 chars and the
    -- doitmate://join deep link accepts it. That is fine for a PUBLIC
    -- challenge — the group is open by design, so the code is a stable
    -- identifier, not a secret.
    v_invite_code := 'CH' || upper(substr(encode(extensions.digest(v_challenge.slug, 'sha256'), 'hex'), 1, 6));

    INSERT INTO public.groups (
        name, description, default_penalty_amount, invite_code, created_by
    )
    VALUES (
        v_challenge.name || ' #' || substr(v_invite_code, 3, 4),
        v_challenge.description,
        v_challenge.penalty_amount,
        v_invite_code,
        v_user_id
    )
    ON CONFLICT (invite_code) DO NOTHING
    RETURNING id INTO v_group_id;

    IF v_group_id IS NULL THEN
        SELECT id INTO v_group_id FROM public.groups WHERE invite_code = v_invite_code;
    END IF;

    -- Serialize goal creation on the group row: concurrent joiners block here
    -- until the creator commits, then see the goal and skip. Guarantees one
    -- goal per challenge group even under parallel first-joins.
    PERFORM 1 FROM public.groups WHERE id = v_group_id FOR UPDATE;

    -- Add the caller as a group member (balance 0). Unique constraint makes
    -- this idempotent.
    INSERT INTO public.group_members (group_id, user_id, current_balance, failure_count)
    VALUES (v_group_id, v_user_id, 0, 0)
    ON CONFLICT (group_id, user_id) DO NOTHING;

    -- Record participation (PK makes this idempotent).
    INSERT INTO public.challenge_participants (challenge_id, user_id, group_id)
    VALUES (v_challenge.id, v_user_id, v_group_id)
    ON CONFLICT (challenge_id, user_id) DO NOTHING;

    -- Auto-create ONE shared goal per challenge group (first joiner creates
    -- it; everyone else completes the same goal). The group row lock above
    -- makes this race-free.
    SELECT EXISTS (
        SELECT 1 FROM public.goals WHERE group_id = v_group_id AND is_active = true
    ) INTO v_goal_exists;

    IF NOT v_goal_exists THEN
        INSERT INTO public.goals (
            group_id, name, description, emoji, goal_type, goal_mode,
            frequency_days, target_per_week, penalty_amount, is_active,
            created_by, category, tags
        )
        VALUES (
            v_group_id,
            v_challenge.goal_name,
            v_challenge.description,
            v_challenge.goal_emoji,
            'frequency', 'positive',
            v_challenge.frequency_days,
            NULL,
            v_challenge.penalty_amount,
            true,
            v_user_id,
            'custom',
            ARRAY['challenge']::text[]
        )
        RETURNING id INTO v_goal_id;
    END IF;

    SELECT invite_code INTO v_invite_code FROM public.groups WHERE id = v_group_id;

    RETURN json_build_object(
        'success', true,
        'already_joined', false,
        'group_id', v_group_id,
        'invite_code', v_invite_code
    );
END;
$function$;

-- 4. EXPLORE-READ RPC: challenge catalog + live counts + caller's join state
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_challenge_stats()
RETURNS TABLE (
    slug text,
    name text,
    emoji text,
    description text,
    goal_name text,
    goal_emoji text,
    penalty_amount numeric,
    frequency_days integer,
    starts_at timestamptz,
    ends_at timestamptz,
    participant_cap integer,
    participant_count bigint,
    joined boolean,
    group_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT
        c.slug,
        c.name,
        c.emoji,
        c.description,
        c.goal_name,
        c.goal_emoji,
        c.penalty_amount,
        c.frequency_days,
        c.starts_at,
        c.ends_at,
        c.participant_cap,
        count(cp.user_id)::bigint AS participant_count,
        COALESCE(bool_or(cp.user_id = auth.uid()), false) AS joined,
        (
            SELECT cp2.group_id
            FROM public.challenge_participants cp2
            WHERE cp2.challenge_id = c.id
              AND cp2.user_id = auth.uid()
            LIMIT 1
        ) AS group_id
    FROM public.public_challenges c
    LEFT JOIN public.challenge_participants cp ON cp.challenge_id = c.id
    WHERE c.is_active = true
    GROUP BY c.id
    ORDER BY c.starts_at;
$$;

-- 5. PERMISSIONS: authenticated + service_role only, nothing public.
-- ----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.join_public_challenge(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_public_challenge(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_challenge_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_challenge_stats() TO authenticated, service_role;

-- 6. SEED DATA — 6 curated challenges with staggered starts so several are
--    active at once. Idempotent: re-running keeps the original rows.
-- ----------------------------------------------------------------------------

INSERT INTO public.public_challenges (
    slug, name, emoji, description, goal_name, goal_emoji,
    penalty_amount, frequency_days, starts_at, ends_at, participant_cap
)
VALUES
    (
        '30-day-gym',
        '30-Day Gym',
        '🏋️',
        'Hit the gym 3x a week for 30 days. Post a selfie or a photo of the rack to prove it. Miss a session and you owe the group.',
        'Gym Session',
        '🏋️',
        5.00, 2,
        now() - interval '7 days',
        now() + interval '23 days',
        100
    ),
    (
        'no-sugar',
        'No Sugar',
        '🍭',
        'No added sugar for 30 days. Every slip-up costs you — that is the point. Sweets, sodas and syrups are all out.',
        'No Sugar',
        '🍭',
        10.00, 1,
        now() - interval '3 days',
        now() + interval '27 days',
        100
    ),
    (
        'early-riser',
        'Early Riser',
        '🌅',
        'Wake up before 7AM every day. Post a photo of your watch or the sunrise — no snooze button heroes here.',
        'Early Riser',
        '🌅',
        5.00, 1,
        now() - interval '1 day',
        now() + interval '29 days',
        100
    ),
    (
        'read-20-pages',
        'Read 20 Pages',
        '📚',
        'Read 20 pages a day. Snap the page you finished as proof. A month of reading is a whole book.',
        'Read 20 Pages',
        '📚',
        3.00, 1,
        now(),
        now() + interval '30 days',
        100
    ),
    (
        'drink-water',
        'Drink 2L Water',
        '💧',
        'Two litres of water every day. Hydration is the cheapest performance hack there is.',
        'Drink 2L Water',
        '💧',
        2.00, 1,
        now() + interval '2 days',
        now() + interval '32 days',
        100
    ),
    (
        'study-streak',
        'Study Streak',
        '📖',
        'A focused study session every day — 45 minutes, phone in another room. Daily streak, monthly payoff.',
        'Study Session',
        '📖',
        5.00, 1,
        now() - interval '14 days',
        now() + interval '16 days',
        100
    )
ON CONFLICT (slug) DO NOTHING;
