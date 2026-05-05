-- Add profile image columns to users table
-- Run this in your Supabase SQL editor if columns don't exist

-- Add cover_image column
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_image TEXT;

-- Add cover_image_position column (stores x,y coordinates as JSON)
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_image_position JSONB DEFAULT '{"x": 0, "y": 0}';

-- Add profile_picture column
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_cover_image ON users(cover_image) WHERE cover_image IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_profile_picture ON users(profile_picture) WHERE profile_picture IS NOT NULL;

-- Update RLS policies to allow users to update their own profile images
-- First, drop existing update policy if it exists
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Create policy that allows users to update their own record
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure select policy exists
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT
  USING (auth.uid() = id);
