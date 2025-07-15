import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Subtask {
  id: string;
  description: string;
  completed: boolean;
  created_at: string;
  created_by: string | null;
}

interface TodoSubtasksProps {
  todoId: string;
}

export function TodoSubtasks({ todoId }: TodoSubtasksProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSubtaskDescription, setNewSubtaskDescription] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchSubtasks();
  }, [todoId]);

  const fetchSubtasks = async () => {
    try {
      const { data, error } = await supabase
        .from('todo_subtasks')
        .select('*')
        .eq('todo_id', todoId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setSubtasks(data || []);
    } catch (error) {
      console.error('Error fetching subtasks:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les sous-tâches',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addSubtask = async () => {
    if (!newSubtaskDescription.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('todo_subtasks')
        .insert([{
          todo_id: todoId,
          description: newSubtaskDescription.trim(),
          completed: false,
          created_by: user?.id
        }])
        .select()
        .single();

      if (error) throw error;

      setSubtasks([...subtasks, data]);
      setNewSubtaskDescription('');
      setIsAdding(false);

      toast({
        title: 'Sous-tâche ajoutée',
        description: 'La sous-tâche a été créée avec succès',
      });
    } catch (error) {
      console.error('Error adding subtask:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'ajouter la sous-tâche',
        variant: 'destructive',
      });
    }
  };

  const toggleSubtask = async (subtaskId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('todo_subtasks')
        .update({ completed: !completed })
        .eq('id', subtaskId);

      if (error) throw error;

      setSubtasks(subtasks.map(subtask =>
        subtask.id === subtaskId
          ? { ...subtask, completed: !completed }
          : subtask
      ));
    } catch (error) {
      console.error('Error toggling subtask:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de modifier la sous-tâche',
        variant: 'destructive',
      });
    }
  };

  const deleteSubtask = async (subtaskId: string) => {
    try {
      const { error } = await supabase
        .from('todo_subtasks')
        .delete()
        .eq('id', subtaskId);

      if (error) throw error;

      setSubtasks(subtasks.filter(subtask => subtask.id !== subtaskId));

      toast({
        title: 'Sous-tâche supprimée',
        description: 'La sous-tâche a été supprimée',
      });
    } catch (error) {
      console.error('Error deleting subtask:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer la sous-tâche',
        variant: 'destructive',
      });
    }
  };

  const startEditing = (subtask: Subtask) => {
    setEditingId(subtask.id);
    setEditingDescription(subtask.description);
  };

  const saveEdit = async (subtaskId: string) => {
    if (!editingDescription.trim()) return;

    try {
      const { error } = await supabase
        .from('todo_subtasks')
        .update({ description: editingDescription.trim() })
        .eq('id', subtaskId);

      if (error) throw error;

      setSubtasks(subtasks.map(subtask =>
        subtask.id === subtaskId
          ? { ...subtask, description: editingDescription.trim() }
          : subtask
      ));

      setEditingId(null);
      setEditingDescription('');

      toast({
        title: 'Sous-tâche modifiée',
        description: 'La sous-tâche a été mise à jour',
      });
    } catch (error) {
      console.error('Error updating subtask:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de modifier la sous-tâche',
        variant: 'destructive',
      });
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingDescription('');
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Chargement des sous-tâches...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">
          Sous-tâches ({subtasks.length})
        </h4>
        {!isAdding && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAdding(true)}
            className="h-6 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Ajouter
          </Button>
        )}
      </div>

      {/* Liste des sous-tâches */}
      <div className="space-y-2">
        {subtasks.map((subtask) => (
          <div key={subtask.id} className="flex items-center gap-2 p-2 rounded-md border border-gray-100 bg-gray-50/30">
            <Checkbox
              checked={subtask.completed}
              onCheckedChange={() => toggleSubtask(subtask.id, subtask.completed)}
              className="shrink-0"
            />
            
            {editingId === subtask.id ? (
              <div className="flex-1 flex items-center gap-2">
                <Input
                  value={editingDescription}
                  onChange={(e) => setEditingDescription(e.target.value)}
                  className="h-7 text-sm"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      saveEdit(subtask.id);
                    }
                  }}
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => saveEdit(subtask.id)}
                  className="h-7 w-7 p-0"
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelEdit}
                  className="h-7 w-7 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-between">
                <span 
                  className={`text-sm ${
                    subtask.completed 
                      ? 'line-through text-muted-foreground' 
                      : ''
                  }`}
                >
                  {subtask.description}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEditing(subtask)}
                    className="h-6 w-6 p-0 hover:bg-gray-200"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteSubtask(subtask.id)}
                    className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Formulaire d'ajout */}
      {isAdding && (
        <div className="flex items-center gap-2 p-2 rounded-md border border-gray-200 bg-white">
          <Checkbox disabled className="shrink-0" />
          <Input
            value={newSubtaskDescription}
            onChange={(e) => setNewSubtaskDescription(e.target.value)}
            placeholder="Description de la sous-tâche..."
            className="h-7 text-sm"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addSubtask();
              }
            }}
            autoFocus
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={addSubtask}
            className="h-7 w-7 p-0"
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsAdding(false);
              setNewSubtaskDescription('');
            }}
            className="h-7 w-7 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}