-- Add face metadata columns for display in chat history
-- face_label: display name of the face at time of creation
-- face_hue: HSL hue value for the face color indicator

ALTER TABLE public.ai_chat_threads
  ADD COLUMN IF NOT EXISTS face_label TEXT,
  ADD COLUMN IF NOT EXISTS face_hue INT;
