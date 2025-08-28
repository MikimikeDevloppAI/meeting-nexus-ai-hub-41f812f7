-- Upload the OphtaCare HUB logo to the branding bucket
-- First, ensure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('branding', 'branding', true, 52428800, ARRAY['image/*'])
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = COALESCE(storage.buckets.file_size_limit, 52428800),
  allowed_mime_types = COALESCE(storage.buckets.allowed_mime_types, ARRAY['image/*']);

-- Create logo directory structure
-- Note: We'll need to manually upload the file to storage.objects or use the storage API