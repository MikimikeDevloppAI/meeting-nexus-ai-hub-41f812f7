
-- Créer une table pour les notes de préparation de réunion
CREATE TABLE public.meeting_preparation_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id UUID REFERENCES public.todos(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Créer une table pour les points additionnels ajoutés par les utilisateurs
CREATE TABLE public.meeting_preparation_custom_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  point_text TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Activer RLS sur les deux tables
ALTER TABLE public.meeting_preparation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_preparation_custom_points ENABLE ROW LEVEL SECURITY;

-- Politiques pour meeting_preparation_notes (lecture/écriture pour tous)
CREATE POLICY "Anyone can view meeting preparation notes" 
  ON public.meeting_preparation_notes 
  FOR SELECT 
  USING (true);

CREATE POLICY "Anyone can create meeting preparation notes" 
  ON public.meeting_preparation_notes 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Anyone can update meeting preparation notes" 
  ON public.meeting_preparation_notes 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Anyone can delete meeting preparation notes" 
  ON public.meeting_preparation_notes 
  FOR DELETE 
  USING (true);

-- Politiques pour meeting_preparation_custom_points (lecture/écriture pour tous)
CREATE POLICY "Anyone can view custom points" 
  ON public.meeting_preparation_custom_points 
  FOR SELECT 
  USING (true);

CREATE POLICY "Anyone can create custom points" 
  ON public.meeting_preparation_custom_points 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Anyone can update custom points" 
  ON public.meeting_preparation_custom_points 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Anyone can delete custom points" 
  ON public.meeting_preparation_custom_points 
  FOR DELETE 
  USING (true);
