-- BACKFILL MISSING PROFILES
-- -----------------------------------------------------------------------------
-- INSTRUCTIONS:
-- 1. Copy the content of this file.
-- 2. Go to Supabase Dashboard > SQL Editor.
-- 3. Paste and Run.
-- -----------------------------------------------------------------------------

-- 1. Insert missing profiles for existing auth users
INSERT INTO public.profiles (id, name, created_at, updated_at)
SELECT 
    id, 
    -- Try to get name from metadata, fallback to email username, fallback to "User"
    COALESCE(
        raw_user_meta_data->>'name', 
        SPLIT_PART(email, '@', 1), 
        'User'
    ) as name,
    created_at,
    created_at
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 2. Validate the results
-- Both numbers below should now be equal (or very close)
SELECT 
    (SELECT count(*) FROM auth.users) as "Total Auth Users",
    (SELECT count(*) FROM public.profiles) as "Total Profiles";
