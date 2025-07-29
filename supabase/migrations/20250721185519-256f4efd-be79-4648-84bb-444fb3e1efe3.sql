-- Ajouter une colonne pour stocker le texte extrait des fichiers
ALTER TABLE todo_attachments 
ADD COLUMN extracted_text TEXT;