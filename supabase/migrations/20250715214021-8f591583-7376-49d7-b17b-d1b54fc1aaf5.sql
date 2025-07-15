-- Ajouter une contrainte de clé étrangère pour lier les vacations aux utilisateurs
ALTER TABLE public.vacations 
ADD CONSTRAINT fk_vacations_user_id 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Ajouter une contrainte de clé étrangère pour lier les overtime_hours aux utilisateurs
ALTER TABLE public.overtime_hours 
ADD CONSTRAINT fk_overtime_hours_user_id 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;