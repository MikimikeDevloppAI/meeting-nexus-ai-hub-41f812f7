-- Ajouter le champ google_drive_link à la table uploaded_documents
ALTER TABLE public.uploaded_documents 
ADD COLUMN google_drive_link TEXT;