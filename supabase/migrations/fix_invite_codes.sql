-- ===========================================================================
-- FIX INVITE CODES - Run this to make invite codes shorter and user-friendly
-- ===========================================================================

-- 1. Update the groups table default to generate short codes
ALTER TABLE public.groups 
ALTER COLUMN invite_code SET DEFAULT upper(substring(md5(random()::text) from 1 for 8));

-- 2. Update all existing groups with long invite codes to have short ones
UPDATE public.groups 
SET invite_code = upper(substring(md5(random()::text) from 1 for 8))
WHERE length(invite_code) > 8;

-- 3. Verify the fix
SELECT id, name, invite_code, length(invite_code) as code_length FROM public.groups;
