-- CRITICAL DATABASE FIX
-- -----------------------------------------------------------------------------
-- INSTRUCTIONS:
-- 1. Copy the content of this file.
-- 2. Go to your Supabase Dashboard (https://supabase.com/dashboard/project/...)
-- 3. Click on the "SQL Editor" tab (icon on the left sidebar).
-- 4. Paste this code and click "Run".
-- -----------------------------------------------------------------------------

-- 1. FIX AUTHENTICATION (AUTO-CONFIRM EMAILS)
-- This updates ALL existing users to be confirmed
UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL;

-- Create trigger to auto-confirm ALL FUTURE users
CREATE OR REPLACE FUNCTION public.auto_confirm_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.auto_confirm_email();


-- 2. FIX INFINITE RECURSION (RLS POLICIES)
-- We must recreate the helper function as SECURITY DEFINER to bypass recursion

-- Drop potentially problematic policies first
DROP POLICY IF EXISTS "Members can view other members in the same group." ON public.group_members;
DROP POLICY IF EXISTS "Groups are viewable by members." ON public.groups;

-- Recreate the helper function strictly
CREATE OR REPLACE FUNCTION get_my_group_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT group_id FROM group_members WHERE user_id = auth.uid();
$$;

-- Re-apply the Group Members policy
CREATE POLICY "Members can view other members in the same group."
  ON group_members FOR SELECT
  USING (
    group_id IN ( SELECT get_my_group_ids() )
  );

-- Re-apply the Groups policy
CREATE POLICY "Groups are viewable by members."
  ON groups FOR SELECT
  USING (
    id IN ( SELECT get_my_group_ids() )
  );


-- 3. ENSURE PROFILE CREATION WORKS
-- Ensure the profile trigger is correct
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', null)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 4. VERIFY TRANSACTIONS POLICY (Just in case)
DROP POLICY IF EXISTS "Users can view transactions involving them or their groups." ON public.transactions;
CREATE POLICY "Users can view transactions involving them or their groups."
  ON transactions FOR SELECT
  USING (
    from_user_id = auth.uid() 
    OR to_user_id = auth.uid()
    OR group_id IN ( SELECT get_my_group_ids() )
  );
