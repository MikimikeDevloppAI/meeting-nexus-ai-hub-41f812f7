-- Ajouter une colonne pour stocker l'URL du PDF original
ALTER TABLE public.letter_templates 
ADD COLUMN original_pdf_url TEXT;