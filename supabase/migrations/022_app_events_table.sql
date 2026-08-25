-- ============================================================================
-- MIGRATION 022: app_events table (analytics sink)
--
-- Why now: analytics default flipped to TRUE for vc20 (CEO ruling
-- 2026-08-24). src/services/track.ts inserts into public.app_events, but the
-- table existed ONLY on the live database (created ad-hoc, never in repo SQL)
-- — a fresh project bootstrapped from supabase/bootstrap.sql would break
-- every track() call (they fail silently by design, but we'd ship dark).
--
-- Schema matches what track.ts writes: event, props jsonb, user_id (NULL for
-- guest sessions), app_version, created_at.
--
-- RLS: inserts allowed for authenticated AND anon (guest-mode sessions track
-- with user_id NULL); no reads or updates for clients — analytics are
-- write-only from the app's perspective. Owner reads via service_role only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event text NOT NULL,
    props jsonb NOT NULL DEFAULT '{}'::jsonb,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    app_version text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert events" ON public.app_events;
CREATE POLICY "Authenticated users can insert events"
    ON public.app_events FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can insert events" ON public.app_events;
CREATE POLICY "Anon can insert events"
    ON public.app_events FOR INSERT
    TO anon
    WITH CHECK (user_id IS NULL);

REVOKE ALL ON public.app_events FROM PUBLIC;
GRANT INSERT ON public.app_events TO authenticated, anon;

CREATE INDEX IF NOT EXISTS idx_app_events_event ON public.app_events(event);
CREATE INDEX IF NOT EXISTS idx_app_events_created_at ON public.app_events(created_at);
