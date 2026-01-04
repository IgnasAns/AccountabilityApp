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
CREATE OR REPLACE FUNCTION get_goal_weekly_stats(p_goal_id UUID)
RETURNS TABLE (
    user_id UUID,
    user_name TEXT,
    day_date DATE,
    completion_count INTEGER,
    has_photo BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gc.user_id,
        p.name as user_name,
        gc.completed_at::DATE as day_date,
        COALESCE(SUM(gc.occurrence_count)::INTEGER, 0) as completion_count,
        BOOL_OR(gc.proof_photo_url IS NOT NULL) as has_photo
    FROM goal_completions gc
    JOIN profiles p ON p.id = gc.user_id
    WHERE gc.goal_id = p_goal_id
    AND gc.completed_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY gc.user_id, p.name, gc.completed_at::DATE
    ORDER BY gc.completed_at::DATE;
END;
$$;

-- 4. Function to calculate performance percentage for a positive goal (current week Mon-Sun)
CREATE OR REPLACE FUNCTION get_goal_performance(p_goal_id UUID)
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
    
    -- Calculate start of current week (Monday)
    v_week_start := date_trunc('week', CURRENT_DATE)::DATE;
    
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
            AND gc.completed_at::DATE >= v_week_start
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
                    AND gc.completed_at::DATE >= v_week_start
                ), 0)::NUMERIC / 
                COALESCE(v_goal.target_per_week, GREATEST(7 / v_goal.frequency_days, 1))::NUMERIC * 100
            , 0))
        END as percentage,
        COALESCE((
            SELECT SUM(gc.occurrence_count)
            FROM goal_completions gc
            WHERE gc.goal_id = p_goal_id
            AND gc.user_id = gm.user_id
            AND gc.completed_at::DATE >= v_week_start
        ), 0) >= COALESCE(v_goal.target_per_week, GREATEST(7 / v_goal.frequency_days, 1)) as is_on_track
    FROM group_members gm
    JOIN profiles p ON p.id = gm.user_id
    WHERE gm.group_id = v_goal.group_id
    ORDER BY percentage DESC;
END;
$$;

-- 5. Function to log negative occurrence (quick tap, optional penalty)
CREATE OR REPLACE FUNCTION log_negative_occurrence(
    p_goal_id UUID,
    p_count INTEGER DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    
    -- Get goal details
    SELECT * INTO v_goal FROM goals WHERE id = p_goal_id;
    
    IF v_goal IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Goal not found');
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
                SET current_balance = current_balance - v_penalty,
                    failure_count = failure_count + 1
                WHERE group_id = v_goal.group_id AND user_id = v_user_id;
                
                UPDATE group_members 
                SET current_balance = current_balance + v_penalty
                WHERE group_id = v_goal.group_id AND user_id = v_member.user_id;
            END LOOP;
        END IF;
    END IF;
    
    RETURN json_build_object(
        'success', true, 
        'count', p_count,
        'penalty_applied', v_penalty
    );
END;
$$;

-- ============================================
-- DONE! Enhanced goals system ready.
-- ============================================
