-- Créer une fonction pour permettre l'accès à toutes les heures supplémentaires (pour David)
CREATE OR REPLACE FUNCTION public.get_all_overtime_hours()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  date date,
  hours decimal(4,2),
  description text,
  status text,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  users jsonb
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    oh.id,
    oh.user_id,
    oh.date,
    oh.hours,
    oh.description,
    oh.status,
    oh.approved_by,
    oh.approved_at,
    oh.created_at,
    oh.updated_at,
    jsonb_build_object('name', u.name, 'email', u.email) as users
  FROM public.overtime_hours oh
  LEFT JOIN public.users u ON oh.user_id = u.id
  ORDER BY oh.date DESC;
$$;

-- Policies pour permettre à la page RH de modifier les statuts (pour David uniquement)
CREATE POLICY "HR can view all overtime hours" 
ON public.overtime_hours 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.user_permissions up 
  WHERE up.user_id = auth.uid() 
  AND up.page_id = 'hr-validation' 
  AND up.granted = true
));

CREATE POLICY "HR can approve/reject overtime hours" 
ON public.overtime_hours 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.user_permissions up 
  WHERE up.user_id = auth.uid() 
  AND up.page_id = 'hr-validation' 
  AND up.granted = true
));

CREATE POLICY "HR can approve/reject vacations" 
ON public.vacations 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.user_permissions up 
  WHERE up.user_id = auth.uid() 
  AND up.page_id = 'hr-validation' 
  AND up.granted = true
));

-- Ajouter la page time-tracking pour tous les utilisateurs
INSERT INTO public.pages (id, name, path, description) 
VALUES ('time-tracking', 'Gestion du temps', '/time-tracking', 'Gestion des heures supplémentaires et vacances')
ON CONFLICT (id) DO NOTHING;