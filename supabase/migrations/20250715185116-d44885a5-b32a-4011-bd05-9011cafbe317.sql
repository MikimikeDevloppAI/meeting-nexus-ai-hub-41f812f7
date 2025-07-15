-- Corriger les politiques RLS de user_permissions
-- Supprimer les anciennes politiques problématiques
DROP POLICY IF EXISTS "Admins can manage all permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admins can view all permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view their own permissions" ON public.user_permissions;

-- Créer une fonction security definer pour vérifier si un utilisateur est admin
CREATE OR REPLACE FUNCTION public.is_admin_user(user_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE admin_users.user_email = is_admin_user.user_email
  );
$$;

-- Créer une fonction pour récupérer l'email de l'utilisateur courant
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(auth.jwt() ->> 'email', '');
$$;

-- Nouvelles politiques RLS corrigées
CREATE POLICY "Admins can manage all permissions" 
ON public.user_permissions 
FOR ALL
USING (public.is_admin_user(public.get_current_user_email()));

CREATE POLICY "Users can view their own permissions" 
ON public.user_permissions 
FOR SELECT 
USING (user_id = auth.uid());