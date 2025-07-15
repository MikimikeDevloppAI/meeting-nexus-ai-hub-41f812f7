import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface UserPermission {
  page_id: string;
  granted: boolean;
}

export const useUserPermissions = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const hasPermission = (pageId: string): boolean => {
    const permission = permissions.find(p => p.page_id === pageId);
    return permission?.granted ?? false;
  };

  const fetchPermissions = async () => {
    if (!user) {
      setPermissions([]);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    try {
      // Récupérer les permissions
      const { data: permissionsData, error: permError } = await supabase
        .from('user_permissions')
        .select('page_id, granted')
        .eq('user_id', user.id);

      console.log('Permissions data for user:', user.id, permissionsData);
      console.log('Permissions error:', permError);

      setPermissions(permissionsData || []);
      
      // Vérifier si l'utilisateur a la permission "users" (équivalent admin)
      const hasUsersPermission = permissionsData?.some(p => p.page_id === 'users' && p.granted) || false;
      setIsAdmin(hasUsersPermission);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setPermissions([]);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [user]);

  return {
    permissions,
    hasPermission,
    isAdmin,
    loading,
    refetch: fetchPermissions
  };
};