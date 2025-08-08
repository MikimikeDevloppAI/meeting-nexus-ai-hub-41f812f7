-- Create public branding bucket and read policy
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'branding') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('branding', 'branding', true);
  END IF;
END $$;

-- Allow public read access to branding bucket objects
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Branding public read'
  ) THEN
    CREATE POLICY "Branding public read"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'branding');
  END IF;
END $$;