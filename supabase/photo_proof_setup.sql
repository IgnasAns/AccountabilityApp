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
CREATE POLICY "Users can upload proof photos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'proof-photos' 
    AND auth.role() = 'authenticated'
);

-- Allow public read access to proof photos
CREATE POLICY "Public read access for proof photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'proof-photos');

-- Allow users to delete their own photos
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
