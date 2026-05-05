-- AI Chat Threads: Persists chat history per project, per user, per face/general
CREATE TABLE IF NOT EXISTS public.ai_chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.cxd_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  face_key TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_thread_per_face UNIQUE (project_id, user_id, face_key)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_chat_threads_lookup
  ON public.ai_chat_threads (project_id, user_id, face_key);

-- RLS: Users can only access their own threads
ALTER TABLE public.ai_chat_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own threads"
  ON public.ai_chat_threads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own threads"
  ON public.ai_chat_threads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own threads"
  ON public.ai_chat_threads FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own threads"
  ON public.ai_chat_threads FOR DELETE
  USING (auth.uid() = user_id);
