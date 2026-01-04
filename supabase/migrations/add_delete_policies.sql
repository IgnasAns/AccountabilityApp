-- Add DELETE policies for groups, group_members, and transactions
-- Run this in your Supabase SQL Editor

-- Groups: Only creator can delete
DROP POLICY IF EXISTS "groups_delete" ON public.groups;
CREATE POLICY "groups_delete" ON public.groups 
    FOR DELETE TO authenticated 
    USING (auth.uid() = created_by);

-- Group Members: Allow deletion by group creator or by the member themselves
DROP POLICY IF EXISTS "group_members_delete" ON public.group_members;
CREATE POLICY "group_members_delete" ON public.group_members 
    FOR DELETE TO authenticated 
    USING (
        auth.uid() = user_id OR 
        auth.uid() = (SELECT created_by FROM groups WHERE id = group_id)
    );

-- Transactions: Only group creator can delete transactions
DROP POLICY IF EXISTS "transactions_delete" ON public.transactions;
CREATE POLICY "transactions_delete" ON public.transactions 
    FOR DELETE TO authenticated 
    USING (
        auth.uid() = (SELECT created_by FROM groups WHERE id = group_id)
    );

-- Also add UPDATE policies for groups (to edit group settings)
DROP POLICY IF EXISTS "groups_update" ON public.groups;
CREATE POLICY "groups_update" ON public.groups 
    FOR UPDATE TO authenticated 
    USING (auth.uid() = created_by);

-- Add UPDATE policy for group_members (for balance and failure_count updates)  
DROP POLICY IF EXISTS "group_members_update" ON public.group_members;
CREATE POLICY "group_members_update" ON public.group_members 
    FOR UPDATE TO authenticated 
    USING (true);  -- RPC functions handle the logic

-- Add INSERT policy for transactions
DROP POLICY IF EXISTS "transactions_insert" ON public.transactions;
CREATE POLICY "transactions_insert" ON public.transactions 
    FOR INSERT TO authenticated 
    WITH CHECK (true);  -- RPC functions handle the logic

-- Add UPDATE policy for transactions (for settling)
DROP POLICY IF EXISTS "transactions_update" ON public.transactions;
CREATE POLICY "transactions_update" ON public.transactions 
    FOR UPDATE TO authenticated 
    USING (true);  -- RPC functions handle the logic
