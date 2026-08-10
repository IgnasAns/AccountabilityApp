-- ============================================================================
-- Do It Mate! — COMPLETE DATABASE BOOTSTRAP
-- Generated 2026-08-10 by scripts/build_bootstrap_sql.py
-- DO NOT EDIT BY HAND — edit the source files and regenerate.
--
-- Paste this whole file into the Supabase SQL editor of a fresh project, or:
--     psql "$DATABASE_URL" -f supabase/bootstrap.sql
--
-- Safe to re-run: policy drops are injected by the generator.
--
-- AFTER running this, in the Supabase dashboard:
--   1. Authentication > Providers > enable Email (and Anonymous, for guest mode)
--   2. Authentication > URL Configuration > add redirect: doitmate://reset-password
--   3. Storage: buckets are created by the SQL below; verify they exist
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SOURCE: supabase/full_setup.sql
-- ----------------------------------------------------------------------------

-- ===========================================================================
-- FULL DATABASE SETUP - RUN THIS IN SUPABASE SQL EDITOR
-- ===========================================================================
-- This combines schema.sql and critical_fix.sql into a single, idempotent script.
-- You can run this multiple times safely.
-- ===========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. CREATE TABLES
-- ---------------------------------------------------------------------------

-- Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  name text NOT NULL,
  avatar_url text,
  payment_link text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Groups Table
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  description text,
  default_penalty_amount numeric NOT NULL DEFAULT 5.00,
  invite_code text UNIQUE DEFAULT encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'),
  image_url text,
  created_by uuid REFERENCES public.profiles(id) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Group Members Table
CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id uuid REFERENCES public.groups(id) NOT NULL,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  current_balance numeric DEFAULT 0 NOT NULL,
  failure_count integer DEFAULT 0 NOT NULL,
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(group_id, user_id)
);

-- Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id uuid REFERENCES public.groups(id) NOT NULL,
  from_user_id uuid REFERENCES public.profiles(id) NOT NULL,
  to_user_id uuid REFERENCES public.profiles(id) NOT NULL,
  amount numeric NOT NULL,
  status text CHECK (status IN ('pending', 'paid')) DEFAULT 'pending' NOT NULL,
  description text,
  proof_photo_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  settled_at timestamp with time zone
);

-- 2. ENABLE ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 3. CREATE HELPER FUNCTION (SECURITY DEFINER to avoid recursion)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_group_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT group_id FROM group_members WHERE user_id = auth.uid();
$$;

-- 4. CREATE RLS POLICIES
-- ---------------------------------------------------------------------------

-- Profiles Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
CREATE POLICY "Public profiles are viewable by everyone."
  ON profiles FOR SELECT
  TO authenticated
  USING ( true );

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON profiles;
CREATE POLICY "Users can insert their own profile."
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK ( auth.uid() = id );

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON profiles;
CREATE POLICY "Users can update own profile."
  ON profiles FOR UPDATE
  TO authenticated
  USING ( auth.uid() = id );

-- Groups Policies
DROP POLICY IF EXISTS "Groups are viewable by members." ON public.groups;
DROP POLICY IF EXISTS "Groups are viewable by members." ON groups;
CREATE POLICY "Groups are viewable by members."
  ON groups FOR SELECT
  USING (
    id IN ( SELECT get_my_group_ids() )
  );

DROP POLICY IF EXISTS "Authenticated users can create groups." ON public.groups;
DROP POLICY IF EXISTS "Authenticated users can create groups." ON groups;
CREATE POLICY "Authenticated users can create groups."
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Group Members Policies
DROP POLICY IF EXISTS "Members can view other members in the same group." ON public.group_members;
DROP POLICY IF EXISTS "Members can view other members in the same group." ON group_members;
CREATE POLICY "Members can view other members in the same group."
  ON group_members FOR SELECT
  USING (
    group_id IN ( SELECT get_my_group_ids() )
  );

DROP POLICY IF EXISTS "Authenticated users can insert group members." ON public.group_members;
DROP POLICY IF EXISTS "Authenticated users can insert group members." ON group_members;
CREATE POLICY "Authenticated users can insert group members."
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Transactions Policies
DROP POLICY IF EXISTS "Users can view transactions involving them or their groups." ON public.transactions;
DROP POLICY IF EXISTS "Users can view transactions involving them or their groups." ON transactions;
CREATE POLICY "Users can view transactions involving them or their groups."
  ON transactions FOR SELECT
  USING (
    from_user_id = auth.uid() 
    OR to_user_id = auth.uid()
    OR group_id IN ( SELECT get_my_group_ids() )
  );

-- Delete / Update Policies (deleteGroup, leaveGroup, updateGroup features)
DROP POLICY IF EXISTS "groups_delete" ON public.groups;
DROP POLICY IF EXISTS "groups_delete" ON groups;
CREATE POLICY "groups_delete"
  ON groups FOR DELETE
  TO authenticated
  USING ( auth.uid() = created_by );

DROP POLICY IF EXISTS "Authenticated users can update their groups." ON public.groups;
DROP POLICY IF EXISTS "Authenticated users can update their groups." ON groups;
CREATE POLICY "Authenticated users can update their groups."
  ON groups FOR UPDATE
  TO authenticated
  USING ( created_by = auth.uid() );

DROP POLICY IF EXISTS "group_members_delete" ON public.group_members;
DROP POLICY IF EXISTS "group_members_delete" ON group_members;
CREATE POLICY "group_members_delete"
  ON group_members FOR DELETE
  TO authenticated
  USING (
    (auth.uid() = user_id)
    OR (auth.uid() = (SELECT groups.created_by FROM groups WHERE groups.id = group_members.group_id))
  );

DROP POLICY IF EXISTS "transactions_delete" ON public.transactions;
DROP POLICY IF EXISTS "transactions_delete" ON transactions;
CREATE POLICY "transactions_delete"
  ON transactions FOR DELETE
  TO authenticated
  USING (
    auth.uid() = (SELECT groups.created_by FROM groups WHERE groups.id = transactions.group_id)
  );

-- 5. CREATE RPC FUNCTIONS
-- ---------------------------------------------------------------------------

-- Function: join_group_by_code
CREATE OR REPLACE FUNCTION public.join_group_by_code(p_invite_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_group RECORD;
    v_attempt RECORD;
    v_max_attempts CONSTANT INTEGER := 20;
    v_window CONSTANT INTERVAL := '1 hour';
BEGIN
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Rate limit: max 20 guesses per user per hour
    SELECT * INTO v_attempt FROM invite_attempts WHERE user_id = v_user_id;
    IF v_attempt.user_id IS NOT NULL THEN
        IF v_attempt.window_start < now() - v_window THEN
            UPDATE invite_attempts
            SET attempt_count = 1, window_start = now()
            WHERE user_id = v_user_id;
        ELSIF v_attempt.attempt_count >= v_max_attempts THEN
            RETURN json_build_object('success', false, 'error', 'Too many attempts. Try again later.');
        ELSE
            UPDATE invite_attempts
            SET attempt_count = attempt_count + 1
            WHERE user_id = v_user_id;
        END IF;
    ELSE
        INSERT INTO invite_attempts (user_id, attempt_count) VALUES (v_user_id, 1);
    END IF;

    SELECT * INTO v_group FROM groups WHERE invite_code = upper(p_invite_code);
    IF v_group.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid invite code');
    END IF;

    IF EXISTS (SELECT 1 FROM group_members WHERE group_id = v_group.id AND user_id = v_user_id) THEN
        RETURN json_build_object('success', false, 'error', 'Already a member');
    END IF;

    INSERT INTO public.group_members (group_id, user_id)
    VALUES (v_group.id, v_user_id);

    RETURN json_build_object('success', true, 'group_id', v_group.id);
END;
$function$;

-- Function: log_failure (Updated with proof_photo_url)
CREATE OR REPLACE FUNCTION log_failure(p_group_id uuid, p_description text, p_proof_photo_url text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_penalty numeric;
  v_member_count integer;
  v_member record;
  v_tx_count integer := 0;
BEGIN
  v_user_id := auth.uid();
  
  -- Get penalty amount
  SELECT default_penalty_amount INTO v_penalty FROM public.groups WHERE id = p_group_id;
  
  -- Update failure count
  UPDATE public.group_members 
  SET failure_count = failure_count + 1,
      current_balance = current_balance - v_penalty
  WHERE group_id = p_group_id AND user_id = v_user_id;

  -- Find other members to pay
  FOR v_member IN SELECT user_id FROM public.group_members WHERE group_id = p_group_id AND user_id != v_user_id LOOP
    INSERT INTO public.transactions (group_id, from_user_id, to_user_id, amount, description, proof_photo_url)
    VALUES (p_group_id, v_user_id, v_member.user_id, v_penalty, p_description, p_proof_photo_url);
    
    -- Update recipient balance
    UPDATE public.group_members
    SET current_balance = current_balance + v_penalty
    WHERE group_id = p_group_id AND user_id = v_member.user_id;
    
    v_tx_count := v_tx_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'transactions_created', v_tx_count, 'total_debt', v_penalty * v_tx_count);
END;
$$;

-- Function: get_net_balance
CREATE OR REPLACE FUNCTION get_net_balance()
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT coalesce(sum(current_balance), 0)
  FROM public.group_members
  WHERE user_id = auth.uid();
$$;

-- Function: settle_debt
CREATE OR REPLACE FUNCTION settle_debt(p_transaction_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tx record;
BEGIN
  SELECT * INTO v_tx FROM public.transactions WHERE id = p_transaction_id;
  
  IF v_tx.status = 'paid' THEN
     RETURN json_build_object('success', false, 'error', 'Already paid');
  END IF;

  -- Mark as paid
  UPDATE public.transactions
  SET status = 'paid', settled_at = now()
  WHERE id = p_transaction_id;

  -- Adjust balances (reverse the debt)
  UPDATE public.group_members
  SET current_balance = current_balance + v_tx.amount
  WHERE group_id = v_tx.group_id AND user_id = v_tx.from_user_id;

  UPDATE public.group_members
  SET current_balance = current_balance - v_tx.amount
  WHERE group_id = v_tx.group_id AND user_id = v_tx.to_user_id;

  RETURN json_build_object('success', true);
END;
$$;

-- 6. USER MANAGEMENT TRIGGERS
-- ---------------------------------------------------------------------------

-- Function to handle new user creation (creates profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'name', 'User'), null)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. AUTO-CONFIRM EMAILS (DEV/TESTING)
-- ---------------------------------------------------------------------------

-- Auto-confirm all existing users
UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL;

-- Auto-confirm function for new users
CREATE OR REPLACE FUNCTION public.auto_confirm_email()
RETURNS trigger AS $$
BEGIN
  NEW.email_confirmed_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.auto_confirm_email();

-- 8. STORAGE SETUP
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('proof-photos', 'proof-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view proof photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view proof photos" ON storage.objects;
CREATE POLICY "Anyone can view proof photos"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'proof-photos' );

DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK ( bucket_id = 'proof-photos' );

DROP POLICY IF EXISTS "Users can update their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own photos" ON storage.objects;
CREATE POLICY "Users can update their own photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING ( bucket_id = 'proof-photos' );

DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;
CREATE POLICY "Users can delete their own photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING ( bucket_id = 'proof-photos' );

-- ===========================================================================
-- SETUP COMPLETE! You can now use the app.
-- ===========================================================================

-- ----------------------------------------------------------------------------
-- SOURCE: supabase/photo_proof_setup.sql
-- ----------------------------------------------------------------------------

-- ============================================
-- PHOTO PROOF FEATURE - Database Schema Update
-- ============================================
-- Run this SQL in your Supabase Dashboard > SQL Editor

-- 1. Add proof_photo_url column to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS proof_photo_url TEXT;

-- 2. Create storage bucket for proof photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('proof-photos', 'proof-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies for proof-photos bucket

-- Allow authenticated users to upload photos
DROP POLICY IF EXISTS "Users can upload proof photos" ON storage.objects;
CREATE POLICY "Users can upload proof photos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'proof-photos' 
    AND auth.role() = 'authenticated'
);

-- Allow public read access to proof photos
DROP POLICY IF EXISTS "Public read access for proof photos" ON storage.objects;
CREATE POLICY "Public read access for proof photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'proof-photos');

-- Allow users to delete their own photos
DROP POLICY IF EXISTS "Users can delete own proof photos" ON storage.objects;
CREATE POLICY "Users can delete own proof photos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'proof-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Update the log_failure function to accept proof_photo_url
CREATE OR REPLACE FUNCTION log_failure(
    p_group_id UUID,
    p_description TEXT DEFAULT NULL,
    p_proof_photo_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_penalty DECIMAL(10,2);
    v_member RECORD;
    v_tx_count INTEGER := 0;
    v_total_debt DECIMAL(10,2) := 0;
BEGIN
    -- Get the current user
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Get the penalty amount for this group
    SELECT default_penalty_amount INTO v_penalty
    FROM groups
    WHERE id = p_group_id;
    
    IF v_penalty IS NULL THEN
        RAISE EXCEPTION 'Group not found';
    END IF;
    
    -- Create a transaction for each OTHER member
    FOR v_member IN
        SELECT user_id FROM group_members
        WHERE group_id = p_group_id AND user_id != v_user_id
    LOOP
        INSERT INTO transactions (
            group_id,
            from_user_id,
            to_user_id,
            amount,
            description,
            status,
            proof_photo_url
        ) VALUES (
            p_group_id,
            v_user_id,
            v_member.user_id,
            v_penalty,
            COALESCE(p_description, 'Logged failure'),
            'pending',
            p_proof_photo_url
        );
        
        v_tx_count := v_tx_count + 1;
        v_total_debt := v_total_debt + v_penalty;
    END LOOP;
    
    -- Update failure count for the user
    UPDATE group_members
    SET failure_count = failure_count + 1
    WHERE group_id = p_group_id AND user_id = v_user_id;
    
    -- Update balances
    -- Decrease failing user's balance
    UPDATE group_members
    SET current_balance = current_balance - v_total_debt
    WHERE group_id = p_group_id AND user_id = v_user_id;
    
    -- Increase each other member's balance
    UPDATE group_members
    SET current_balance = current_balance + v_penalty
    WHERE group_id = p_group_id AND user_id != v_user_id;
    
    RETURN json_build_object(
        'success', true,
        'transactions_created', v_tx_count,
        'total_debt', v_total_debt
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION log_failure(UUID, TEXT, TEXT) TO authenticated;

-- ============================================
-- DONE! Photo proof feature database ready.
-- ============================================

-- ----------------------------------------------------------------------------
-- SOURCE: supabase/scheduled_goals_setup.sql
-- ----------------------------------------------------------------------------

-- ============================================
-- SCHEDULED GOALS FEATURE - Database Schema
-- ============================================
-- Run this SQL in your Supabase Dashboard > SQL Editor

-- 1. Create goals table
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    emoji TEXT DEFAULT '🎯',
    goal_type TEXT DEFAULT 'frequency' CHECK (goal_type IN ('frequency', 'daily', 'weekly')),
    frequency_days INTEGER DEFAULT 1, -- e.g., 3 = "at least once every 3 days"
    penalty_amount DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create goal completions table
CREATE TABLE IF NOT EXISTS goal_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    proof_photo_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_goals_group_id ON goals(group_id);
CREATE INDEX IF NOT EXISTS idx_goals_created_by ON goals(created_by);
CREATE INDEX IF NOT EXISTS idx_goal_completions_goal_id ON goal_completions(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_completions_user_id ON goal_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_completions_completed_at ON goal_completions(completed_at);

-- 4. Enable RLS on goals
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for goals
DROP POLICY IF EXISTS "Users can view goals in their groups" ON goals;
CREATE POLICY "Users can view goals in their groups"
ON goals FOR SELECT
USING (
    group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Group members can create goals" ON goals;
CREATE POLICY "Group members can create goals"
ON goals FOR INSERT
WITH CHECK (
    group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "Goal creator can update goal" ON goals;
CREATE POLICY "Goal creator can update goal"
ON goals FOR UPDATE
USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Goal creator can delete goal" ON goals;
CREATE POLICY "Goal creator can delete goal"
ON goals FOR DELETE
USING (created_by = auth.uid());

-- 5. Enable RLS on goal_completions
ALTER TABLE goal_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for goal_completions
DROP POLICY IF EXISTS "Users can view completions for goals in their groups" ON goal_completions;
CREATE POLICY "Users can view completions for goals in their groups"
ON goal_completions FOR SELECT
USING (
    goal_id IN (
        SELECT g.id FROM goals g
        JOIN group_members gm ON g.group_id = gm.group_id
        WHERE gm.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can log their own completions" ON goal_completions;
CREATE POLICY "Users can log their own completions"
ON goal_completions FOR INSERT
WITH CHECK (
    user_id = auth.uid()
    AND goal_id IN (
        SELECT g.id FROM goals g
        JOIN group_members gm ON g.group_id = gm.group_id
        WHERE gm.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can delete their own completions" ON goal_completions;
CREATE POLICY "Users can delete their own completions"
ON goal_completions FOR DELETE
USING (user_id = auth.uid());

-- 6. Function to check if user is on track with a goal
CREATE OR REPLACE FUNCTION check_goal_status(
    p_goal_id UUID,
    p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_goal RECORD;
    v_last_completion TIMESTAMPTZ;
    v_deadline TIMESTAMPTZ;
    v_is_overdue BOOLEAN;
    v_days_remaining INTEGER;
    v_completion_count INTEGER;
BEGIN
    -- Get the goal
    SELECT * INTO v_goal FROM goals WHERE id = p_goal_id;
    
    IF v_goal IS NULL THEN
        RETURN json_build_object('error', 'Goal not found');
    END IF;
    
    -- Get last completion for this user
    SELECT completed_at INTO v_last_completion
    FROM goal_completions
    WHERE goal_id = p_goal_id AND user_id = p_user_id
    ORDER BY completed_at DESC
    LIMIT 1;
    
    -- Calculate deadline based on frequency
    IF v_last_completion IS NULL THEN
        -- If never completed, deadline is from when they joined
        SELECT joined_at + (v_goal.frequency_days || ' days')::INTERVAL INTO v_deadline
        FROM group_members gm
        JOIN goals g ON g.group_id = gm.group_id
        WHERE g.id = p_goal_id AND gm.user_id = p_user_id;
    ELSE
        v_deadline := v_last_completion + (v_goal.frequency_days || ' days')::INTERVAL;
    END IF;
    
    v_is_overdue := v_deadline < NOW();
    v_days_remaining := EXTRACT(DAY FROM v_deadline - NOW())::INTEGER;
    
    -- Get total completion count
    SELECT COUNT(*) INTO v_completion_count
    FROM goal_completions
    WHERE goal_id = p_goal_id AND user_id = p_user_id;
    
    RETURN json_build_object(
        'goal_id', p_goal_id,
        'user_id', p_user_id,
        'last_completion', v_last_completion,
        'next_deadline', v_deadline,
        'is_overdue', v_is_overdue,
        'days_remaining', v_days_remaining,
        'total_completions', v_completion_count
    );
END;
$$;

-- 7. Function to log a goal completion
CREATE OR REPLACE FUNCTION log_goal_completion(
    p_goal_id UUID,
    p_proof_photo_url TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_completion_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Verify user is member of the goal's group
    IF NOT EXISTS (
        SELECT 1 FROM goals g
        JOIN group_members gm ON g.group_id = gm.group_id
        WHERE g.id = p_goal_id AND gm.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'You are not a member of this goal''s group';
    END IF;
    
    -- Insert completion
    INSERT INTO goal_completions (goal_id, user_id, proof_photo_url, notes)
    VALUES (p_goal_id, v_user_id, p_proof_photo_url, p_notes)
    RETURNING id INTO v_completion_id;
    
    RETURN json_build_object(
        'success', true,
        'completion_id', v_completion_id
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_goal_status(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_goal_completion(UUID, TEXT, TEXT) TO authenticated;

-- ============================================
-- DONE! Scheduled goals database ready.
-- ============================================

-- ----------------------------------------------------------------------------
-- SOURCE: supabase/group_chat_setup.sql
-- ----------------------------------------------------------------------------

-- ============================================
-- GROUP CHAT FEATURE - Database Schema
-- ============================================
-- Run this SQL in your Supabase Dashboard > SQL Editor

-- 1. Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'system')),
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_group_id ON messages(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);

-- 3. Enable RLS on messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for messages

-- Users can view messages in their groups
DROP POLICY IF EXISTS "Users can view messages in their groups" ON messages;
CREATE POLICY "Users can view messages in their groups"
ON messages FOR SELECT
USING (
    group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
);

-- Users can send messages to their groups
DROP POLICY IF EXISTS "Users can send messages to their groups" ON messages;
CREATE POLICY "Users can send messages to their groups"
ON messages FOR INSERT
WITH CHECK (
    user_id = auth.uid()
    AND group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
);

-- Users can delete their own messages
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
CREATE POLICY "Users can delete their own messages"
ON messages FOR DELETE
USING (user_id = auth.uid());

-- 5. Enable realtime for messages table
-- Note: You may need to enable this in Supabase Dashboard > Database > Replication
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ============================================
-- DONE! Group chat database ready.
-- ============================================

-- ----------------------------------------------------------------------------
-- SOURCE: supabase/auto_failure_setup.sql
-- ----------------------------------------------------------------------------

-- ============================================
-- AUTO-FAILURE FOR OVERDUE GOALS
-- ============================================
-- Run this SQL in your Supabase Dashboard > SQL Editor

-- 1. Create table to track processed failures (prevents double-charging)
CREATE TABLE IF NOT EXISTS goal_failures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    deadline_date DATE NOT NULL,
    penalty_applied NUMERIC NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(goal_id, user_id, deadline_date)
);

-- 2. Enable RLS
ALTER TABLE goal_failures ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policy - Users can view their own failures
DROP POLICY IF EXISTS "Users can view their own goal failures" ON goal_failures;
CREATE POLICY "Users can view their own goal failures"
ON goal_failures FOR SELECT
USING (user_id = auth.uid());

-- 4. Function to check and process overdue goals for a user in a group
CREATE OR REPLACE FUNCTION public.process_overdue_goals(p_group_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_goal RECORD;
    v_last_completion TIMESTAMPTZ;
    v_deadline DATE;
    v_penalty NUMERIC;
    v_member_count INTEGER;
    v_member RECORD;
    v_failures_processed INTEGER := 0;
    v_total_penalty NUMERIC := 0;
    v_periods_checked INTEGER := 0;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Membership guard: caller must belong to the group
    IF NOT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = p_group_id AND user_id = v_user_id
    ) THEN
        RETURN json_build_object('success', false, 'error', 'You are not a member of this group');
    END IF;

    -- Get member count (excluding current user)
    SELECT COUNT(*) INTO v_member_count
    FROM group_members
    WHERE group_id = p_group_id AND user_id != v_user_id;

    -- If no other members, no penalties to distribute
    IF v_member_count = 0 THEN
        RETURN json_build_object('success', true, 'failures_processed', 0, 'message', 'No other members to pay');
    END IF;

    -- Loop through all active goals in the group
    FOR v_goal IN
        SELECT * FROM goals
        WHERE group_id = p_group_id AND is_active = true
          AND (COALESCE(is_paused, false) = false OR (paused_until IS NOT NULL AND paused_until <= now()))
    LOOP
        -- Get user's last completion for this goal
        SELECT MAX(completed_at) INTO v_last_completion
        FROM goal_completions
        WHERE goal_id = v_goal.id AND user_id = v_user_id;

        -- Calculate the deadline based on last completion or goal creation
        IF v_last_completion IS NOT NULL THEN
            v_deadline := (v_last_completion + (v_goal.frequency_days || ' days')::INTERVAL)::DATE;
        ELSE
            -- First deadline is frequency_days after goal creation
            v_deadline := (v_goal.created_at + (v_goal.frequency_days || ' days')::INTERVAL)::DATE;
        END IF;

        -- Process at most the 4 most recent missed periods per goal per call
        -- (bounds work for long-dormant goals; older periods get caught on
        --  subsequent calls or by the scheduled server-side job)
        v_periods_checked := 0;

        WHILE v_deadline < CURRENT_DATE AND v_periods_checked < 4 LOOP
            v_periods_checked := v_periods_checked + 1;

            -- Check if we already processed this failure
            IF NOT EXISTS (
                SELECT 1 FROM goal_failures
                WHERE goal_id = v_goal.id
                AND user_id = v_user_id
                AND deadline_date = v_deadline
            ) THEN
                -- Check if there was a completion before this deadline
                IF NOT EXISTS (
                    SELECT 1 FROM goal_completions
                    WHERE goal_id = v_goal.id
                    AND user_id = v_user_id
                    AND completed_at::DATE <= v_deadline
                    AND (v_last_completion IS NULL OR completed_at::DATE > (v_deadline - (v_goal.frequency_days || ' days')::INTERVAL)::DATE)
                ) THEN
                    -- No completion for this period - CREATE FAILURE
                    v_penalty := v_goal.penalty_amount;

                    -- Record the failure
                    INSERT INTO goal_failures (goal_id, user_id, deadline_date, penalty_applied)
                    VALUES (v_goal.id, v_user_id, v_deadline, v_penalty);

                    -- Create transactions to other members
                    FOR v_member IN
                        SELECT user_id FROM group_members
                        WHERE group_id = p_group_id AND user_id != v_user_id
                    LOOP
                        INSERT INTO transactions (
                            group_id,
                            from_user_id,
                            to_user_id,
                            amount,
                            description,
                            status
                        )
                        VALUES (
                            p_group_id,
                            v_user_id,
                            v_member.user_id,
                            v_penalty,
                            'Missed goal: ' || v_goal.emoji || ' ' || v_goal.name || ' (due ' || v_deadline || ')',
                            'pending'
                        );

                        -- Update balances
                        UPDATE group_members
                        SET current_balance = current_balance - v_penalty
                        WHERE group_id = p_group_id AND user_id = v_user_id;

                        UPDATE group_members
                        SET current_balance = current_balance + v_penalty
                        WHERE group_id = p_group_id AND user_id = v_member.user_id;
                    END LOOP;

                    -- One failure per missed period, not one per member
                    UPDATE group_members
                    SET failure_count = failure_count + 1
                    WHERE group_id = p_group_id AND user_id = v_user_id;

                    v_failures_processed := v_failures_processed + 1;
                    v_total_penalty := v_total_penalty + (v_penalty * v_member_count);
                END IF;
            END IF;

            -- Move to next deadline period
            v_deadline := v_deadline + (v_goal.frequency_days || ' days')::INTERVAL;
        END LOOP;
    END LOOP;

    RETURN json_build_object(
        'success', true,
        'failures_processed', v_failures_processed,
        'total_penalty', v_total_penalty
    );
END;
$function$;


-- ============================================
-- DONE! Auto-failure system ready.
-- This function should be called when a user opens a group.
-- ============================================

-- ----------------------------------------------------------------------------
-- SOURCE: supabase/enhanced_goals_setup.sql
-- ----------------------------------------------------------------------------

-- ============================================
-- ENHANCED GOALS - Positive & Negative Reinforcement
-- ============================================
-- Run this SQL in your Supabase Dashboard > SQL Editor
-- This updates the existing goals system

-- 1. Add new columns to goals table
ALTER TABLE goals 
ADD COLUMN IF NOT EXISTS goal_mode TEXT DEFAULT 'positive' CHECK (goal_mode IN ('positive', 'negative')),
ADD COLUMN IF NOT EXISTS target_per_week INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS week_start_day INTEGER DEFAULT 1; -- 1 = Monday

-- Update existing goals to be 'positive' mode
UPDATE goals SET goal_mode = 'positive' WHERE goal_mode IS NULL;

-- 2. Add column to goal_completions for negative mode count tracking
-- For negative goals, each completion represents one occurrence (e.g., 1 cigarette)
-- The count column can be used if user wants to log multiple at once
ALTER TABLE goal_completions
ADD COLUMN IF NOT EXISTS occurrence_count INTEGER DEFAULT 1;

-- 3. Function to get weekly stats for a goal (last 7 days by member)
--    p_tz_offset_minutes: the CALLER's UTC offset in minutes (e.g. -360 for
--    Mexico City), so completions bucket on the client's local calendar day
--    instead of the DB's UTC date (M4). Defaults to UTC for old callers.
CREATE OR REPLACE FUNCTION get_goal_weekly_stats(
    p_goal_id UUID,
    p_tz_offset_minutes INTEGER DEFAULT 0
)
RETURNS TABLE (
    user_id UUID,
    user_name TEXT,
    day_date DATE,
    completion_count INTEGER,
    has_photo BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today_local DATE;
    v_group_id UUID;
BEGIN
    -- M5: SECURITY DEFINER must not let non-members read another group's
    -- goal stats — check the caller is a member of the goal's group.
    SELECT g.group_id INTO v_group_id FROM goals g WHERE g.id = p_goal_id;
    IF v_group_id IS NULL THEN
        RETURN;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM group_members gm
        WHERE gm.group_id = v_group_id AND gm.user_id = auth.uid()
    ) THEN
        RETURN;
    END IF;

    -- M4: "today" in the caller's local timezone.
    v_today_local := (now() AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE;

    RETURN QUERY
    SELECT 
        gc.user_id,
        p.name as user_name,
        (gc.completed_at AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE as day_date,
        COALESCE(SUM(gc.occurrence_count)::INTEGER, 0) as completion_count,
        BOOL_OR(gc.proof_photo_url IS NOT NULL) as has_photo
    FROM goal_completions gc
    JOIN profiles p ON p.id = gc.user_id
    WHERE gc.goal_id = p_goal_id
    AND (gc.completed_at AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE >= v_today_local - INTERVAL '6 days'
    GROUP BY gc.user_id, p.name, (gc.completed_at AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE
    ORDER BY (gc.completed_at AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE;
END;
$$;

-- 4. Function to calculate performance percentage for a positive goal (current week Mon-Sun)
--    p_tz_offset_minutes shifts the week boundary to the caller's local timezone (M4).
CREATE OR REPLACE FUNCTION get_goal_performance(
    p_goal_id UUID,
    p_tz_offset_minutes INTEGER DEFAULT 0
)
RETURNS TABLE (
    user_id UUID,
    user_name TEXT,
    completions_this_week INTEGER,
    target_completions INTEGER,
    percentage NUMERIC,
    is_on_track BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_goal RECORD;
    v_week_start DATE;
BEGIN
    -- Get goal details
    SELECT * INTO v_goal FROM goals WHERE id = p_goal_id;
    
    IF v_goal IS NULL THEN
        RETURN;
    END IF;

    -- M5: SECURITY DEFINER must not leak other groups' stats to non-members.
    IF NOT EXISTS (
        SELECT 1 FROM group_members gm
        WHERE gm.group_id = v_goal.group_id AND gm.user_id = auth.uid()
    ) THEN
        RETURN;
    END IF;
    
    -- M4: start of the caller's local week (Monday), not the DB's UTC Monday.
    v_week_start := date_trunc(
        'week',
        now() AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes)
    )::DATE;
    
    -- Calculate target based on goal type
    -- If target_per_week is set, use it; otherwise calculate from frequency_days
    
    RETURN QUERY
    SELECT 
        gm.user_id,
        p.name as user_name,
        COALESCE((
            SELECT SUM(gc.occurrence_count)::INTEGER
            FROM goal_completions gc
            WHERE gc.goal_id = p_goal_id
            AND gc.user_id = gm.user_id
            AND (gc.completed_at AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE >= v_week_start
        ), 0) as completions_this_week,
        COALESCE(v_goal.target_per_week, GREATEST(7 / v_goal.frequency_days, 1))::INTEGER as target_completions,
        CASE 
            WHEN COALESCE(v_goal.target_per_week, GREATEST(7 / v_goal.frequency_days, 1)) = 0 THEN 0
            ELSE LEAST(100, ROUND(
                COALESCE((
                    SELECT SUM(gc.occurrence_count)
                    FROM goal_completions gc
                    WHERE gc.goal_id = p_goal_id
                    AND gc.user_id = gm.user_id
                    AND (gc.completed_at AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE >= v_week_start
                ), 0)::NUMERIC / 
                COALESCE(v_goal.target_per_week, GREATEST(7 / v_goal.frequency_days, 1))::NUMERIC * 100
            , 0))
        END as percentage,
        COALESCE((
            SELECT SUM(gc.occurrence_count)
            FROM goal_completions gc
            WHERE gc.goal_id = p_goal_id
            AND gc.user_id = gm.user_id
            AND (gc.completed_at AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE >= v_week_start
        ), 0) >= COALESCE(v_goal.target_per_week, GREATEST(7 / v_goal.frequency_days, 1)) as is_on_track
    FROM group_members gm
    JOIN profiles p ON p.id = gm.user_id
    WHERE gm.group_id = v_goal.group_id
    ORDER BY percentage DESC;
END;
$$;

-- 5. Function to log negative occurrence (quick tap, optional penalty)
CREATE OR REPLACE FUNCTION public.log_negative_occurrence(p_goal_id uuid, p_count integer DEFAULT 1)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_goal RECORD;
    v_penalty NUMERIC;
    v_member RECORD;
    v_member_count INTEGER;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    IF p_count < 1 OR p_count > 50 THEN
        RETURN json_build_object('success', false, 'error', 'Count must be between 1 and 50');
    END IF;

    -- Get goal details
    SELECT * INTO v_goal FROM goals WHERE id = p_goal_id;

    IF v_goal IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Goal not found');
    END IF;

    -- Membership guard: caller must belong to the goal's group
    IF NOT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = v_goal.group_id AND user_id = v_user_id
    ) THEN
        RETURN json_build_object('success', false, 'error', 'You are not a member of this goal''s group');
    END IF;

    IF v_goal.goal_mode != 'negative' THEN
        RETURN json_build_object('success', false, 'error', 'This is not a negative tracking goal');
    END IF;

    -- Log the occurrence
    INSERT INTO goal_completions (goal_id, user_id, occurrence_count)
    VALUES (p_goal_id, v_user_id, p_count);

    -- Apply penalty if set
    v_penalty := v_goal.penalty_amount * p_count;

    IF v_penalty > 0 THEN
        -- Get member count
        SELECT COUNT(*) INTO v_member_count
        FROM group_members
        WHERE group_id = v_goal.group_id AND user_id != v_user_id;

        IF v_member_count > 0 THEN
            -- Create transactions
            FOR v_member IN
                SELECT user_id FROM group_members
                WHERE group_id = v_goal.group_id AND user_id != v_user_id
            LOOP
                INSERT INTO transactions (
                    group_id, from_user_id, to_user_id, amount, description, status
                )
                VALUES (
                    v_goal.group_id,
                    v_user_id,
                    v_member.user_id,
                    v_penalty,
                    v_goal.emoji || ' ' || v_goal.name || ' x' || p_count,
                    'pending'
                );

                -- Update balances
                UPDATE group_members
                SET current_balance = current_balance - v_penalty
                WHERE group_id = v_goal.group_id AND user_id = v_user_id;

                UPDATE group_members
                SET current_balance = current_balance + v_penalty
                WHERE group_id = v_goal.group_id AND user_id = v_member.user_id;
            END LOOP;

            -- One failure per slip-up, not one per member
            UPDATE group_members
            SET failure_count = failure_count + 1
            WHERE group_id = v_goal.group_id AND user_id = v_user_id;
        END IF;
    END IF;

    RETURN json_build_object(
        'success', true,
        'count', p_count,
        'penalty_applied', v_penalty
    );
END;
$function$;


-- ============================================
-- DONE! Enhanced goals system ready.
-- ============================================

-- ----------------------------------------------------------------------------
-- SOURCE: supabase/migrations/007_activity_log_and_enhancements.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- MIGRATION 007: Activity Log and Goal Enhancements
-- Run this AFTER full_setup.sql
-- ============================================================================

-- ============================================================================
-- 1. ACTIVITY LOG TABLE - Unified event tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'goal_completed',
        'goal_failed', 
        'goal_created',
        'goal_deleted',
        'failure_logged',
        'debt_settled',
        'member_joined',
        'member_left',
        'group_created',
        'streak_achieved',
        'streak_broken',
        'comment_added'
    )),
    related_id UUID, -- Can reference goals, transactions, etc.
    related_type TEXT, -- 'goal', 'transaction', 'completion', etc.
    metadata JSONB DEFAULT '{}', -- Flexible extra data
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_activity_log_group ON activity_log(group_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON activity_log(event_type);

-- RLS for activity_log
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view activity in their groups" ON activity_log;
CREATE POLICY "Users can view activity in their groups" ON activity_log
    FOR SELECT USING (
        group_id IN (
            SELECT group_id FROM group_members WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "System can insert activity" ON activity_log;
CREATE POLICY "System can insert activity" ON activity_log
    FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 2. GOAL ENHANCEMENTS - Add new columns to goals table
-- ============================================================================

-- Add streak tracking columns
ALTER TABLE goals ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS streak_broken_at TIMESTAMPTZ;

-- Add photo proof requirement
ALTER TABLE goals ADD COLUMN IF NOT EXISTS requires_proof BOOLEAN DEFAULT FALSE;

-- Add category and tags
ALTER TABLE goals ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'custom' CHECK (
    category IN ('fitness', 'health', 'productivity', 'finance', 'mindfulness', 'social', 'custom')
);
ALTER TABLE goals ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Add goal pausing support
ALTER TABLE goals ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS paused_until TIMESTAMPTZ;

-- Add penalty escalation
ALTER TABLE goals ADD COLUMN IF NOT EXISTS penalty_escalation_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS penalty_escalation_rate DECIMAL(4,2) DEFAULT 1.5; -- 1.5x multiplier
ALTER TABLE goals ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0;

-- ============================================================================
-- 3. GOAL COMMENTS TABLE - Peer encouragement
-- ============================================================================

CREATE TABLE IF NOT EXISTS goal_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    completion_id UUID NOT NULL REFERENCES goal_completions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (length(content) <= 500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goal_comments_completion ON goal_comments(completion_id);

ALTER TABLE goal_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view comments in their groups" ON goal_comments;
CREATE POLICY "Users can view comments in their groups" ON goal_comments
    FOR SELECT USING (
        completion_id IN (
            SELECT gc.id FROM goal_completions gc
            JOIN goals g ON gc.goal_id = g.id
            WHERE g.group_id IN (
                SELECT group_id FROM group_members WHERE user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert comments" ON goal_comments;
CREATE POLICY "Users can insert comments" ON goal_comments
    FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own comments" ON goal_comments;
CREATE POLICY "Users can delete own comments" ON goal_comments
    FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- 4. USER BADGES/ACHIEVEMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    badge_type TEXT NOT NULL CHECK (badge_type IN (
        'first_completion',
        'week_streak',
        'month_streak',
        'perfect_week',
        'perfect_month',
        'top_performer',
        'consistency_king',
        'early_bird',
        'night_owl'
    )),
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_group ON user_badges(group_id);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view badges in their groups" ON user_badges;
CREATE POLICY "Users can view badges in their groups" ON user_badges
    FOR SELECT USING (
        group_id IN (
            SELECT group_id FROM group_members WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- 5. GOAL TEMPLATES TABLE - Predefined goal templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS goal_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    emoji TEXT NOT NULL,
    category TEXT NOT NULL,
    goal_type TEXT NOT NULL DEFAULT 'frequency',
    goal_mode TEXT NOT NULL DEFAULT 'positive',
    suggested_frequency_days INTEGER DEFAULT 1,
    suggested_target_per_week INTEGER,
    suggested_penalty DECIMAL(10,2) DEFAULT 1.00,
    is_featured BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert popular templates
INSERT INTO goal_templates (name, description, emoji, category, goal_mode, suggested_frequency_days, suggested_target_per_week, suggested_penalty) VALUES
    ('Daily Exercise', 'Get at least 30 minutes of exercise', '💪', 'fitness', 'positive', 1, 7, 5.00),
    ('Gym Session', 'Hit the gym for a workout', '🏋️', 'fitness', 'positive', 2, 3, 10.00),
    ('Morning Run', 'Start the day with a run', '🏃', 'fitness', 'positive', 2, 3, 5.00),
    ('Meditation', 'Practice mindfulness meditation', '🧘', 'mindfulness', 'positive', 1, 7, 2.00),
    ('Read 10 Pages', 'Read at least 10 pages of a book', '📚', 'productivity', 'positive', 1, 7, 3.00),
    ('Drink 2L Water', 'Stay hydrated throughout the day', '💧', 'health', 'positive', 1, 7, 2.00),
    ('8 Hours Sleep', 'Get a full night of rest', '😴', 'health', 'positive', 1, 7, 5.00),
    ('Healthy Meal', 'Eat a nutritious home-cooked meal', '🥗', 'health', 'positive', 1, 7, 3.00),
    ('No Smoking', 'Avoid cigarettes all day', '🚭', 'health', 'negative', 1, NULL, 10.00),
    ('No Alcohol', 'Stay sober for the day', '🍺', 'health', 'negative', 1, NULL, 10.00),
    ('No Junk Food', 'Avoid processed/fast food', '🍕', 'health', 'negative', 1, NULL, 5.00),
    ('No Social Media', 'Limit social media usage', '📱', 'productivity', 'negative', 1, NULL, 5.00),
    ('No Gaming', 'Avoid video games', '🎮', 'productivity', 'negative', 1, NULL, 5.00),
    ('Early Wake Up', 'Wake up before 7 AM', '🌅', 'productivity', 'positive', 1, 7, 5.00),
    ('Journal Entry', 'Write in your journal', '✍️', 'mindfulness', 'positive', 1, 7, 2.00),
    ('Clean Room', 'Tidy up your living space', '🧹', 'productivity', 'positive', 3, 2, 3.00),
    ('Take Vitamins', 'Remember daily supplements', '💊', 'health', 'positive', 1, 7, 1.00),
    ('Call Family', 'Stay connected with loved ones', '📞', 'social', 'positive', 7, 1, 5.00),
    ('Save Money', 'No unnecessary purchases today', '💰', 'finance', 'negative', 1, NULL, 5.00),
    ('10K Steps', 'Walk 10,000 steps', '👣', 'fitness', 'positive', 1, 7, 5.00)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to log activity
CREATE OR REPLACE FUNCTION log_activity(
    p_group_id UUID,
    p_user_id UUID,
    p_event_type TEXT,
    p_related_id UUID DEFAULT NULL,
    p_related_type TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_activity_id UUID;
BEGIN
    INSERT INTO activity_log (group_id, user_id, event_type, related_id, related_type, metadata)
    VALUES (p_group_id, p_user_id, p_event_type, p_related_id, p_related_type, p_metadata)
    RETURNING id INTO v_activity_id;
    
    RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update streak on completion
-- p_completion_id lets the trigger exclude the row that fired it, so
-- same-day duplicates (1-tap complete + photo-proof path both insert) do not
-- each advance the streak — they used to add one phantom day per extra
-- completion, inflating current AND longest streaks (live-confirmed: a goal
-- with a real 5-day streak showed 'Best streak: 8').
CREATE OR REPLACE FUNCTION update_goal_streak(
    p_goal_id UUID,
    p_user_id UUID,
    p_completion_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_goal RECORD;
    v_last_completion TIMESTAMPTZ;
    v_streak_continued BOOLEAN;
    v_new_streak INTEGER;
    v_result JSONB;
    v_already_today BOOLEAN;
BEGIN
    -- Get goal details
    SELECT * INTO v_goal FROM goals WHERE id = p_goal_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Goal not found');
    END IF;

    -- Only the FIRST completion of a calendar day may advance the streak.
    SELECT EXISTS (
        SELECT 1 FROM goal_completions
        WHERE goal_id = p_goal_id
          AND user_id = p_user_id
          AND completed_at >= CURRENT_DATE
          AND (p_completion_id IS NULL OR id != p_completion_id)
    ) INTO v_already_today;

    IF v_already_today THEN
        -- Same-day duplicate: streak stays where it is.
        v_new_streak := GREATEST(COALESCE(v_goal.current_streak, 0), 1);
        v_streak_continued := true;
    ELSE
        -- Get last completion before today
        SELECT completed_at INTO v_last_completion
        FROM goal_completions
        WHERE goal_id = p_goal_id 
          AND user_id = p_user_id
          AND completed_at < CURRENT_DATE
        ORDER BY completed_at DESC
        LIMIT 1;
        
        -- Determine if streak continues
        IF v_last_completion IS NULL THEN
            -- First completion ever
            v_new_streak := 1;
            v_streak_continued := false;
        ELSIF (CURRENT_DATE - v_last_completion::DATE) <= v_goal.frequency_days THEN
            -- Streak continues
            v_new_streak := COALESCE(v_goal.current_streak, 0) + 1;
            v_streak_continued := true;
        ELSE
            -- Streak broken, starting fresh
            v_new_streak := 1;
            v_streak_continued := false;
        END IF;
    END IF;
    
    -- Update goal with new streak
    UPDATE goals 
    SET 
        current_streak = v_new_streak,
        longest_streak = GREATEST(COALESCE(longest_streak, 0), v_new_streak),
        consecutive_failures = 0, -- Reset failures on success
        updated_at = NOW()
    WHERE id = p_goal_id;
    
    -- Log streak achievement if milestone reached
    IF v_new_streak IN (7, 30, 100, 365) THEN
        PERFORM log_activity(
            v_goal.group_id,
            p_user_id,
            'streak_achieved',
            p_goal_id,
            'goal',
            jsonb_build_object('streak_days', v_new_streak, 'goal_name', v_goal.name)
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'new_streak', v_new_streak,
        'longest_streak', GREATEST(COALESCE(v_goal.longest_streak, 0), v_new_streak),
        'streak_continued', v_streak_continued
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get leaderboard
CREATE OR REPLACE FUNCTION get_group_leaderboard(
    p_group_id UUID,
    p_period TEXT DEFAULT 'week' -- 'week', 'month', 'all'
) RETURNS TABLE (
    user_id UUID,
    user_name TEXT,
    avatar_url TEXT,
    completions_count INTEGER,
    streak_days INTEGER,
    failure_count INTEGER,
    score INTEGER
) AS $$
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
    GROUP BY gm.user_id, p.name, p.avatar_url, comp.completion_count, gm.failure_count
    ORDER BY score DESC, completions_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to pause/unpause a goal
CREATE OR REPLACE FUNCTION toggle_goal_pause(
    p_goal_id UUID,
    p_pause BOOLEAN,
    p_until TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_goal RECORD;
BEGIN
    SELECT * INTO v_goal FROM goals WHERE id = p_goal_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Goal not found');
    END IF;
    
    -- Check ownership
    IF v_goal.created_by != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    UPDATE goals
    SET 
        is_paused = p_pause,
        paused_at = CASE WHEN p_pause THEN NOW() ELSE NULL END,
        paused_until = CASE WHEN p_pause THEN p_until ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_goal_id;
    
    RETURN jsonb_build_object('success', true, 'is_paused', p_pause);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. TRIGGERS FOR AUTOMATIC ACTIVITY LOGGING
-- ============================================================================

-- Trigger for goal completion logging
CREATE OR REPLACE FUNCTION log_completion_activity() RETURNS TRIGGER AS $$
DECLARE
    v_goal RECORD;
BEGIN
    SELECT * INTO v_goal FROM goals WHERE id = NEW.goal_id;
    
    PERFORM log_activity(
        v_goal.group_id,
        NEW.user_id,
        'goal_completed',
        NEW.id,
        'completion',
        jsonb_build_object(
            'goal_name', v_goal.name,
            'goal_emoji', v_goal.emoji,
            'has_proof', NEW.proof_photo_url IS NOT NULL
        )
    );
    
    -- Update streak (pass the new row's id so same-day duplicate
    -- completions don't each advance the streak)
    PERFORM update_goal_streak(NEW.goal_id, NEW.user_id, NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_completion ON goal_completions;
CREATE TRIGGER trigger_log_completion
    AFTER INSERT ON goal_completions
    FOR EACH ROW
    EXECUTE FUNCTION log_completion_activity();

-- Trigger for member joining
CREATE OR REPLACE FUNCTION log_member_joined() RETURNS TRIGGER AS $$
DECLARE
    v_user_name TEXT;
BEGIN
    SELECT name INTO v_user_name FROM profiles WHERE id = NEW.user_id;
    
    PERFORM log_activity(
        NEW.group_id,
        NEW.user_id,
        'member_joined',
        NEW.id,
        'member',
        jsonb_build_object('member_name', v_user_name)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_member_joined ON group_members;
CREATE TRIGGER trigger_member_joined
    AFTER INSERT ON group_members
    FOR EACH ROW
    EXECUTE FUNCTION log_member_joined();

COMMIT;

-- ----------------------------------------------------------------------------
-- SOURCE: supabase/migrations/008_missing_activity_triggers.sql
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- SOURCE: supabase/migrations/010_rls_and_server_fixes.sql
-- ----------------------------------------------------------------------------

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
DROP POLICY IF EXISTS "Group members can view goals" ON goals;
CREATE POLICY "Group members can view goals"
  ON goals FOR SELECT
  USING ( group_id IN ( SELECT get_my_group_ids() ) );

DROP POLICY IF EXISTS "Authenticated users can create goals" ON public.goals;
DROP POLICY IF EXISTS "Authenticated users can create goals" ON goals;
CREATE POLICY "Authenticated users can create goals"
  ON goals FOR INSERT
  TO authenticated
  WITH CHECK ( group_id IN ( SELECT get_my_group_ids() ) );

DROP POLICY IF EXISTS "Goal creators can update their goals" ON public.goals;
DROP POLICY IF EXISTS "Goal creators can update their goals" ON goals;
CREATE POLICY "Goal creators can update their goals"
  ON goals FOR UPDATE
  TO authenticated
  USING ( created_by = auth.uid() );

DROP POLICY IF EXISTS "Goal creators can delete their goals" ON public.goals;
DROP POLICY IF EXISTS "Goal creators can delete their goals" ON goals;
CREATE POLICY "Goal creators can delete their goals"
  ON goals FOR DELETE
  TO authenticated
  USING ( created_by = auth.uid() );

-- ===========================================================================
-- 4. GOAL COMPLETIONS RLS POLICIES
-- ===========================================================================

DROP POLICY IF EXISTS "Group members can view completions" ON public.goal_completions;
DROP POLICY IF EXISTS "Group members can view completions" ON goal_completions;
CREATE POLICY "Group members can view completions"
  ON goal_completions FOR SELECT
  USING ( goal_id IN ( SELECT id FROM goals WHERE group_id IN ( SELECT get_my_group_ids() ) ) );

DROP POLICY IF EXISTS "Users can insert their own completions" ON public.goal_completions;
DROP POLICY IF EXISTS "Users can insert their own completions" ON goal_completions;
CREATE POLICY "Users can insert their own completions"
  ON goal_completions FOR INSERT
  TO authenticated
  WITH CHECK ( user_id = auth.uid() );

DROP POLICY IF EXISTS "Users can delete their own completions" ON public.goal_completions;
DROP POLICY IF EXISTS "Users can delete their own completions" ON goal_completions;
CREATE POLICY "Users can delete their own completions"
  ON goal_completions FOR DELETE
  TO authenticated
  USING ( user_id = auth.uid() );

-- ===========================================================================
-- 5. GOAL COMMENTS RLS POLICIES
-- ===========================================================================

DROP POLICY IF EXISTS "Group members can view comments" ON public.goal_comments;
DROP POLICY IF EXISTS "Group members can view comments" ON goal_comments;
CREATE POLICY "Group members can view comments"
  ON goal_comments FOR SELECT
  USING ( completion_id IN (
    SELECT id FROM goal_completions
    WHERE goal_id IN ( SELECT id FROM goals WHERE group_id IN ( SELECT get_my_group_ids() ) )
  ) );

DROP POLICY IF EXISTS "Authenticated users can add comments" ON public.goal_comments;
DROP POLICY IF EXISTS "Authenticated users can add comments" ON goal_comments;
CREATE POLICY "Authenticated users can add comments"
  ON goal_comments FOR INSERT
  TO authenticated
  WITH CHECK ( user_id = auth.uid() );

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.goal_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON goal_comments;
CREATE POLICY "Users can delete their own comments"
  ON goal_comments FOR DELETE
  TO authenticated
  USING ( user_id = auth.uid() );

-- ===========================================================================
-- 6. MESSAGES RLS POLICIES
-- ===========================================================================

DROP POLICY IF EXISTS "Group members can view messages" ON public.messages;
DROP POLICY IF EXISTS "Group members can view messages" ON messages;
CREATE POLICY "Group members can view messages"
  ON messages FOR SELECT
  USING ( group_id IN ( SELECT get_my_group_ids() ) );

DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can send messages" ON messages;
CREATE POLICY "Authenticated users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK ( group_id IN ( SELECT get_my_group_ids() ) AND user_id = auth.uid() );

-- ===========================================================================
-- 7. ACTIVITY LOG RLS POLICIES
-- ===========================================================================

DROP POLICY IF EXISTS "Group members can view activity log" ON public.activity_log;
DROP POLICY IF EXISTS "Group members can view activity log" ON activity_log;
CREATE POLICY "Group members can view activity log"
  ON activity_log FOR SELECT
  USING ( group_id IN ( SELECT get_my_group_ids() ) );

-- ===========================================================================
-- 8. ENHANCED TRANSACTIONS POLICIES
-- ===========================================================================

-- UPDATE policy: only creditor (to_user) can update transaction status
DROP POLICY IF EXISTS "Creditor can settle transactions" ON public.transactions;
DROP POLICY IF EXISTS "Creditor can settle transactions" ON transactions;
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

-- ----------------------------------------------------------------------------
-- SOURCE: supabase/migrations/011_fix_log_failure_balance.sql
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- SOURCE: supabase/migrations/012_push_notifications.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- MIGRATION 012: Push Notifications
-- Run this AFTER 007_activity_log_and_enhancements.sql
--
-- Local deadline reminders are scheduled entirely on-device and need nothing
-- here. This migration only covers REMOTE push: storing device tokens, and an
-- outbox that group events write into so a worker can deliver them.
-- ============================================================================

-- ============================================================================
-- 1. PUSH TOKENS - one row per device
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    -- Expo push token, e.g. ExponentPushToken[xxxxxxxx]. Unique so the same
    -- device re-registering updates in place instead of accumulating rows.
    token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- A user may only ever see or touch their own tokens. Knowing another user's
-- token would let you spoof notifications at them via the Expo API.
DROP POLICY IF EXISTS "Users manage their own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users manage their own push tokens" ON push_tokens;
CREATE POLICY "Users manage their own push tokens" ON push_tokens
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 2. NOTIFICATION OUTBOX - what still needs delivering
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Who should receive it (not who caused it).
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

-- Partial index: the worker only ever scans pending rows.
CREATE INDEX IF NOT EXISTS idx_outbox_pending
    ON notification_outbox(created_at)
    WHERE status = 'pending';

ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;

-- Recipients may read their own notifications (useful for an in-app inbox).
-- Nobody may write from the client: rows are created by triggers, and updated
-- only by the delivery worker using the service role, which bypasses RLS.
DROP POLICY IF EXISTS "Recipients can read their notifications" ON notification_outbox;
DROP POLICY IF EXISTS "Recipients can read their notifications" ON notification_outbox;
CREATE POLICY "Recipients can read their notifications" ON notification_outbox
    FOR SELECT USING (recipient_id = auth.uid());

-- ============================================================================
-- 3. ENQUEUE HELPER
-- ============================================================================

-- Fans an event out to every member of a group except the actor.
CREATE OR REPLACE FUNCTION enqueue_group_notification(
    p_group_id UUID,
    p_actor_id UUID,
    p_event_type TEXT,
    p_title TEXT,
    p_body TEXT,
    p_data JSONB DEFAULT '{}'
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT;
BEGIN
    INSERT INTO notification_outbox (recipient_id, group_id, event_type, title, body, data)
    SELECT gm.user_id, p_group_id, p_event_type, p_title, p_body, p_data
    FROM group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id IS DISTINCT FROM p_actor_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ============================================================================
-- 4. TRIGGERS - the events worth interrupting someone for
-- ============================================================================

-- 4a. A mate logged a failure, so you are owed money.
CREATE OR REPLACE FUNCTION notify_on_failure_logged()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_name TEXT;
    v_group_name TEXT;
BEGIN
    SELECT name INTO v_actor_name FROM profiles WHERE id = NEW.from_user_id;
    SELECT name INTO v_group_name FROM groups WHERE id = NEW.group_id;

    -- transactions are written one row per creditor, so notify the creditor
    -- directly rather than fanning out to the whole group.
    INSERT INTO notification_outbox (recipient_id, group_id, event_type, title, body, data)
    VALUES (
        NEW.to_user_id,
        NEW.group_id,
        'failure_logged',
        format('%s slipped up', COALESCE(v_actor_name, 'Someone')),
        format('You are owed EUR %s in %s.', to_char(NEW.amount, 'FM999999990.00'), COALESCE(v_group_name, 'your group')),
        jsonb_build_object('groupId', NEW.group_id, 'transactionId', NEW.id)
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_failure_logged ON transactions;
CREATE TRIGGER trg_notify_on_failure_logged
    AFTER INSERT ON transactions
    FOR EACH ROW
    WHEN (NEW.to_user_id IS DISTINCT FROM NEW.from_user_id)
    EXECUTE FUNCTION notify_on_failure_logged();

-- 4b. Someone in the group completed a goal — social proof, keeps groups warm.
CREATE OR REPLACE FUNCTION notify_on_goal_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_name TEXT;
    v_goal_name TEXT;
    v_goal_emoji TEXT;
    v_group_id UUID;
BEGIN
    SELECT name INTO v_actor_name FROM profiles WHERE id = NEW.user_id;
    SELECT name, emoji, group_id INTO v_goal_name, v_goal_emoji, v_group_id
    FROM goals WHERE id = NEW.goal_id;

    IF v_group_id IS NULL THEN
        RETURN NEW;
    END IF;

    PERFORM enqueue_group_notification(
        v_group_id,
        NEW.user_id,
        'goal_completed',
        format('%s %s done it', COALESCE(v_goal_emoji, ''), COALESCE(v_actor_name, 'Someone')),
        format('%s was just completed. Your turn.', COALESCE(v_goal_name, 'A goal')),
        jsonb_build_object('groupId', v_group_id, 'goalId', NEW.goal_id)
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_goal_completed ON goal_completions;
CREATE TRIGGER trg_notify_on_goal_completed
    AFTER INSERT ON goal_completions
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_goal_completed();

-- 4c. A new member joined.
CREATE OR REPLACE FUNCTION notify_on_member_joined()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_name TEXT;
    v_group_name TEXT;
BEGIN
    SELECT name INTO v_actor_name FROM profiles WHERE id = NEW.user_id;
    SELECT name INTO v_group_name FROM groups WHERE id = NEW.group_id;

    PERFORM enqueue_group_notification(
        NEW.group_id,
        NEW.user_id,
        'member_joined',
        format('%s joined %s', COALESCE(v_actor_name, 'Someone'), COALESCE(v_group_name, 'the group')),
        'Say hello and set them a goal.',
        jsonb_build_object('groupId', NEW.group_id)
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_member_joined ON group_members;
CREATE TRIGGER trg_notify_on_member_joined
    AFTER INSERT ON group_members
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_member_joined();

-- ============================================================================
-- 5. HOUSEKEEPING
-- ============================================================================

-- Delivered notifications older than 30 days are dead weight. Call from the
-- delivery worker; there is no pg_cron on the free tier.
CREATE OR REPLACE FUNCTION prune_notification_outbox()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT;
BEGIN
    DELETE FROM notification_outbox
    WHERE status IN ('sent', 'failed')
      AND created_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ============================================================================
-- DONE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SOURCE: supabase/migrations/013_secure_goal_templates.sql
-- ----------------------------------------------------------------------------

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
DROP POLICY IF EXISTS "Goal templates are publicly readable" ON goal_templates;
CREATE POLICY "Goal templates are publicly readable" ON goal_templates
    FOR SELECT USING (true);

-- Intentionally no INSERT/UPDATE/DELETE policies. With RLS enabled and no
-- permissive policy, those are refused for anon and authenticated alike.
-- Seeding and edits happen through migrations or the service role, both of
-- which bypass RLS.

-- ----------------------------------------------------------------------------
-- SOURCE: supabase/migrations/014_account_deletion.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- MIGRATION 014: Account deletion
--
-- Google Play requires any app that lets users create an account to offer
-- in-app account deletion. Do It Mate had none, which also made an honest
-- answer to the Data safety "can users request deletion?" question impossible.
--
-- A plain `DELETE FROM auth.users` does not work here: profiles.id references
-- auth.users with NO ACTION, and goals.created_by, groups.created_by,
-- group_members.user_id and transactions.from_user_id / to_user_id all
-- reference profiles without ON DELETE CASCADE. Deleting therefore has to walk
-- the graph in dependency order.
--
-- Group ownership is transferred rather than destroyed: deleting the person who
-- happened to create a group must not wipe out everyone else's history.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_group RECORD;
    v_new_owner UUID;
    v_groups_deleted INT := 0;
    v_groups_transferred INT := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 1. Groups this user created. Hand them over if anyone else is still a
    --    member; only delete a group when it would otherwise be orphaned.
    FOR v_group IN
        SELECT id FROM groups WHERE created_by = v_user_id
    LOOP
        SELECT gm.user_id INTO v_new_owner
        FROM group_members gm
        WHERE gm.group_id = v_group.id
          AND gm.user_id <> v_user_id
        ORDER BY gm.joined_at ASC
        LIMIT 1;

        IF v_new_owner IS NULL THEN
            -- Nobody left to own it. Cascades clear goals, messages,
            -- activity_log, user_badges and notification_outbox.
            DELETE FROM transactions WHERE group_id = v_group.id;
            DELETE FROM group_members WHERE group_id = v_group.id;
            DELETE FROM groups WHERE id = v_group.id;
            v_groups_deleted := v_groups_deleted + 1;
        ELSE
            UPDATE groups SET created_by = v_new_owner WHERE id = v_group.id;
            -- Goals they authored survive under the new owner, so the group's
            -- tracking history stays intact for the remaining members.
            UPDATE goals SET created_by = v_new_owner
            WHERE group_id = v_group.id AND created_by = v_user_id;
            v_groups_transferred := v_groups_transferred + 1;
        END IF;
    END LOOP;

    -- 2. Goals this user created in groups they did not own. No one to hand
    --    these to, so remove them (cascades completions and comments).
    DELETE FROM goals WHERE created_by = v_user_id;

    -- 3. Money owed in either direction. Settle counterparties first so the
    --    remaining members' balances stay consistent after the transactions
    --    are removed: a pending debt the departed user owed is voided (the
    --    creditor's phantom credit is reversed), and a pending debt owed TO
    --    the departed user is written off (the debtor's phantom debit is
    --    reversed).
    UPDATE group_members gm SET current_balance = gm.current_balance - t.amount
    FROM transactions t
    WHERE t.from_user_id = v_user_id
      AND t.to_user_id = gm.user_id
      AND t.group_id = gm.group_id
      AND t.status = 'pending';

    UPDATE group_members gm SET current_balance = gm.current_balance + t.amount
    FROM transactions t
    WHERE t.to_user_id = v_user_id
      AND t.from_user_id = gm.user_id
      AND t.group_id = gm.group_id
      AND t.status = 'pending';

    DELETE FROM transactions
    WHERE from_user_id = v_user_id OR to_user_id = v_user_id;

    -- 4. Memberships.
    DELETE FROM group_members WHERE user_id = v_user_id;

    -- 5. Everything else referencing profiles cascades from here
    --    (activity_log, goal_completions, goal_comments, goal_failures,
    --     messages, push_tokens, user_badges, notification_outbox).
    DELETE FROM profiles WHERE id = v_user_id;

    -- 6. Finally the auth record itself, which is what actually revokes access.
    DELETE FROM auth.users WHERE id = v_user_id;

    RETURN json_build_object(
        'deleted', true,
        'groups_deleted', v_groups_deleted,
        'groups_transferred', v_groups_transferred
    );
END;
$function$;


-- Only the signed-in user can invoke it, and it only ever acts on auth.uid(),
-- so there is no way to aim it at somebody else's account.
REVOKE ALL ON FUNCTION delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_my_account() TO authenticated;

-- Storage cleanup: proof photos and avatars are keyed by user id, so remove
-- any objects owned by the departing user.
CREATE OR REPLACE FUNCTION delete_my_storage_objects()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_count INT := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    DELETE FROM storage.objects
    WHERE bucket_id IN ('avatars', 'proof-photos')
      AND owner = v_user_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION delete_my_storage_objects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_my_storage_objects() TO authenticated;

-- ----------------------------------------------------------------------------
-- SOURCE: supabase/migrations/015_security_hardening.sql
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- SOURCE: supabase/migrations/016_fixes_audit_qa.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- MIGRATION 016: Audit + QA fixes (timezone bucketing, stats membership
-- checks, streak trigger fix)
--
-- Run this on EXISTING databases only — fresh databases get everything from
-- supabase/bootstrap.sql (which includes this file via scripts/build_bootstrap_sql.py).
--
-- What it does:
--   1. get_goal_weekly_stats / get_goal_performance now accept
--      p_tz_offset_minutes (the caller's UTC offset, e.g. -360 for Mexico
--      City) and bucket completions on the CLIENT's local calendar day
--      instead of the DB's UTC date (M4). Both also gained a membership
--      check: as SECURITY DEFINER functions they previously let ANY
--      authenticated user read any goal's stats cross-group (M5).
--   2. update_goal_streak now only advances the streak on the FIRST
--      completion of a calendar day. Same-day duplicates (the 1-tap
--      complete button and the photo-proof path both insert a completion
--      row) used to add one phantom streak day each, inflating current AND
--      longest streaks — live-confirmed as 'Best streak: 8' on a goal with a
--      real 5-day streak. The trigger now passes the new row's id so the
--      dedupe check can exclude the row that fired it.
--
-- NOTE: existing rows already inflated by the buggy trigger are NOT
-- rewritten here — recomputing historical streaks from raw completions is a
-- data migration of its own; the trigger fix stops new inflation.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Streak trigger fix
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_goal_streak(
    p_goal_id UUID,
    p_user_id UUID,
    p_completion_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_goal RECORD;
    v_last_completion TIMESTAMPTZ;
    v_streak_continued BOOLEAN;
    v_new_streak INTEGER;
    v_result JSONB;
    v_already_today BOOLEAN;
BEGIN
    -- Get goal details
    SELECT * INTO v_goal FROM goals WHERE id = p_goal_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Goal not found');
    END IF;

    -- Only the FIRST completion of a calendar day may advance the streak.
    SELECT EXISTS (
        SELECT 1 FROM goal_completions
        WHERE goal_id = p_goal_id
          AND user_id = p_user_id
          AND completed_at >= CURRENT_DATE
          AND (p_completion_id IS NULL OR id != p_completion_id)
    ) INTO v_already_today;

    IF v_already_today THEN
        -- Same-day duplicate: streak stays where it is.
        v_new_streak := GREATEST(COALESCE(v_goal.current_streak, 0), 1);
        v_streak_continued := true;
    ELSE
        -- Get last completion before today
        SELECT completed_at INTO v_last_completion
        FROM goal_completions
        WHERE goal_id = p_goal_id
          AND user_id = p_user_id
          AND completed_at < CURRENT_DATE
        ORDER BY completed_at DESC
        LIMIT 1;

        -- Determine if streak continues
        IF v_last_completion IS NULL THEN
            -- First completion ever
            v_new_streak := 1;
            v_streak_continued := false;
        ELSIF (CURRENT_DATE - v_last_completion::DATE) <= v_goal.frequency_days THEN
            -- Streak continues
            v_new_streak := COALESCE(v_goal.current_streak, 0) + 1;
            v_streak_continued := true;
        ELSE
            -- Streak broken, starting fresh
            v_new_streak := 1;
            v_streak_continued := false;
        END IF;
    END IF;

    -- Update goal with new streak
    UPDATE goals
    SET
        current_streak = v_new_streak,
        longest_streak = GREATEST(COALESCE(longest_streak, 0), v_new_streak),
        consecutive_failures = 0, -- Reset failures on success
        updated_at = NOW()
    WHERE id = p_goal_id;

    -- Log streak achievement if milestone reached
    IF v_new_streak IN (7, 30, 100, 365) THEN
        PERFORM log_activity(
            v_goal.group_id,
            p_user_id,
            'streak_achieved',
            p_goal_id,
            'goal',
            jsonb_build_object('streak_days', v_new_streak, 'goal_name', v_goal.name)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'new_streak', v_new_streak,
        'longest_streak', GREATEST(COALESCE(v_goal.longest_streak, 0), v_new_streak),
        'streak_continued', v_streak_continued
    );
END;
$$;

-- The completion trigger must pass the new row's id, otherwise the dedupe
-- check above would see the trigger's own row and NEVER advance the streak.
CREATE OR REPLACE FUNCTION public.log_completion_activity() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_goal RECORD;
BEGIN
    SELECT * INTO v_goal FROM goals WHERE id = NEW.goal_id;

    PERFORM log_activity(
        v_goal.group_id,
        NEW.user_id,
        'goal_completed',
        NEW.id,
        'completion',
        jsonb_build_object(
            'goal_name', v_goal.name,
            'goal_emoji', v_goal.emoji,
            'has_proof', NEW.proof_photo_url IS NOT NULL
        )
    );

    -- Update streak (pass the new row's id so same-day duplicate
    -- completions don't each advance the streak)
    PERFORM update_goal_streak(NEW.goal_id, NEW.user_id, NEW.id);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_completion ON goal_completions;
CREATE TRIGGER trigger_log_completion
    AFTER INSERT ON goal_completions
    FOR EACH ROW
    EXECUTE FUNCTION public.log_completion_activity();

-- ---------------------------------------------------------------------------
-- 2. Weekly stats + performance: timezone-aware bucketing + membership checks
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_goal_weekly_stats(
    p_goal_id UUID,
    p_tz_offset_minutes INTEGER DEFAULT 0
)
RETURNS TABLE (
    user_id UUID,
    user_name TEXT,
    day_date DATE,
    completion_count INTEGER,
    has_photo BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today_local DATE;
    v_group_id UUID;
BEGIN
    -- M5: SECURITY DEFINER must not let non-members read another group's
    -- goal stats.
    SELECT g.group_id INTO v_group_id FROM goals g WHERE g.id = p_goal_id;
    IF v_group_id IS NULL THEN
        RETURN;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM group_members gm
        WHERE gm.group_id = v_group_id AND gm.user_id = auth.uid()
    ) THEN
        RETURN;
    END IF;

    -- M4: "today" in the caller's local timezone.
    v_today_local := (now() AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE;

    RETURN QUERY
    SELECT
        gc.user_id,
        p.name as user_name,
        (gc.completed_at AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE as day_date,
        COALESCE(SUM(gc.occurrence_count)::INTEGER, 0) as completion_count,
        BOOL_OR(gc.proof_photo_url IS NOT NULL) as has_photo
    FROM goal_completions gc
    JOIN profiles p ON p.id = gc.user_id
    WHERE gc.goal_id = p_goal_id
    AND (gc.completed_at AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE >= v_today_local - INTERVAL '6 days'
    GROUP BY gc.user_id, p.name, (gc.completed_at AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE
    ORDER BY (gc.completed_at AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_goal_performance(
    p_goal_id UUID,
    p_tz_offset_minutes INTEGER DEFAULT 0
)
RETURNS TABLE (
    user_id UUID,
    user_name TEXT,
    completions_this_week INTEGER,
    target_completions INTEGER,
    percentage NUMERIC,
    is_on_track BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_goal RECORD;
    v_week_start DATE;
BEGIN
    -- Get goal details
    SELECT * INTO v_goal FROM goals WHERE id = p_goal_id;

    IF v_goal IS NULL THEN
        RETURN;
    END IF;

    -- M5: SECURITY DEFINER must not leak other groups' stats to non-members.
    IF NOT EXISTS (
        SELECT 1 FROM group_members gm
        WHERE gm.group_id = v_goal.group_id AND gm.user_id = auth.uid()
    ) THEN
        RETURN;
    END IF;

    -- M4: start of the caller's local week (Monday), not the DB's UTC Monday.
    v_week_start := date_trunc(
        'week',
        now() AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes)
    )::DATE;

    -- Calculate target based on goal type
    -- If target_per_week is set, use it; otherwise calculate from frequency_days

    RETURN QUERY
    SELECT
        gm.user_id,
        p.name as user_name,
        COALESCE((
            SELECT SUM(gc.occurrence_count)::INTEGER
            FROM goal_completions gc
            WHERE gc.goal_id = p_goal_id
            AND gc.user_id = gm.user_id
            AND (gc.completed_at AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE >= v_week_start
        ), 0) as completions_this_week,
        COALESCE(v_goal.target_per_week, GREATEST(7 / v_goal.frequency_days, 1))::INTEGER as target_completions,
        CASE
            WHEN COALESCE(v_goal.target_per_week, GREATEST(7 / v_goal.frequency_days, 1)) = 0 THEN 0
            ELSE LEAST(100, ROUND(
                COALESCE((
                    SELECT SUM(gc.occurrence_count)
                    FROM goal_completions gc
                    WHERE gc.goal_id = p_goal_id
                    AND gc.user_id = gm.user_id
                    AND (gc.completed_at AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE >= v_week_start
                ), 0)::NUMERIC /
                COALESCE(v_goal.target_per_week, GREATEST(7 / v_goal.frequency_days, 1))::NUMERIC * 100
            , 0))
        END as percentage,
        COALESCE((
            SELECT SUM(gc.occurrence_count)
            FROM goal_completions gc
            WHERE gc.goal_id = p_goal_id
            AND gc.user_id = gm.user_id
            AND (gc.completed_at AT TIME ZONE 'UTC' + make_interval(mins => p_tz_offset_minutes))::DATE >= v_week_start
        ), 0) >= COALESCE(v_goal.target_per_week, GREATEST(7 / v_goal.frequency_days, 1)) as is_on_track
    FROM group_members gm
    JOIN profiles p ON p.id = gm.user_id
    WHERE gm.group_id = v_goal.group_id
    ORDER BY percentage DESC;
END;
$$;

-- ----------------------------------------------------------------------------
-- SOURCE: supabase/migrations/017_public_challenges.sql
-- ----------------------------------------------------------------------------

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
DROP POLICY IF EXISTS "Public challenges are viewable by authenticated users" ON public.public_challenges;
CREATE POLICY "Public challenges are viewable by authenticated users"
    ON public.public_challenges FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Only service role can modify public challenges" ON public.public_challenges;
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
DROP POLICY IF EXISTS "Participants can view their own challenge memberships" ON public.challenge_participants;
CREATE POLICY "Participants can view their own challenge memberships"
    ON public.challenge_participants FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Insert is permitted for own rows as defense-in-depth; the real join path is
-- the RPC below (which also creates the shared group + goal atomically).
DROP POLICY IF EXISTS "Participants can insert their own challenge memberships" ON public.challenge_participants;
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
        MAX(cp.group_id) FILTER (WHERE cp.user_id = auth.uid()) AS group_id
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

