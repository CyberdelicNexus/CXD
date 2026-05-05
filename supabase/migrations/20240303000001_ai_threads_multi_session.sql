-- Multi-session support for AI chat threads
-- Adds title, is_active, is_archived columns and replaces unique constraint

-- Add new columns
ALTER TABLE public.ai_chat_threads
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Drop the old unique constraint (one thread per face)
ALTER TABLE public.ai_chat_threads
  DROP CONSTRAINT IF EXISTS unique_thread_per_face;

-- Add partial unique index: only one ACTIVE thread per project+user+face
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_threads_active_unique
  ON public.ai_chat_threads (project_id, user_id, face_key)
  WHERE is_active = true;

-- Index for listing archived threads efficiently
CREATE INDEX IF NOT EXISTS idx_ai_threads_archived
  ON public.ai_chat_threads (project_id, user_id, face_key, is_archived, updated_at DESC);
