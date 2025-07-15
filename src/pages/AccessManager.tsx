import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Users, Settings } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  approved: boolean;
}

interface Page {
  id: string;
  name: string;
  path: string;
  description: string;
}

interface Permission {
  user_id: string;
  page_id: string;
  granted: boolean;
}

export default function AccessManager() {
  const { isAdmin, loading: permissionsLoading } = useUserPermissions();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [usersResponse, pagesResponse, permissionsResponse] = await Promise.all([
        supabase.from('users').select('*').eq('approved', true).order('name'),
        supabase.from('pages').select('*').order('name'),
        supabase.from('user_permissions').select('*')
      ]);

      setUsers(usersResponse.data || []);
      setPages(pagesResponse.data || []);
      setPermissions(permissionsResponse.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!permissionsLoading && isAdmin) {
      fetchData();
    } else if (!permissionsLoading && !isAdmin) {
      setLoading(false);
    }
  }, [permissionsLoading, isAdmin]);

  const hasPermission = (userId: string, pageId: string): boolean => {
    const permission = permissions.find(p => p.user_id === userId && p.page_id === pageId);
    return permission?.granted ?? false;
  };

  const togglePermission = (userId: string, pageId: string) => {
    const currentPermission = hasPermission(userId, pageId);
    const existingPermissionIndex = permissions.findIndex(
      p => p.user_id === userId && p.page_id === pageId
    );

    if (existingPermissionIndex >= 0) {
      const updatedPermissions = [...permissions];
      updatedPermissions[existingPermissionIndex].granted = !currentPermission;
      setPermissions(updatedPermissions);
    } else {
      setPermissions([...permissions, {
        user_id: userId,
        page_id: pageId,
        granted: !currentPermission
      }]);
    }
  };

  const savePermissions = async () => {
    setSaving(true);
    try {
      // Supprimer toutes les permissions existantes puis les recréer
      await supabase.from('user_permissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Insérer les nouvelles permissions
      const permissionsToInsert = permissions.map(p => ({
        user_id: p.user_id,
        page_id: p.page_id,
        granted: p.granted
      }));

      if (permissionsToInsert.length > 0) {
        const { error } = await supabase
          .from('user_permissions')
          .insert(permissionsToInsert);

        if (error) throw error;
      }

      toast({
        title: "Succès",
        description: "Les permissions ont été sauvegardées",
      });
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les permissions",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (permissionsLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-96">
          <CardHeader className="text-center">
            <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <CardTitle>Accès refusé</CardTitle>
            <CardDescription>
              Vous n'avez pas les permissions nécessaires pour accéder à cette page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Users className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Gestion des Accès</h1>
        </div>
        <p className="text-muted-foreground">
          Gérez les permissions d'accès aux pages pour chaque utilisateur.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Permissions par Utilisateur</CardTitle>
              <CardDescription>
                Activez ou désactivez l'accès aux pages pour chaque utilisateur approuvé.
              </CardDescription>
            </div>
            <Button onClick={savePermissions} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Sauvegarder
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Utilisateur</th>
                  {pages.map(page => (
                    <th key={page.id} className="text-center p-3 font-medium min-w-[120px]">
                      <div className="text-sm">{page.name}</div>
                      <div className="text-xs text-muted-foreground">{page.path}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </td>
                     {pages.map(page => (
                       <td key={`${user.id}-${page.id}`} className="p-3 text-center">
                         <Switch
                           checked={hasPermission(user.id, page.id)}
                           onCheckedChange={() => {
                             console.log(`Toggling permission for user ${user.id} on page ${page.id}`);
                             togglePermission(user.id, page.id);
                           }}
                           disabled={saving}
                         />
                       </td>
                     ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {users.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Aucun utilisateur approuvé trouvé.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}