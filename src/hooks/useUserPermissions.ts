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

  const checkIsAdmin = async () => {
    if (!user?.email) return false;
    
    const { data } = await supabase
      .from('admin_users')
      .select('user_email')
      .eq('user_email', user.email)
      .single();
    
    return !!data;
  };

  const fetchPermissions = async () => {
    if (!user) {
      setPermissions([]);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    try {
      // Vérifier si l'utilisateur est admin
      const adminStatus = await checkIsAdmin();
      setIsAdmin(adminStatus);

      // Récupérer les permissions
      const { data: permissionsData } = await supabase
        .from('user_permissions')
        .select('page_id, granted')
        .eq('user_id', user.id);

      setPermissions(permissionsData || []);
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