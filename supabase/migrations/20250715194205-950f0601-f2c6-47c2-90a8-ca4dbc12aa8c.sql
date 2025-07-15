-- Supprimer les politiques actuelles qui posent problème
DROP POLICY IF EXISTS "Users with users permission can manage all permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view their own permissions" ON public.user_permissions;

-- Créer des politiques plus directes qui évitent la récursion
-- Politique pour voir ses propres permissions
CREATE POLICY "Users can view their own permissions" 
ON public.user_permissions 
FOR SELECT 
USING (user_id = auth.uid());

-- Politique pour que les utilisateurs avec permission "users" puissent tout gérer
-- On utilise une sous-requête directe au lieu de la fonction pour éviter la récursion
CREATE POLICY "Users with users permission can manage all permissions" 
ON public.user_permissions 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_permissions up 
    WHERE up.user_id = auth.uid() 
    AND up.page_id = 'users' 
    AND up.granted = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_permissions up 
    WHERE up.user_id = auth.uid() 
    AND up.page_id = 'users' 
    AND up.granted = true
  )
);