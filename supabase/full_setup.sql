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
CREATE POLICY "Public profiles are viewable by everyone."
  ON profiles FOR SELECT
  USING ( true );

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile."
  ON profiles FOR INSERT
  WITH CHECK ( auth.uid() = id );

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile."
  ON profiles FOR UPDATE
  USING ( auth.uid() = id );

-- Groups Policies
DROP POLICY IF EXISTS "Groups are viewable by members." ON public.groups;
CREATE POLICY "Groups are viewable by members."
  ON groups FOR SELECT
  USING (
    id IN ( SELECT get_my_group_ids() )
  );

DROP POLICY IF EXISTS "Authenticated users can create groups." ON public.groups;
CREATE POLICY "Authenticated users can create groups."
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Group Members Policies
DROP POLICY IF EXISTS "Members can view other members in the same group." ON public.group_members;
CREATE POLICY "Members can view other members in the same group."
  ON group_members FOR SELECT
  USING (
    group_id IN ( SELECT get_my_group_ids() )
  );

DROP POLICY IF EXISTS "Authenticated users can insert group members." ON public.group_members;
CREATE POLICY "Authenticated users can insert group members."
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Transactions Policies
DROP POLICY IF EXISTS "Users can view transactions involving them or their groups." ON public.transactions;
CREATE POLICY "Users can view transactions involving them or their groups."
  ON transactions FOR SELECT
  USING (
    from_user_id = auth.uid() 
    OR to_user_id = auth.uid()
    OR group_id IN ( SELECT get_my_group_ids() )
  );

-- 5. CREATE RPC FUNCTIONS
-- ---------------------------------------------------------------------------

-- Function: join_group_by_code
CREATE OR REPLACE FUNCTION join_group_by_code(p_invite_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_id uuid;
  v_user_id uuid;
  v_already_member boolean;
BEGIN
  v_user_id := auth.uid();
  
  -- Find group
  SELECT id INTO v_group_id FROM public.groups WHERE invite_code = p_invite_code;
  
  IF v_group_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid invite code');
  END IF;

  -- Check membership
  SELECT exists(SELECT 1 FROM public.group_members WHERE group_id = v_group_id AND user_id = v_user_id)
  INTO v_already_member;

  IF v_already_member THEN
    RETURN json_build_object('success', false, 'error', 'Already a member');
  END IF;

  -- Add to group
  INSERT INTO public.group_members (group_id, user_id)
  VALUES (v_group_id, v_user_id);

  RETURN json_build_object('success', true, 'group_id', v_group_id);
END;
$$;

-- Function: log_failure
CREATE OR REPLACE FUNCTION log_failure(p_group_id uuid, p_description text)
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
    INSERT INTO public.transactions (group_id, from_user_id, to_user_id, amount, description)
    VALUES (p_group_id, v_user_id, v_member.user_id, v_penalty, p_description);
    
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

-- ===========================================================================
-- SETUP COMPLETE! You can now use the app.
-- ===========================================================================
