
-- Créer le bucket pour les templates de lettres
INSERT INTO storage.buckets (id, name, public)
VALUES ('letter-templates', 'letter-templates', true);

-- Créer une politique pour permettre à tous d'uploader des templates
CREATE POLICY "Everyone can upload letter templates"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'letter-templates');

-- Créer une politique pour permettre à tous de voir les templates
CREATE POLICY "Everyone can view letter templates"
ON storage.objects FOR SELECT
USING (bucket_id = 'letter-templates');

-- Créer une politique pour permettre à tous de supprimer les templates
CREATE POLICY "Everyone can delete letter templates"
ON storage.objects FOR DELETE
USING (bucket_id = 'letter-templates');
