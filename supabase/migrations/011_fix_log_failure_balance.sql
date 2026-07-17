-- Fix log_failure balance math.
-- The previous function subtracted one penalty from the failing user even when
-- no debt transactions were created, and undercounted the failing user's balance
-- when a group had more than two members.

CREATE OR REPLACE FUNCTION log_failure(
  p_group_id uuid,
  p_description text,
  p_proof_photo_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_penalty numeric;
  v_member record;
  v_tx_count integer := 0;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = p_group_id AND user_id = v_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You are not a member of this group');
  END IF;

  SELECT default_penalty_amount
  INTO v_penalty
  FROM public.groups
  WHERE id = p_group_id;

  IF v_penalty IS NULL OR v_penalty <= 0 OR v_penalty > 10000 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid group penalty configuration');
  END IF;

  UPDATE public.group_members
  SET failure_count = failure_count + 1
  WHERE group_id = p_group_id AND user_id = v_user_id;

  FOR v_member IN
    SELECT user_id
    FROM public.group_members
    WHERE group_id = p_group_id AND user_id != v_user_id
  LOOP
    INSERT INTO public.transactions (
      group_id,
      from_user_id,
      to_user_id,
      amount,
      description,
      proof_photo_url
    )
    VALUES (
      p_group_id,
      v_user_id,
      v_member.user_id,
      v_penalty,
      COALESCE(p_description, 'Logged failure'),
      p_proof_photo_url
    );

    UPDATE public.group_members
    SET current_balance = current_balance + v_penalty
    WHERE group_id = p_group_id AND user_id = v_member.user_id;

    v_tx_count := v_tx_count + 1;
  END LOOP;

  IF v_tx_count > 0 THEN
    UPDATE public.group_members
    SET current_balance = current_balance - (v_penalty * v_tx_count)
    WHERE group_id = p_group_id AND user_id = v_user_id;
  END IF;

  INSERT INTO public.activity_log (group_id, user_id, event_type, related_type, metadata)
  VALUES (
    p_group_id,
    v_user_id,
    'failure_logged',
    'transaction',
    json_build_object('amount', v_penalty, 'transactions', v_tx_count)
  );

  RETURN json_build_object(
    'success', true,
    'transactions_created', v_tx_count,
    'total_debt', v_penalty * v_tx_count
  );
END;
$$;
