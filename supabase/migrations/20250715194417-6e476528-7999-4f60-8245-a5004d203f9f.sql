-- Supprimer les politiques restrictives actuelles
DROP POLICY IF EXISTS "Users with users permission can manage all permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view their own permissions" ON public.user_permissions;

-- Créer des politiques permissives pour tous les utilisateurs authentifiés
CREATE POLICY "Authenticated users can view all permissions" 
ON public.user_permissions 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert permissions" 
ON public.user_permissions 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update permissions" 
ON public.user_permissions 
FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete permissions" 
ON public.user_permissions 
FOR DELETE 
USING (auth.role() = 'authenticated');