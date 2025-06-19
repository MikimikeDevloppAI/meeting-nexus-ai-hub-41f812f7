
-- Créer une table pour stocker les recherches deep search des tâches
CREATE TABLE public.task_deep_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id UUID NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  user_context TEXT NOT NULL,
  search_query TEXT NOT NULL,
  search_result TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Activer RLS pour sécuriser l'accès
ALTER TABLE public.task_deep_searches ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre aux utilisateurs de voir toutes les recherches (collaboration)
CREATE POLICY "Users can view all task deep searches" 
  ON public.task_deep_searches 
  FOR SELECT 
  USING (true);

-- Politique pour permettre aux utilisateurs de créer des recherches
CREATE POLICY "Users can create task deep searches" 
  ON public.task_deep_searches 
  FOR INSERT 
  WITH CHECK (auth.uid() = created_by);

-- Index pour optimiser les requêtes par tâche
CREATE INDEX idx_task_deep_searches_todo_id ON public.task_deep_searches(todo_id);
