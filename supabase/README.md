# Supabase Database Setup

## Quick Start

Run these SQL files in your Supabase Dashboard > SQL Editor in order:

1. **`full_setup.sql`** - Core database setup (profiles, groups, members, transactions)
2. **`photo_proof_setup.sql`** - Photo proof feature (storage bucket, column)
3. **`scheduled_goals_setup.sql`** - Scheduled goals feature (goals, completions)
4. **`group_chat_setup.sql`** - Group chat feature (messages, real-time)
5. **`auto_failure_setup.sql`** - Auto-failure for overdue goals
6. **`enhanced_goals_setup.sql`** - Positive/Negative goal modes & stats
7. **`migrations/007_activity_log_and_enhancements.sql`** - Activity log, streak tracking, leaderboards, badges, templates

## Files

| File | Description |
|------|-------------|
| `full_setup.sql` | Complete base schema with RLS policies |
| `photo_proof_setup.sql` | Photo proof for failures |
| `scheduled_goals_setup.sql` | Goals with frequency tracking |
| `group_chat_setup.sql` | In-app messaging |
| `auto_failure_setup.sql` | Auto-penalty when goals are missed |
| `enhanced_goals_setup.sql` | Positive/Negative modes, weekly stats, graphs |
| `migrations/007_*.sql` | Activity log, streaks, leaderboards, badges |

## New Features (v2.0)

### 📊 Activity Log
- Unified event tracking for all group activities
- Real-time activity feed
- Events: completions, failures, member joins, streak achievements

### 🔥 Streak Tracking
- Automatic streak calculation on completions
- Current and longest streak stored per goal
- Streak milestone badges (7, 30, 100, 365 days)

### 🏆 Leaderboard
- Weekly, monthly, and all-time rankings
- Score = completions × 10 - failures × 5
- Rankings update in real-time

### 🏅 Badges/Achievements
- First completion, streak milestones, perfect weeks
- Earned automatically via triggers

### 📋 Goal Templates
- 20+ pre-built goal templates
- Categories: fitness, health, productivity, finance, mindfulness, social

### ⏸️ Goal Pausing
- Vacation mode - pause goals without penalty
- Optional resume date

### 📈 Penalty Escalation
- Optional escalating penalties for consecutive failures
- Configurable multiplier (default: 1.5x)

### 💬 Goal Comments
- Comment on goal completions
- Encourage teammates

## Goal Modes

### ✅ Positive (Achievement)
- Track goals like "Gym 3x/week"
- Requires photo proof to complete (optional)
- Auto-penalty if deadline missed
- Streak tracking

### 🚫 Negative (Habit Breaking)
- Track slip-ups like "Cigarettes smoked"
- Quick tap to log each occurrence
- Penalty applied per slip-up

## How Auto-Failure Works

When a user opens a group, the app calls `process_overdue_goals()` which:
1. Checks all active goals in the group
2. For each goal, calculates if any deadlines were missed
3. Creates penalty transactions for missed deadlines
4. Records processed failures to prevent double-charging

This runs **on app open**, not at midnight (since we can't run scheduled jobs without Supabase Pro).

## /migrations (Legacy)

Old one-time migration scripts, kept for reference:
- `backfill_profiles.sql` - Fix missing profiles
- `fix_invite_codes.sql` - Shorten invite codes  
- `critical_fix.sql` - RLS recursion fix
- `add_delete_policies.sql` - Delete permission policies
- `schema.sql` - Original schema (superseded by full_setup.sql)
