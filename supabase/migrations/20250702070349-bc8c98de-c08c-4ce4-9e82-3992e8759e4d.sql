
-- Supprimer les anciennes politiques RLS restrictives
DROP POLICY IF EXISTS "Users can view their own templates" ON public.letter_templates;
DROP POLICY IF EXISTS "Users can create their own templates" ON public.letter_templates;
DROP POLICY IF EXISTS "Users can delete their own templates" ON public.letter_templates;

-- Modifier la table pour rendre user_id optionnel
ALTER TABLE public.letter_templates ALTER COLUMN user_id DROP NOT NULL;

-- Créer de nouvelles politiques publiques
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
