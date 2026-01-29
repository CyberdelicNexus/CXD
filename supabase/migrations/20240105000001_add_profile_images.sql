-- Add cover image and profile picture to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS cover_image TEXT,
ADD COLUMN IF NOT EXISTS cover_image_position JSONB DEFAULT '{"x": 0, "y": 0}'::jsonb,
ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.users.cover_image IS 'URL to user cover image stored in Supabase storage';
COMMENT ON COLUMN public.users.cover_image_position IS 'Position object for cover image repositioning {x: number, y: number}';
COMMENT ON COLUMN public.users.profile_picture IS 'URL to user profile picture stored in Supabase storage';
