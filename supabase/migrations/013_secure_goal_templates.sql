-- ============================================================================
-- MIGRATION 013: Enable RLS on goal_templates
--
-- goal_templates was the only table in the public schema with RLS never
-- enabled. Supabase exposes the whole public schema through PostgREST, so any
-- holder of the (publicly shipped) anon key could INSERT, UPDATE or DELETE the
-- shared template catalogue — vandalising the picker for every user.
--
-- It is read-only reference data: grant SELECT to everyone, define no write
-- policies, and writes are denied by default. Nothing in the client writes to
-- this table (useGoalTemplates ships its own hardcoded fallback list), so this
-- costs no functionality.
-- ============================================================================

ALTER TABLE goal_templates ENABLE ROW LEVEL SECURITY;

-- Readable by anyone, including the not-yet-signed-in (the template picker is
-- reachable before a group exists).
DROP POLICY IF EXISTS "Goal templates are publicly readable" ON goal_templates;
CREATE POLICY "Goal templates are publicly readable" ON goal_templates
    FOR SELECT USING (true);

-- Intentionally no INSERT/UPDATE/DELETE policies. With RLS enabled and no
-- permissive policy, those are refused for anon and authenticated alike.
-- Seeding and edits happen through migrations or the service role, both of
-- which bypass RLS.
