-- Créer une table pour les sous-tâches
CREATE TABLE public.todo_subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id UUID NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Créer une table pour les pièces jointes des todos
CREATE TABLE public.todo_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id UUID NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  content_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Créer un bucket de stockage pour les pièces jointes des todos
INSERT INTO storage.buckets (id, name, public) VALUES ('todo-attachments', 'todo-attachments', true);

-- Activer RLS sur les nouvelles tables
ALTER TABLE public.todo_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_attachments ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour todo_subtasks - tous les utilisateurs authentifiés peuvent tout faire
CREATE POLICY "Authenticated users can manage all subtasks" 
ON public.todo_subtasks 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Politiques RLS pour todo_attachments - tous les utilisateurs authentifiés peuvent tout faire
CREATE POLICY "Authenticated users can manage all attachments" 
ON public.todo_attachments 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Politiques de stockage pour todo-attachments - tous les utilisateurs authentifiés peuvent tout faire
CREATE POLICY "Authenticated users can view all todo attachments" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (bucket_id = 'todo-attachments');

CREATE POLICY "Authenticated users can upload todo attachments" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'todo-attachments');

CREATE POLICY "Authenticated users can update todo attachments" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (bucket_id = 'todo-attachments');

CREATE POLICY "Authenticated users can delete todo attachments" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (bucket_id = 'todo-attachments');

-- Index pour améliorer les performances
CREATE INDEX idx_todo_subtasks_todo_id ON public.todo_subtasks(todo_id);
CREATE INDEX idx_todo_attachments_todo_id ON public.todo_attachments(todo_id);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at sur todo_subtasks
CREATE TRIGGER update_todo_subtasks_updated_at
  BEFORE UPDATE ON public.todo_subtasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();