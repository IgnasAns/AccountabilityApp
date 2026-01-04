# Supabase Database Setup

## Quick Start

Run these SQL files in your Supabase Dashboard > SQL Editor in order:

1. **`full_setup.sql`** - Core database setup (profiles, groups, members, transactions)
2. **`photo_proof_setup.sql`** - Photo proof feature (storage bucket, column)
3. **`scheduled_goals_setup.sql`** - Scheduled goals feature (goals, completions)
4. **`group_chat_setup.sql`** - Group chat feature (messages, real-time)

## Files

| File | Description |
|------|-------------|
| `full_setup.sql` | Complete base schema with RLS policies |
| `photo_proof_setup.sql` | Photo proof for failures |
| `scheduled_goals_setup.sql` | Goals with frequency tracking |
| `group_chat_setup.sql` | In-app messaging |

## /migrations (Legacy)

Old one-time migration scripts, kept for reference:
- `backfill_profiles.sql` - Fix missing profiles
- `fix_invite_codes.sql` - Shorten invite codes  
- `critical_fix.sql` - RLS recursion fix
- `add_delete_policies.sql` - Delete permission policies
- `schema.sql` - Original schema (superseded by full_setup.sql)
