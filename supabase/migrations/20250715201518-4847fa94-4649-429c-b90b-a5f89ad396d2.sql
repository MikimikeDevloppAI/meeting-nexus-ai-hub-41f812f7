-- Supprimer la table participants et ses dépendances
DROP TABLE IF EXISTS meeting_participants CASCADE;
DROP TABLE IF EXISTS todo_participants CASCADE;
DROP TABLE IF EXISTS participants CASCADE;

-- Créer la nouvelle table meeting_users
CREATE TABLE public.meeting_users (
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (meeting_id, user_id)
);

-- Créer la nouvelle table todo_users
CREATE TABLE public.todo_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id uuid NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(todo_id, user_id)
);

-- Activer RLS sur les nouvelles tables
ALTER TABLE public.meeting_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_users ENABLE ROW LEVEL SECURITY;

-- Créer les politiques RLS pour meeting_users
CREATE POLICY "allow_all_meeting_users" ON public.meeting_users FOR ALL USING (true) WITH CHECK (true);

-- Créer les politiques RLS pour todo_users
CREATE POLICY "allow_all_todo_users" ON public.todo_users FOR ALL USING (true) WITH CHECK (true);