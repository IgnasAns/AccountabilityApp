-- ============================================================================
-- MIGRATION 008: Add Missing Activity Log Triggers and RPC Updates
-- ============================================================================

-- 1. Trigger for Goal Creation
CREATE OR REPLACE FUNCTION log_goal_creation() RETURNS TRIGGER AS $$
BEGIN
    PERFORM log_activity(
        NEW.group_id,
        NEW.created_by,
        'goal_created',
        NEW.id,
        'goal',
        jsonb_build_object('goal_name', NEW.name, 'goal_emoji', NEW.emoji)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_goal_creation ON goals;
CREATE TRIGGER trigger_log_goal_creation
    AFTER INSERT ON goals
    FOR EACH ROW
    EXECUTE FUNCTION log_goal_creation();

-- 2. Update log_failure RPC to include activity logging
CREATE OR REPLACE FUNCTION log_failure(
    p_group_id uuid, 
    p_description text, 
    p_proof_photo_url text DEFAULT null -- matching signature if it changed, currently schema says (p_group_id, p_description)
    -- checking schema.sql, log_failure has p_group_id, p_description.
    -- Wait, my previous view of schema.sql line 127 shows: Args: { p_group_id: string; p_description: string | null; p_proof_photo_url?: string | null };
    -- I need to be careful with signature.
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_penalty numeric;
  v_member record;
  v_tx_count integer := 0;
  v_user_name text;
BEGIN
  v_user_id := auth.uid();
  select name into v_user_name from profiles where id = v_user_id;
  
  -- Get penalty amount
  select default_penalty_amount into v_penalty from public.groups where id = p_group_id;
  
  -- Update failure count
  update public.group_members 
  set failure_count = failure_count + 1,
      current_balance = current_balance - v_penalty
  where group_id = p_group_id and user_id = v_user_id;

  -- Find other members to pay
  for v_member in select user_id from public.group_members where group_id = p_group_id and user_id != v_user_id loop
    insert into public.transactions (group_id, from_user_id, to_user_id, amount, description)
    values (p_group_id, v_user_id, v_member.user_id, v_penalty, p_description);
    
    -- Update recipient balance
    update public.group_members
    set current_balance = current_balance + v_penalty
    where group_id = p_group_id and user_id = v_member.user_id;
    
    v_tx_count := v_tx_count + 1;
  end loop;

  -- LOG ACTIVITY
  PERFORM log_activity(
    p_group_id,
    v_user_id,
    'failure_logged',
    null,
    'system',
    jsonb_build_object('description', p_description, 'penalty', v_penalty, 'user_name', v_user_name)
  );

  return json_build_object('success', true, 'transactions_created', v_tx_count, 'total_debt', v_penalty * v_tx_count);
END;
$$;

-- 3. Update settle_debt RPC to include activity logging
CREATE OR REPLACE FUNCTION settle_debt(p_transaction_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tx record;
  v_payer_name text;
  v_payee_name text;
BEGIN
  select * into v_tx from public.transactions where id = p_transaction_id;
  
  if v_tx.status = 'paid' then
     return json_build_object('success', false, 'error', 'Already paid');
  end if;

  -- Mark as paid
  update public.transactions
  set status = 'paid', settled_at = now()
  where id = p_transaction_id;

  -- Adjust balances (reverse the debt)
  update public.group_members
  set current_balance = current_balance + v_tx.amount
  where group_id = v_tx.group_id and user_id = v_tx.from_user_id;

  update public.group_members
  set current_balance = current_balance - v_tx.amount
  where group_id = v_tx.group_id and user_id = v_tx.to_user_id;

  -- Get names for log
  select name into v_payer_name from profiles where id = v_tx.from_user_id;
  select name into v_payee_name from profiles where id = v_tx.to_user_id;

  -- LOG ACTIVITY
  -- Logged by the auth user (who clicked settle, usually payee), but attributed to the transaction
  PERFORM log_activity(
    v_tx.group_id,
    auth.uid(),
    'debt_settled',
    p_transaction_id,
    'transaction',
    jsonb_build_object(
        'amount', v_tx.amount, 
        'payer_name', v_payer_name, 
        'payee_name', v_payee_name
    )
  );

  return json_build_object('success', true);
END;
$$;
