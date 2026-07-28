# Supabase Database Setup

## Quick Start — one file

Paste **`bootstrap.sql`** into the Supabase Dashboard > SQL Editor of a fresh
project. That is the entire schema, in the correct order, and it is safe to
re-run.

```bash
# Regenerate it after editing any source .sql file:
python scripts/build_bootstrap_sql.py
```

Do not edit `bootstrap.sql` by hand — it is generated from the files below.

Then, still in the dashboard:

1. **Authentication > Providers** — enable **Email**, and **Anonymous** if you
   want guest mode to work (`signInAsGuest` fails without it).
2. **Authentication > URL Configuration** — add the redirect
   `doitmate://reset-password`, or password reset links will not open the app.
3. **Storage** — confirm the `avatars` and `proof-photos` buckets exist.
4. Copy the project URL + anon key into `.env` **and** all four `eas.json`
   build profiles. Both are baked into release builds, so missing one ships a
   broken app.

> ⚠️ **The previous backend (ref `bftyuzhigydeuabzkfvs`) was lost this way.**
> Free-tier projects pause after ~7 days of inactivity and become eligible for
> deletion after ~90 days paused. The shipped app pointed at a hostname that no
> longer resolved, so nobody could log in. `.github/workflows/supabase-worker.yml`
> pings the database every 15 minutes to prevent a repeat — set the
> `SUPABASE_URL` and `SUPABASE_ANON_KEY` repository secrets or it will not run.

## Source files (run order)

| # | File | Description |
|---|------|-------------|
| 1 | `full_setup.sql` | Complete base schema with RLS policies |
| 2 | `photo_proof_setup.sql` | Photo proof for failures |
| 3 | `scheduled_goals_setup.sql` | Goals with frequency tracking |
| 4 | `group_chat_setup.sql` | In-app messaging |
| 5 | `auto_failure_setup.sql` | Auto-penalty when goals are missed |
| 6 | `enhanced_goals_setup.sql` | Positive/Negative modes, weekly stats, graphs |
| 7 | `migrations/007_*.sql` | Activity log, streaks, leaderboards, badges |
| 8 | `migrations/008_*.sql` | Missing activity log triggers |
| 9 | `migrations/010_*.sql` | RLS policies & server-side hardening |
| 10 | `migrations/011_*.sql` | `log_failure` balance maths fix |
| 11 | `migrations/012_*.sql` | Push tokens, notification outbox, triggers |
| 12 | `migrations/013_*.sql` | RLS on `goal_templates` (was wide open) |

There is no `009`.

## Push notifications

Two independent paths — see `src/services/notifications.ts`.

**Local deadline reminders** need nothing here. They are scheduled on-device
from the user's own goals and keep working if the backend is down entirely.
This is the load-bearing half.

**Remote push** (a mate logged a failure, someone joined) needs all of:

1. `migrations/012_push_notifications.sql` applied — creates `push_tokens` and
   `notification_outbox`, plus triggers that enqueue on failures, completions
   and joins.
2. A real EAS project id in `app.json` → `extra.eas.projectId`. It currently
   holds the literal placeholder `"your-project-id"`, so token registration
   no-ops and only local reminders fire.
3. FCM credentials uploaded to EAS for Android (`eas credentials`).
4. The `send-push` Edge Function deployed:
   ```bash
   npx supabase functions deploy send-push
   ```
   It reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the function
   environment (both are injected automatically) and needs the service role
   because RLS deliberately hides other users' push tokens.
5. Something invoking it on a schedule — the GitHub Action above already does,
   since there is no `pg_cron` on the free tier.

Missing steps 2–5 degrade gracefully: the app never errors, users just get
local reminders only.

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
