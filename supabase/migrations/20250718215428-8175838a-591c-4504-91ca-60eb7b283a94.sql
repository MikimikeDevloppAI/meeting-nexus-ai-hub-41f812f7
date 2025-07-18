-- Créer une table pour les quotas de vacances par année et par utilisateur
CREATE TABLE public.vacation_quotas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  year integer NOT NULL,
  quota_days integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, year)
);

-- Enable RLS
ALTER TABLE public.vacation_quotas ENABLE ROW LEVEL SECURITY;

-- Policies pour permettre à HR de gérer les quotas
CREATE POLICY "HR can view all vacation quotas" 
ON public.vacation_quotas 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.user_permissions up 
  WHERE up.user_id = auth.uid() 
  AND up.page_id = 'hr-validation' 
  AND up.granted = true
));

CREATE POLICY "HR can manage vacation quotas" 
ON public.vacation_quotas 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.user_permissions up 
  WHERE up.user_id = auth.uid() 
  AND up.page_id = 'hr-validation' 
  AND up.granted = true
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_permissions up 
  WHERE up.user_id = auth.uid() 
  AND up.page_id = 'hr-validation' 
  AND up.granted = true
));

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_vacation_quotas_updated_at
BEFORE UPDATE ON public.vacation_quotas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();