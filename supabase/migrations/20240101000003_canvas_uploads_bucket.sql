INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'canvas-uploads',
  'canvas-uploads',
  true,
  52428800, -- 50MB limit
  NULL -- Allow all file types
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view canvas uploads" ON storage.objects
FOR SELECT USING (bucket_id = 'canvas-uploads');

CREATE POLICY "Authenticated users can upload canvas images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'canvas-uploads' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own canvas uploads" ON storage.objects
FOR DELETE USING (
  bucket_id = 'canvas-uploads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
