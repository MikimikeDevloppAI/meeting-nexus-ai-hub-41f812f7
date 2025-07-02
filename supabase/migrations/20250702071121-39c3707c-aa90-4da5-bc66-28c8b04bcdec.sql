
-- Créer la table pour les templates de lettres
CREATE TABLE public.letter_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  user_id UUID REFERENCES auth.users NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Activer RLS
ALTER TABLE public.letter_templates ENABLE ROW LEVEL SECURITY;

-- Créer des politiques publiques pour que tous les utilisateurs puissent accéder aux templates
CREATE POLICY "Everyone can view all templates" 
  ON public.letter_templates 
  FOR SELECT 
  USING (true);

CREATE POLICY "Everyone can create templates" 
  ON public.letter_templates 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Everyone can delete templates" 
  ON public.letter_templates 
  FOR DELETE 
  USING (true);
