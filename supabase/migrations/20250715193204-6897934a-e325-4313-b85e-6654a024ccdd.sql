-- 1. Créer la page "users" pour la gestion des utilisateurs
INSERT INTO public.pages (id, name, path, description) 
VALUES ('users', 'Gestion Utilisateurs', '/users', 'Gestion des utilisateurs et permissions')
ON CONFLICT (id) DO NOTHING;

-- 2. Avant de supprimer admin_users, donner la permission "users" aux administrateurs existants
INSERT INTO public.user_permissions (user_id, page_id, granted)
SELECT u.id, 'users', true
FROM public.users u
WHERE u.email IN (SELECT user_email FROM public.admin_users)
ON CONFLICT (user_id, page_id) DO UPDATE SET granted = true;

-- 3. Supprimer les anciennes politiques RLS de user_permissions
DROP POLICY IF EXISTS "Admins can manage all permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view their own permissions" ON public.user_permissions;

-- 4. Supprimer les fonctions qui ne seront plus nécessaires
DROP FUNCTION IF EXISTS public.is_admin_user(text);
DROP FUNCTION IF EXISTS public.get_current_user_email();

-- 5. Créer une nouvelle fonction pour vérifier les permissions utilisateur
CREATE OR REPLACE FUNCTION public.user_has_permission(user_id_param uuid, page_id_param text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions 
    WHERE user_id = user_id_param 
    AND page_id = page_id_param 
    AND granted = true
  );
$$;

-- 6. Créer les nouvelles politiques RLS pour user_permissions
CREATE POLICY "Users with users permission can manage all permissions" 
ON public.user_permissions 
FOR ALL
USING (public.user_has_permission(auth.uid(), 'users'));

CREATE POLICY "Users can view their own permissions" 
ON public.user_permissions 
FOR SELECT 
USING (user_id = auth.uid());

-- 7. Supprimer la table admin_users
DROP TABLE IF EXISTS public.admin_users;