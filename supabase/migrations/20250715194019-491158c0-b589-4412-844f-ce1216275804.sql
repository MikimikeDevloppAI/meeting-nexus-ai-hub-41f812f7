-- Donner à tous les utilisateurs existants l'accès à toutes les pages existantes
INSERT INTO public.user_permissions (user_id, page_id, granted)
SELECT u.id, p.id, true
FROM public.users u
CROSS JOIN public.pages p
ON CONFLICT (user_id, page_id) DO UPDATE SET granted = true;