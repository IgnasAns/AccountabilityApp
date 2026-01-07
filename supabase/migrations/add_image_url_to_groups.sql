-- Add image_url column to groups table
-- Run this in your Supabase Dashboard SQL Editor

ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Update RLS policies to allow updating groups (if not already present)
-- This ensures users can update the image_url
CREATE POLICY "Authenticated users can update their groups."
ON public.groups FOR UPDATE
USING (
    created_by = auth.uid()
);
