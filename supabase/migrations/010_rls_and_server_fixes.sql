-- ===========================================================================
-- MIGRATION 010: RLS Policies & Server-Side Fixes
-- ===========================================================================
-- Adds missing RLS policies, hardens settle_debt, adds goals/messages/activity_log tables
-- Run this AFTER full_setup.sql
-- ===========================================================================

-- ===========================================================================
-- 1. ADDITIONAL TABLES (if not already created by other migrations)
-- ===========================================================================

-- Goals Table
CREATE TABLE IF NOT EXISTS public.goals (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id uuid REFERENCES public.groups(id) NOT NULL,
  name text NOT NULL,
  description text,
  emoji text NOT NULL DEFAULT '🎯',
  goal_type text CHECK (goal_type IN ('frequency', 'daily', 'weekly')) DEFAULT 'frequency' NOT NULL,
  goal_mode text CHECK (goal_mode IN ('positive', 'negative')) DEFAULT 'positive' NOT NULL,
  frequency_days integer DEFAULT 7 NOT NULL,
  target_per_week integer,
  penalty_amount numeric NOT NULL DEFAULT 5.00,
  is_active boolean DEFAULT true NOT NULL,
  created_by uuid REFERENCES public.profiles(id) NOT NULL,
  -- Streak tracking
  current_streak integer DEFAULT 0 NOT NULL,
  longest_streak integer DEFAULT 0 NOT NULL,
  streak_broken_at timestamp with time zone,
  -- Photo proof
  requires_proof boolean DEFAULT false NOT NULL,
  -- Category
  category text DEFAULT 'custom' NOT NULL,
  tags text[] DEFAULT '{}' NOT NULL,
  -- Pause support
  is_paused boolean DEFAULT false NOT NULL,
  paused_at timestamp with time zone,
  paused_until timestamp with time zone,
  -- Penalty escalation
  penalty_escalation_enabled boolean DEFAULT false NOT NULL,
  penalty_escalation_rate numeric DEFAULT 1.5 NOT NULL,
  consecutive_failures integer DEFAULT 0 NOT NULL,
  -- Timestamps
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Goal Completions Table
CREATE TABLE IF NOT EXISTS public.goal_completions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  goal_id uuid REFERENCES public.goals(id) NOT NULL,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  completed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  proof_photo_url text,
  notes text,
  occurrence_count integer DEFAULT 1 NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Goal Comments Table
CREATE TABLE IF NOT EXISTS public.goal_comments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  completion_id uuid REFERENCES public.goal_completions(id) NOT NULL,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  content text NOT NULL CHECK (char_length(content) <= 300 AND char_length(content) > 0),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id uuid REFERENCES public.groups(id) NOT NULL,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  content text NOT NULL CHECK (char_length(content) <= 300 AND char_length(content) > 0),
  message_type text CHECK (message_type IN ('text', 'image', 'system')) DEFAULT 'text' NOT NULL,
  image_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Activity Log Table
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id uuid REFERENCES public.groups(id) NOT NULL,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  event_type text NOT NULL,
  related_id uuid,
  related_type text,
  metadata jsonb DEFAULT '{}' NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ===========================================================================
-- 2. ENABLE RLS ON ALL TABLES
-- ===========================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 3. GOALS RLS POLICIES
-- ===========================================================================

DROP POLICY IF EXISTS "Group members can view goals" ON public.goals;
CREATE POLICY "Group members can view goals"
  ON goals FOR SELECT
  USING ( group_id IN ( SELECT get_my_group_ids() ) );

DROP POLICY IF EXISTS "Authenticated users can create goals" ON public.goals;
CREATE POLICY "Authenticated users can create goals"
  ON goals FOR INSERT
  TO authenticated
  WITH CHECK ( group_id IN ( SELECT get_my_group_ids() ) );

DROP POLICY IF EXISTS "Goal creators can update their goals" ON public.goals;
CREATE POLICY "Goal creators can update their goals"
  ON goals FOR UPDATE
  TO authenticated
  USING ( created_by = auth.uid() );

DROP POLICY IF EXISTS "Goal creators can delete their goals" ON public.goals;
CREATE POLICY "Goal creators can delete their goals"
  ON goals FOR DELETE
  TO authenticated
  USING ( created_by = auth.uid() );

-- ===========================================================================
-- 4. GOAL COMPLETIONS RLS POLICIES
-- ===========================================================================

DROP POLICY IF EXISTS "Group members can view completions" ON public.goal_completions;
CREATE POLICY "Group members can view completions"
  ON goal_completions FOR SELECT
  USING ( goal_id IN ( SELECT id FROM goals WHERE group_id IN ( SELECT get_my_group_ids() ) ) );

DROP POLICY IF EXISTS "Users can insert their own completions" ON public.goal_completions;
CREATE POLICY "Users can insert their own completions"
  ON goal_completions FOR INSERT
  TO authenticated
  WITH CHECK ( user_id = auth.uid() );

DROP POLICY IF EXISTS "Users can delete their own completions" ON public.goal_completions;
CREATE POLICY "Users can delete their own completions"
  ON goal_completions FOR DELETE
  TO authenticated
  USING ( user_id = auth.uid() );

-- ===========================================================================
-- 5. GOAL COMMENTS RLS POLICIES
-- ===========================================================================

DROP POLICY IF EXISTS "Group members can view comments" ON public.goal_comments;
CREATE POLICY "Group members can view comments"
  ON goal_comments FOR SELECT
  USING ( completion_id IN (
    SELECT id FROM goal_completions
    WHERE goal_id IN ( SELECT id FROM goals WHERE group_id IN ( SELECT get_my_group_ids() ) )
  ) );

DROP POLICY IF EXISTS "Authenticated users can add comments" ON public.goal_comments;
CREATE POLICY "Authenticated users can add comments"
  ON goal_comments FOR INSERT
  TO authenticated
  WITH CHECK ( user_id = auth.uid() );

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.goal_comments;
CREATE POLICY "Users can delete their own comments"
  ON goal_comments FOR DELETE
  TO authenticated
  USING ( user_id = auth.uid() );

-- ===========================================================================
-- 6. MESSAGES RLS POLICIES
-- ===========================================================================

DROP POLICY IF EXISTS "Group members can view messages" ON public.messages;
CREATE POLICY "Group members can view messages"
  ON messages FOR SELECT
  USING ( group_id IN ( SELECT get_my_group_ids() ) );

DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.messages;
CREATE POLICY "Authenticated users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK ( group_id IN ( SELECT get_my_group_ids() ) AND user_id = auth.uid() );

-- ===========================================================================
-- 7. ACTIVITY LOG RLS POLICIES
-- ===========================================================================

DROP POLICY IF EXISTS "Group members can view activity log" ON public.activity_log;
CREATE POLICY "Group members can view activity log"
  ON activity_log FOR SELECT
  USING ( group_id IN ( SELECT get_my_group_ids() ) );

-- ===========================================================================
-- 8. ENHANCED TRANSACTIONS POLICIES
-- ===========================================================================

-- UPDATE policy: only creditor (to_user) can update transaction status
DROP POLICY IF EXISTS "Creditor can settle transactions" ON public.transactions;
CREATE POLICY "Creditor can settle transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING ( to_user_id = auth.uid() )
  WITH CHECK ( to_user_id = auth.uid() );

-- ===========================================================================
-- 9. ENHANCED SETTLE_DEBT RPC
-- ===========================================================================

CREATE OR REPLACE FUNCTION settle_debt(p_transaction_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Only the creditor (to_user) can confirm payment
  IF v_tx.to_user_id != v_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Only the creditor can confirm payment');
  END IF;

  IF v_tx.status = 'paid' THEN
    RETURN json_build_object('success', false, 'error', 'Already paid');
  END IF;

  -- Mark as paid
  UPDATE public.transactions
  SET status = 'paid', settled_at = now()
  WHERE id = p_transaction_id;

  -- Adjust balances
  UPDATE public.group_members
  SET current_balance = current_balance + v_tx.amount
  WHERE group_id = v_tx.group_id AND user_id = v_tx.from_user_id;

  UPDATE public.group_members
  SET current_balance = current_balance - v_tx.amount
  WHERE group_id = v_tx.group_id AND user_id = v_tx.to_user_id;

  RETURN json_build_object('success', true);
END;
$$;

-- ===========================================================================
-- 10. ENHANCED LOG_FAILURE RPC (with proof_photo_url)
-- ===========================================================================

CREATE OR REPLACE FUNCTION log_failure(p_group_id uuid, p_description text, p_proof_photo_url text DEFAULT NULL)
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

  -- Verify user is a member of this group
  IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = p_group_id AND user_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'You are not a member of this group');
  END IF;

  -- Get penalty amount from group settings (server-side, never from client)
  SELECT default_penalty_amount INTO v_penalty FROM public.groups WHERE id = p_group_id;

  IF v_penalty IS NULL OR v_penalty <= 0 OR v_penalty > 10000 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid group penalty configuration');
  END IF;

  -- Update failure count and balance for the failing user
  UPDATE public.group_members
  SET failure_count = failure_count + 1,
      current_balance = current_balance - v_penalty
  WHERE group_id = p_group_id AND user_id = v_user_id;

  -- Create transactions for each other member
  FOR v_member IN SELECT user_id FROM public.group_members WHERE group_id = p_group_id AND user_id != v_user_id LOOP
    INSERT INTO public.transactions (group_id, from_user_id, to_user_id, amount, description, proof_photo_url)
    VALUES (p_group_id, v_user_id, v_member.user_id, v_penalty, COALESCE(p_description, 'Logged failure'), p_proof_photo_url);

    -- Update recipient balance
    UPDATE public.group_members
    SET current_balance = current_balance + v_penalty
    WHERE group_id = p_group_id AND user_id = v_member.user_id;

    v_tx_count := v_tx_count + 1;
  END LOOP;

  -- Log activity
  INSERT INTO public.activity_log (group_id, user_id, event_type, related_type, metadata)
  VALUES (p_group_id, v_user_id, 'failure_logged', 'transaction', json_build_object('amount', v_penalty, 'transactions', v_tx_count));

  RETURN json_build_object('success', true, 'transactions_created', v_tx_count, 'total_debt', v_penalty * v_tx_count);
END;
$$;

-- ===========================================================================
-- SETUP COMPLETE
-- ===========================================================================
