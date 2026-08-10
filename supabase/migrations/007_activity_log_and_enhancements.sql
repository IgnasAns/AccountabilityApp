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

CREATE POLICY "Users can view activity in their groups" ON activity_log
    FOR SELECT USING (
        group_id IN (
            SELECT group_id FROM group_members WHERE user_id = auth.uid()
        )
    );

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

CREATE POLICY "Users can insert comments" ON goal_comments
    FOR INSERT WITH CHECK (user_id = auth.uid());

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
