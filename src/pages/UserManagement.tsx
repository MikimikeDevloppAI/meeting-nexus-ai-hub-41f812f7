
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserPlus, Mail, Calendar, CheckCircle, XCircle, Settings, Save, Loader2, HelpCircle, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { supabase } from "@/integrations/supabase/client";

interface User {
  id: string;
  name: string;
  email: string;
  approved: boolean;
  created_at: string;
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

interface HelpInfo {
  id?: string;
  page_id: string;
  page_name: string;
  help_content: string;
}

const UserManagement = () => {
  const { isAdmin, loading: permissionsLoading } = useUserPermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [helpInfos, setHelpInfos] = useState<HelpInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!permissionsLoading && isAdmin) {
      fetchData();
    } else if (!permissionsLoading && !isAdmin) {
      setIsLoading(false);
    }
  }, [permissionsLoading, isAdmin]);

  const fetchData = async () => {
    try {
      const [usersResponse, pagesResponse, permissionsResponse, helpResponse] = await Promise.all([
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        supabase.from('pages').select('*').neq('id', 'access-manager').order('name'),
        supabase.from('user_permissions').select('*'),
        supabase.from('page_help_information').select('*')
      ]);

      if (usersResponse.error) throw usersResponse.error;
      if (pagesResponse.error) throw pagesResponse.error;
      if (permissionsResponse.error) throw permissionsResponse.error;
      if (helpResponse.error) throw helpResponse.error;

      setUsers(usersResponse.data || []);
      setPages(pagesResponse.data || []);
      setPermissions(permissionsResponse.data || []);
      
      // Créer les objets d'aide pour toutes les pages
      const existingHelp = helpResponse.data || [];
      const allPagesHelp = (pagesResponse.data || []).map(page => {
        const existing = existingHelp.find(h => h.page_id === page.id);
        return {
          id: existing?.id,
          page_id: page.id,
          page_name: page.name,
          help_content: existing?.help_content || ''
        };
      });
      setHelpInfos(allPagesHelp);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserApproval = async (userId: string, currentApproval: boolean) => {
    try {
      const { error } = await supabase
        .from("users")
        .update({ approved: !currentApproval })
        .eq("id", userId);

      if (error) throw error;

      setUsers(users.map(user => 
        user.id === userId 
          ? { ...user, approved: !currentApproval }
          : user
      ));

      toast({
        title: currentApproval ? "Utilisateur désactivé" : "Utilisateur approuvé",
        description: `L'utilisateur a été ${currentApproval ? 'désactivé' : 'approuvé'} avec succès.`,
      });
    } catch (error: any) {
      console.error("Error updating user approval:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le statut de l'utilisateur",
        variant: "destructive",
      });
    }
  };

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

  const updateHelpContent = (pageId: string, content: string) => {
    setHelpInfos(helpInfos.map(help => 
      help.page_id === pageId 
        ? { ...help, help_content: content }
        : help
    ));
  };

  const saveHelpInfo = async (pageId: string) => {
    const helpInfo = helpInfos.find(h => h.page_id === pageId);
    if (!helpInfo) return;

    try {
      if (helpInfo.id) {
        // Update existing
        const { error } = await supabase
          .from('page_help_information')
          .update({
            help_content: helpInfo.help_content,
            page_name: helpInfo.page_name
          })
          .eq('id', helpInfo.id);

        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('page_help_information')
          .insert({
            page_id: helpInfo.page_id,
            page_name: helpInfo.page_name,
            help_content: helpInfo.help_content
          })
          .select()
          .single();

        if (error) throw error;

        // Update local state with new ID
        setHelpInfos(helpInfos.map(h => 
          h.page_id === pageId 
            ? { ...h, id: data.id }
            : h
        ));
      }

      toast({
        title: "Succès",
        description: "Information d'aide sauvegardée avec succès",
      });
    } catch (error) {
      console.error('Error saving help info:', error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder l'information d'aide",
        variant: "destructive",
      });
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const approvedUsers = users.filter(user => user.approved).length;
  const pendingUsers = users.filter(user => !user.approved).length;

  if (permissionsLoading || isLoading) {
    return (
      <div className="animate-fade-in h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
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
    <div className="animate-fade-in h-full flex flex-col">
      <div className="mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestion des utilisateurs et accès</h1>
          <p className="text-muted-foreground">
            Gérez les utilisateurs et leurs autorisations d'accès aux différentes pages
          </p>
        </div>
      </div>

      <Tabs defaultValue="users" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Utilisateurs
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="help" className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Aide
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="flex-1 flex flex-col space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total utilisateurs</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{users.length}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Utilisateurs approuvés</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{approvedUsers}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">En attente d'approbation</CardTitle>
                <XCircle className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{pendingUsers}</div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Rechercher des utilisateurs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Input
                  placeholder="Rechercher par nom ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card className="flex-1">
            <CardHeader>
              <CardTitle>Liste des utilisateurs</CardTitle>
              <CardDescription>
                Gérez le statut d'approbation des utilisateurs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Date d'inscription</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {new Date(user.created_at).toLocaleDateString('fr-FR')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.approved ? "default" : "secondary"}>
                          {user.approved ? "Approuvé" : "En attente"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={user.approved}
                            onCheckedChange={() => toggleUserApproval(user.id, user.approved)}
                          />
                          <span className="text-sm text-muted-foreground">
                            {user.approved ? "Approuvé" : "En attente"}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {filteredUsers.length === 0 && (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Aucun utilisateur trouvé</h3>
                  <p className="text-muted-foreground">
                    {searchTerm ? "Aucun utilisateur ne correspond à votre recherche." : "Aucun utilisateur n'est encore inscrit."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="flex-1 flex flex-col">
          <Card className="flex-1">
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
                    {users.filter(user => user.approved).map(user => (
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
                               onCheckedChange={() => togglePermission(user.id, page.id)}
                               disabled={saving}
                             />
                           </td>
                         ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {users.filter(user => user.approved).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun utilisateur approuvé trouvé.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="help" className="flex-1 flex flex-col">
          <Card className="flex-1">
            <CardHeader>
              <CardTitle>Gestion de l'Aide</CardTitle>
              <CardDescription>
                Configurez les informations d'aide pour chaque page de l'application. Ces informations s'affichent quand les utilisateurs cliquent sur le bouton "Aide".
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead>Chemin</TableHead>
                    <TableHead className="w-1/2">Aide</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {helpInfos.map((helpInfo) => (
                    <TableRow key={helpInfo.page_id}>
                      <TableCell className="font-medium">{helpInfo.page_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {pages.find(p => p.id === helpInfo.page_id)?.path}
                      </TableCell>
                      <TableCell>
                        <Textarea
                          value={helpInfo.help_content}
                          onChange={(e) => updateHelpContent(helpInfo.page_id, e.target.value)}
                          placeholder="Entrez les informations d'aide pour cette page..."
                          className="min-h-[80px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => saveHelpInfo(helpInfo.page_id)}
                          disabled={saving}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Valider
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {helpInfos.length === 0 && (
                <div className="text-center py-8">
                  <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Aucune page trouvée</h3>
                  <p className="text-muted-foreground">
                    Les pages de l'application n'ont pas encore été configurées.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserManagement;
