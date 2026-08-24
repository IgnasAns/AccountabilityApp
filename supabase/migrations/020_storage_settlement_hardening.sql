-- ============================================================================
-- MIGRATION 020: Storage + settlement hardening (red-team cycle 2)
--
-- Findings closed here:
--
--   EXPLOIT P3 — proof-photos UPDATE/DELETE policies have no owner check.
--   "Users can update their own photos" / "Users can delete their own photos"
--   only filter on bucket_id: ANY authenticated user can overwrite or delete
--   ANY member's proof photo (evidence tampering in an accountability app
--   whose core loop is photographic proof). Owner check added via
--   auth.uid() = owner, matching how uploads are performed (the uploader is
--   the owner; path convention user-<uid>/...).
--
--   EXPLOIT P4 — settle_debt creditor check was lost from the bootstrap
--   chain. full_setup.sql still ships the ORIGINAL body with NO "only the
--   creditor can confirm" guard; migration 010's hardened body wins on a
--   FRESH database (bootstrap order), but any DB that re-ran full_setup.sql
--   after 010 got the unguarded version back. 020 re-asserts the hardened
--   body LAST so every apply path converges on the guarded function.
--
-- Idempotent. Safe to re-run. No schema changes. No client code impact:
-- logFailure/settleDebt call shapes unchanged.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PROOF-PHOTO POLICIES: owner-scoped UPDATE / DELETE
--    (SELECT stays group-public by design — members must see each other's
--    proof inside the app flow; bucket remains public-read.)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can update their own photos" ON storage.objects;
CREATE POLICY "Users can update their own photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING ( bucket_id = 'proof-photos' AND auth.uid() = owner );

DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;
CREATE POLICY "Users can delete their own photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING ( bucket_id = 'proof-photos' AND auth.uid() = owner );

-- ---------------------------------------------------------------------------
-- 2. SETTLE_DEBT: final hardened body (creditor-only, idempotent)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.settle_debt(p_transaction_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tx record;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_tx FROM public.transactions WHERE id = p_transaction_id;

  IF v_tx IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Transaction not found');
  END IF;

  -- Only the creditor (to_user) can confirm payment received
  IF v_tx.to_user_id != v_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Only the creditor can confirm payment');
  END IF;

  IF v_tx.status = 'paid' THEN
    RETURN json_build_object('success', false, 'error', 'Already paid');
  END IF;

  UPDATE public.transactions
  SET status = 'paid', settled_at = now()
  WHERE id = p_transaction_id;

  UPDATE public.group_members
  SET current_balance = current_balance + v_tx.amount
  WHERE group_id = v_tx.group_id AND user_id = v_tx.from_user_id;

  UPDATE public.group_members
  SET current_balance = current_balance - v_tx.amount
  WHERE group_id = v_tx.group_id AND user_id = v_tx.to_user_id;

  RETURN json_build_object('success', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.settle_debt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_debt(uuid) TO authenticated, service_role;
