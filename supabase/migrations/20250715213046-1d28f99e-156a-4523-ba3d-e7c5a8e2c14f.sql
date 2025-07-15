-- Créer la table pour les heures supplémentaires
CREATE TABLE public.overtime_hours (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date date NOT NULL,
  hours decimal(4,2) NOT NULL CHECK (hours > 0),
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Créer la table pour les vacances
CREATE TABLE public.vacations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_count integer NOT NULL CHECK (days_count > 0),
  description text,
  vacation_type text NOT NULL DEFAULT 'annual' CHECK (vacation_type IN ('annual', 'sick', 'personal', 'other')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Ajouter des contraintes pour s'assurer que end_date >= start_date
ALTER TABLE public.vacations ADD CONSTRAINT check_vacation_dates CHECK (end_date >= start_date);

-- Enable RLS sur les deux tables
ALTER TABLE public.overtime_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacations ENABLE ROW LEVEL SECURITY;

-- Policies pour overtime_hours (RLS - chaque utilisateur ne voit que les siennes)
CREATE POLICY "Users can view their own overtime hours" 
ON public.overtime_hours 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own overtime hours" 
ON public.overtime_hours 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending overtime hours" 
ON public.overtime_hours 
FOR UPDATE 
USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Users can delete their own pending overtime hours" 
ON public.overtime_hours 
FOR DELETE 
USING (auth.uid() = user_id AND status = 'pending');

-- Policies pour vacations (visible par tous)
CREATE POLICY "Everyone can view all vacations" 
ON public.vacations 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own vacations" 
ON public.vacations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending vacations" 
ON public.vacations 
FOR UPDATE 
USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Users can delete their own pending vacations" 
ON public.vacations 
FOR DELETE 
USING (auth.uid() = user_id AND status = 'pending');

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_overtime_hours_updated_at
BEFORE UPDATE ON public.overtime_hours
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vacations_updated_at
BEFORE UPDATE ON public.vacations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Ajouter la page pour la validation des heures supplémentaires et vacances
INSERT INTO public.pages (id, name, path, description) 
VALUES ('hr-validation', 'Validation RH', '/hr-validation', 'Validation des heures supplémentaires et des vacances')
ON CONFLICT (id) DO NOTHING;