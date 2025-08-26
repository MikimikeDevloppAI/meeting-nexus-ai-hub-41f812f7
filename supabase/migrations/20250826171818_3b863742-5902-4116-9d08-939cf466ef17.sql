
-- Policies pour le bucket meeting-audio

-- Lecture publique des fichiers du bucket meeting-audio
CREATE POLICY IF NOT EXISTS "Public read access for meeting-audio"
ON storage.objects
FOR SELECT
USING (bucket_id = 'meeting-audio');

-- Upload (INSERT) autorisé aux utilisateurs authentifiés
CREATE POLICY IF NOT EXISTS "Authenticated users can upload meeting-audio"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'meeting-audio' AND auth.role() = 'authenticated');

-- Mise à jour (UPDATE) autorisée aux utilisateurs authentifiés
CREATE POLICY IF NOT EXISTS "Authenticated users can update meeting-audio"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'meeting-audio' AND auth.role() = 'authenticated');

-- Suppression (DELETE) autorisée aux utilisateurs authentifiés
CREATE POLICY IF NOT EXISTS "Authenticated users can delete meeting-audio"
ON storage.objects
FOR DELETE
USING (bucket_id = 'meeting-audio' AND auth.role() = 'authenticated');
