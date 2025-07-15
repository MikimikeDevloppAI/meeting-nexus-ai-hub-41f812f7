-- Créer la table de liaison todo_meetings
CREATE TABLE public.todo_meetings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id uuid NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(todo_id, meeting_id)
);

-- Activer RLS sur la nouvelle table
ALTER TABLE public.todo_meetings ENABLE ROW LEVEL SECURITY;

-- Créer les politiques RLS pour todo_meetings
CREATE POLICY "allow_all_todo_meetings" ON public.todo_meetings FOR ALL USING (true) WITH CHECK (true);

-- Migrer les données existantes - créer des liens pour tous les todos qui ont un meeting_id
INSERT INTO public.todo_meetings (todo_id, meeting_id)
SELECT id, meeting_id 
FROM public.todos 
WHERE meeting_id IS NOT NULL;

-- Supprimer la colonne meeting_id de la table todos
ALTER TABLE public.todos DROP COLUMN meeting_id;