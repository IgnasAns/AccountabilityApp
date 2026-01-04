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
CREATE POLICY "Users can view messages in their groups"
ON messages FOR SELECT
USING (
    group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
);

-- Users can send messages to their groups
CREATE POLICY "Users can send messages to their groups"
ON messages FOR INSERT
WITH CHECK (
    user_id = auth.uid()
    AND group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
);

-- Users can delete their own messages
CREATE POLICY "Users can delete their own messages"
ON messages FOR DELETE
USING (user_id = auth.uid());

-- 5. Enable realtime for messages table
-- Note: You may need to enable this in Supabase Dashboard > Database > Replication
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ============================================
-- DONE! Group chat database ready.
-- ============================================
