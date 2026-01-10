-- Update the canvas-uploads bucket to allow all file types
UPDATE storage.buckets
SET 
  allowed_mime_types = NULL,
  file_size_limit = 52428800 -- 50MB
WHERE id = 'canvas-uploads';
