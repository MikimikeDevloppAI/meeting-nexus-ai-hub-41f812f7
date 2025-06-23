
-- Créer une table pour stocker les questions de suivi de la deep search
CREATE TABLE public.task_deep_search_followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deep_search_id UUID NOT NULL REFERENCES public.task_deep_searches(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Ajouter RLS pour sécuriser l'accès
ALTER TABLE public.task_deep_search_followups ENABLE ROW LEVEL SECURITY;

-- Créer les politiques RLS
CREATE POLICY "Users can view followups for their deep searches" 
  ON public.task_deep_search_followups 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.task_deep_searches tds 
      WHERE tds.id = deep_search_id 
      AND tds.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create followups for their deep searches" 
  ON public.task_deep_search_followups 
  FOR INSERT 
  WITH CHECK (
    auth.uid() = created_by 
    AND EXISTS (
      SELECT 1 FROM public.task_deep_searches tds 
      WHERE tds.id = deep_search_id 
      AND tds.created_by = auth.uid()
    )
  );

-- Créer un index pour améliorer les performances
CREATE INDEX idx_task_deep_search_followups_deep_search_id 
  ON public.task_deep_search_followups(deep_search_id);
