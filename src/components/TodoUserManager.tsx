import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Users, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface User {
  id: string;
  name: string;
  email: string;
}

interface TodoUserManagerProps {
  todoId: string;
  currentUsers: User[];
  onUsersUpdate: (users: User[]) => void;
  compact?: boolean;
}

export const TodoUserManager = ({
  todoId,
  currentUsers,
  onUsersUpdate,
  compact = false
}: TodoUserManagerProps) => {
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showMultiSelect, setShowMultiSelect] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAllUsers();
  }, []);

  const fetchAllUsers = async () => {
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('approved', true)
        .order('name');

      if (error) throw error;

      setAvailableUsers(users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les utilisateurs",
        variant: "destructive",
      });
    }
  };

  const addMultipleUsers = async () => {
    if (selectedUserIds.length === 0) return;

    setIsLoading(true);
    try {
      // Add selected users to the todo
      const insertPromises = selectedUserIds.map(userId =>
        supabase
          .from('todo_users')
          .insert({
            todo_id: todoId,
            user_id: userId
          })
      );

      await Promise.all(insertPromises);

      // Fetch updated users
      const { data: todoUsers, error } = await supabase
        .from('todo_users')
        .select(`
          user_id,
          users!inner(id, name, email)
        `)
        .eq('todo_id', todoId);

      if (error) throw error;

      const users = todoUsers?.map(tp => tp.users).filter(Boolean).flat() || [];
      onUsersUpdate(users);

      setSelectedUserIds([]);
      setShowMultiSelect(false);

      toast({
        title: "Succès",
        description: `${selectedUserIds.length} utilisateur(s) ajouté(s)`,
      });
    } catch (error) {
      console.error('Error adding users:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter les utilisateurs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addSingleUser = async (userId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('todo_users')
        .insert({
          todo_id: todoId,
          user_id: userId
        });

      if (error) throw error;

      // Fetch the added user details
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      onUsersUpdate([...currentUsers, userData]);

      toast({
        title: "Succès",
        description: "Utilisateur ajouté avec succès",
      });
    } catch (error) {
      console.error('Error adding user:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter l'utilisateur",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const removeUser = async (userId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('todo_users')
        .delete()
        .eq('todo_id', todoId)
        .eq('user_id', userId);

      if (error) throw error;

      onUsersUpdate(currentUsers.filter(user => user.id !== userId));

      toast({
        title: "Succès",
        description: "Utilisateur retiré avec succès",
      });
    } catch (error) {
      console.error('Error removing user:', error);
      toast({
        title: "Erreur",
        description: "Impossible de retirer l'utilisateur",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Filter available users to exclude those already assigned
  const availableUsersForSelection = availableUsers.filter(
    user => !currentUsers.some(currentUser => currentUser.id === user.id)
  );

  if (compact) {
    return (
      <div className="space-y-2">
        {currentUsers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {currentUsers.map((user) => (
              <Badge key={user.id} variant="secondary" className="text-xs">
                {user.name}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 ml-1 hover:bg-transparent"
                  onClick={() => removeUser(user.id)}
                  disabled={isLoading}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}
        
        {availableUsersForSelection.length > 0 && (
          <Select onValueChange={addSingleUser} disabled={isLoading}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Assigner à..." />
            </SelectTrigger>
            <SelectContent>
              {availableUsersForSelection.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Utilisateurs assignés
        </h4>
        {availableUsersForSelection.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMultiSelect(!showMultiSelect)}
            disabled={isLoading}
          >
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        )}
      </div>

      {currentUsers.length > 0 && (
        <div className="space-y-2">
          {currentUsers.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-2 border rounded">
              <div>
                <span className="font-medium">{user.name}</span>
                <span className="text-sm text-muted-foreground ml-2"></span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeUser(user.id)}
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {showMultiSelect && availableUsersForSelection.length > 0 && (
        <div className="border rounded p-4 space-y-3">
          <h5 className="font-medium">Sélectionner plusieurs utilisateurs</h5>
          <div className="max-h-40 overflow-y-auto space-y-2">
            {availableUsersForSelection.map((user) => (
              <label key={user.id} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedUserIds.includes(user.id)}
                  onChange={() => toggleUserSelection(user.id)}
                  className="rounded"
                />
                <span>{user.name}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={addMultipleUsers}
              disabled={selectedUserIds.length === 0 || isLoading}
              size="sm"
            >
              Ajouter sélectionnés ({selectedUserIds.length})
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowMultiSelect(false);
                setSelectedUserIds([]);
              }}
              size="sm"
            >
              Annuler
            </Button>
          </div>
        </div>
      )}

      {availableUsersForSelection.length === 0 && currentUsers.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucun utilisateur disponible</p>
      )}
    </div>
  );
};