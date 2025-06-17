
-- Supprimer les anciennes politiques s'il y en a
DROP POLICY IF EXISTS "Tous les utilisateurs peuvent voir les documents" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent uploader des documents" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent mettre à jour leurs documents" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent supprimer leurs documents" ON storage.objects;

-- Créer les bonnes politiques RLS pour le bucket documents
CREATE POLICY "Public read access for documents" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'documents');

CREATE POLICY "Authenticated users can upload documents" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update documents" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete documents" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- S'assurer que le bucket est public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'documents';
