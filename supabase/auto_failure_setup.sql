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
CREATE POLICY "Users can view their own goal failures"
ON goal_failures FOR SELECT
USING (user_id = auth.uid());

-- 4. Function to check and process overdue goals for a user in a group
CREATE OR REPLACE FUNCTION process_overdue_goals(p_group_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_goal RECORD;
    v_last_completion TIMESTAMPTZ;
    v_deadline DATE;
    v_check_date DATE;
    v_penalty NUMERIC;
    v_member_count INTEGER;
    v_member RECORD;
    v_failures_processed INTEGER := 0;
    v_total_penalty NUMERIC := 0;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
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
        
        -- Check if deadline has passed (and it's before today)
        -- We process failures for deadlines that have fully passed (before today)
        WHILE v_deadline < CURRENT_DATE LOOP
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
                        SET current_balance = current_balance - v_penalty,
                            failure_count = failure_count + 1
                        WHERE group_id = p_group_id AND user_id = v_user_id;
                        
                        UPDATE group_members 
                        SET current_balance = current_balance + v_penalty
                        WHERE group_id = p_group_id AND user_id = v_member.user_id;
                    END LOOP;
                    
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
$$;

-- ============================================
-- DONE! Auto-failure system ready.
-- This function should be called when a user opens a group.
-- ============================================
