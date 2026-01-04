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
CREATE POLICY "Users can view goals in their groups"
ON goals FOR SELECT
USING (
    group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Group members can create goals"
ON goals FOR INSERT
WITH CHECK (
    group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
);

CREATE POLICY "Goal creator can update goal"
ON goals FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY "Goal creator can delete goal"
ON goals FOR DELETE
USING (created_by = auth.uid());

-- 5. Enable RLS on goal_completions
ALTER TABLE goal_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for goal_completions
CREATE POLICY "Users can view completions for goals in their groups"
ON goal_completions FOR SELECT
USING (
    goal_id IN (
        SELECT g.id FROM goals g
        JOIN group_members gm ON g.group_id = gm.group_id
        WHERE gm.user_id = auth.uid()
    )
);

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
