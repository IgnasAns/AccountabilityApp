-- ============================================================================
-- MIGRATION 019: Premium entitlement hardening
--
-- Red-team findings this closes:
--
--   EXPLOIT P1 — Self-minted Premium. profiles has no column-restricted UPDATE
--   path: the "Users can update own profile." policy is USING (auth.uid() =
--   id) with no column guard, so any authenticated user can POST
--   { premium_until: "2099-01-01" } straight to PostgREST and get Premium for
--   free, bypassing Google Play billing entirely. Same hole exists on INSERT
--   (signup upsert path): WITH CHECK (auth.uid() = id) does not stop a new
--   row carrying premium_until.
--
--   EXPLOIT P2 — Free-tier group-cap bypass via forged challenge codes.
--   enforce_free_tier_group_limit exempts any group whose caller-supplied
--   invite_code starts with 'CH%', and the derivation ('CH' + first 6 hex of
--   sha256(slug)) is public knowledge from 017_public_challenges.sql. A free
--   user can therefore create unlimited groups by inventing CHxxxxxx codes.
--
-- Fix strategy (server-authoritative, no schema change):
--   1. BEFORE INSERT OR UPDATE trigger on profiles: when the statement runs
--     as a plain client role ('authenticated'/'anon'), any attempt to set or
--     change premium_until / premium_plan is silently reverted to the stored
--     value. Writes made through set_premium() or service_role arrive with
--     current_user IN ('postgres','service_role') (SECURITY DEFINER context)
--     and pass through untouched. Clients cannot create definer contexts, so
--     the only road to Premium is the RPC backed by a real store purchase.
--   2. enforce_free_tier_group_limit recreated: a 'CH%' invite_code is only
--     exempt when it EXACTLY matches the deterministic digest of a REAL
--     challenge slug in public_challenges. Forged CH codes fall through to
--     the normal free-tier cap instead of bypassing it.
--
-- Apply on LIVE via dashboard SQL editor or `supabase db push` (needs DB
-- password). Idempotent: safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PREMIUM-COLUMN SANITIZER TRIGGER
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sanitize_premium_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    -- Definer / service contexts (set_premium RPC, backend jobs) may write
    -- premium columns. Everything else is a client write.
    IF current_user IN ('postgres', 'service_role') THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- A client-created row never starts life entitled.
        NEW.premium_until := NULL;
        NEW.premium_plan  := NULL;
    ELSE
        -- UPDATE: pin entitlement columns to whatever is already stored.
        IF NEW.premium_until IS DISTINCT FROM OLD.premium_until
           OR NEW.premium_plan IS DISTINCT FROM OLD.premium_plan THEN
            RAISE WARNING 'sanitize_premium_columns: blocked premium write on % by %', OLD.id, current_user;
        END IF;
        NEW.premium_until := OLD.premium_until;
        NEW.premium_plan  := OLD.premium_plan;
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sanitize_premium_columns ON public.profiles;
CREATE TRIGGER sanitize_premium_columns
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sanitize_premium_columns();

REVOKE ALL ON FUNCTION public.sanitize_premium_columns() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. FREE-TIER CAP: only REAL challenge codes are exempt
-- ---------------------------------------------------------------------------

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
    v_is_real_challenge boolean;
BEGIN
    IF NEW.invite_code IS NOT NULL AND NEW.invite_code LIKE 'CH%' THEN
        -- Exempt ONLY codes that exactly match the deterministic derivation
        -- used by join_public_challenge() for a challenge that exists.
        SELECT EXISTS (
            SELECT 1
            FROM public.public_challenges c
            WHERE 'CH' || upper(substr(encode(extensions.digest(c.slug, 'sha256'), 'hex'), 1, 6))
                    = NEW.invite_code
        )
        INTO v_is_real_challenge;

        IF v_is_real_challenge THEN
            RETURN NEW;
        END IF;
        -- Forged challenge code: fall through and count against the cap.
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
