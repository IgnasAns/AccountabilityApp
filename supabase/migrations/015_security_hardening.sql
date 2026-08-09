-- ============================================================================
-- MIGRATION 015: Security hardening
--
-- Applies the security fixes that were made to the LIVE database but never
-- merged back into the SQL sources. Run this on EXISTING databases only —
-- fresh databases get everything from supabase/bootstrap.sql.
--
-- What it does:
--   1. Creates invite_attempts, the rate-limit table backing the hardened
--      join_group_by_code (max 20 invite-code guesses per user per hour).
--   2. Revokes direct execution of enqueue_group_notification — it is a
--      trigger/service-only function and must not be callable by
--      PUBLIC/anon/authenticated.
--   3. Adds an explicit search_path to every SECURITY DEFINER function that
--      lacks one, so hostile schemas cannot hijack unqualified names.
--
-- THIS MIGRATION SUPERSEDES add_delete_policies.sql AND fix_invite_codes.sql,
-- both of which were DELETED from the repo and must never be run again:
--   * add_delete_policies.sql shipped transactions_insert / transactions_update
--     / group_members_update policies with USING (true) / WITH CHECK (true),
--     which let ANY authenticated user rewrite the money ledger.
--   * fix_invite_codes.sql shrank invite codes to 8 hex chars (32 bits of
--     entropy), making them trivially guessable and defeating the rate
--     limiting added here.
-- The narrow creator-only DELETE/UPDATE policies from the live database
-- (groups_delete, group_members_delete, transactions_delete, groups update)
-- live in supabase/full_setup.sql.
--
-- Function rewrites for EXISTING databases: log_negative_occurrence,
-- process_overdue_goals, delete_my_account and join_group_by_code were
-- updated in their ORIGINAL source files (supabase/enhanced_goals_setup.sql,
-- supabase/auto_failure_setup.sql, supabase/migrations/014_account_deletion.sql,
-- supabase/full_setup.sql) — re-run those files (or the regenerated
-- supabase/bootstrap.sql) to pick up the hardened bodies.
-- ============================================================================

-- Rate-limit table backing join_group_by_code (idempotent)
CREATE TABLE IF NOT EXISTS public.invite_attempts (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    attempt_count integer NOT NULL DEFAULT 0,
    window_start timestamptz NOT NULL DEFAULT now()
);

-- Trigger/service-only function: revoke direct execution
REVOKE ALL ON FUNCTION public.enqueue_group_notification FROM PUBLIC, anon, authenticated;

-- search_path on every SECURITY DEFINER function that lacks it
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prosecdef
          AND p.proconfig IS NULL
    LOOP
        EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
    END LOOP;
END $$;
