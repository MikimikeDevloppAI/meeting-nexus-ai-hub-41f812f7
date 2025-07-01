
-- Supprimer la colonne assigned_to de la table todos
ALTER TABLE public.todos DROP COLUMN IF EXISTS assigned_to;
