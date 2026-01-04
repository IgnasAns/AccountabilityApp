# Social Ledger - Feature Implementation Plan

## Overview
This document outlines the implementation plan for new features in the Social Ledger accountability app.

---

## Phase 1: Quick Fixes (Current Session)
### 1.1 Copy Invite Code with One Click ✅
- Add clipboard icon button next to invite code in success modal
- Use expo-clipboard to copy
- Show visual feedback (checkmark animation)

---

## Phase 2: Scheduled Goals & Calendar Tracking
### 2.1 Goal Types
Instead of just "failures", allow groups to define **positive goals** with schedules:

**Goal Structure:**
```typescript
interface Goal {
  id: string;
  group_id: string;
  name: string;                    // "Go to gym"
  description?: string;
  goal_type: 'frequency' | 'streak' | 'custom';
  frequency_days?: number;         // e.g., 3 = "at least once every 3 days"
  penalty_amount: number;
  created_by: string;
  created_at: string;
}

interface GoalCompletion {
  id: string;
  goal_id: string;
  user_id: string;
  completed_at: string;
  proof_photo_url?: string;
  verified_by?: string[];          // Other members who verified
}
```

### 2.2 Calendar View
- Month view showing completion dots for each member
- Color-coded: green (completed), red (missed deadline), yellow (deadline approaching)
- Tap on a day to see details/proofs

### 2.3 Auto-Failure Detection
- Background job/trigger that checks:
  - If a user hasn't completed a goal within the frequency period
  - Automatically creates a "failure" and triggers penalties
- Cron job using Supabase Edge Functions or pg_cron

---

## Phase 3: Photo Proof System
### 3.1 Photo Upload
- Use `expo-image-picker` to capture/select photos
- Upload to Supabase Storage bucket
- Compress images client-side before upload

### 3.2 Proof Verification (Optional)
- Other group members can "verify" or "challenge" a proof
- Adds gamification: verified proofs give bonus credibility

### 3.3 UI Components
- Camera button on goal completion
- Photo gallery in goal history
- Full-screen photo viewer with zoom

---

## Phase 4: Statistics & Analytics Dashboard
### 4.1 Member Leaderboard
- Success rate percentage
- Current streak
- Total completions vs failures
- Ranking with medals (🥇🥈🥉)

### 4.2 Charts & Graphs
Using `react-native-chart-kit` or `victory-native`:

**Charts to include:**
- **Line chart**: Completion rate over time
- **Bar chart**: Weekly comparison between members
- **Pie chart**: Success vs failure ratio
- **Heatmap calendar**: GitHub-style contribution grid

### 4.3 Time-based Insights
- "Best performing day of week"
- "Longest streak"
- "Most consistent member"
- "Total money saved from accountability"

---

## Phase 5: Suggested Additional Features

### 5.1 Push Notifications 🔔
- Reminder before deadline: "2 hours left to complete 'Gym'"
- When someone logs a failure: "John failed! You earned €1"
- Weekly summary: "You saved €15 this week!"

### 5.2 Cheering & Social Features 🎉
- React to completions with emojis
- Comment on proofs
- "Nudge" someone who's close to deadline

### 5.3 Streak Bonuses 🔥
- Extra rewards for maintaining streaks
- "Fire" indicator showing hot streaks
- Streak protection: one "free pass" per month

### 5.4 Group Chat 💬
- In-app messaging
- Share motivation, talk trash
- Automatic messages for events

### 5.5 Payout Integration 💰
- Connect to PayPal/Revolut for auto-payments
- Or: manual "I paid" confirmation with screenshot
- Payment history tracking

### 5.6 Challenges & Events 🏆
- Time-limited challenges: "No sugar January"
- Group vs Group competitions
- Achievement badges

### 5.7 Smart Suggestions 🤖
- AI-powered goal recommendations
- Optimal penalty amount suggestions
- "You perform better on weekends" insights

---

## Database Schema Updates Required

### New Tables:
```sql
-- Goals within a group
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  goal_type TEXT DEFAULT 'frequency',  -- 'frequency', 'daily', 'weekly'
  frequency_days INTEGER DEFAULT 1,
  penalty_amount DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goal completions with proof
CREATE TABLE goal_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  proof_photo_url TEXT,
  notes TEXT,
  verified BOOLEAN DEFAULT false
);

-- Verification votes
CREATE TABLE completion_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  completion_id UUID REFERENCES goal_completions(id) ON DELETE CASCADE,
  verified_by UUID REFERENCES profiles(id),
  is_approved BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(completion_id, verified_by)
);
```

### Storage Bucket:
```sql
-- Create bucket for proof photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('proof-photos', 'proof-photos', true);

-- Allow authenticated users to upload
CREATE POLICY "Users can upload proof photos" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'proof-photos' AND auth.role() = 'authenticated');
```

---

## Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | Copy code fix | 30 min | High |
| 2 | Photo proof | 1 day | High |
| 3 | Scheduled goals | 2 days | Very High |
| 4 | Statistics graphs | 1 day | High |
| 5 | Push notifications | 1 day | Very High |
| 6 | Streak bonuses | 4 hours | Medium |
| 7 | Group chat | 2 days | Medium |

---

## Tech Stack for New Features

- **Charts**: `react-native-chart-kit` or `victory-native`
- **Image Picker**: `expo-image-picker`
- **Image Compression**: `expo-image-manipulator`
- **Notifications**: `expo-notifications`
- **Calendar**: `react-native-calendars`
- **Storage**: Supabase Storage

---

## Next Steps

1. ✅ Implement copy code fix (now)
2. Choose which feature to implement next
3. Update Supabase schema
4. Build incrementally with testing

