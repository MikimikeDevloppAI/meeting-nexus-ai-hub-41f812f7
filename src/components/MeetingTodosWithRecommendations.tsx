import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Calendar, Trash2, Users, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TodoComments } from "@/components/TodoComments";
import { TodoParticipantManager } from "@/components/TodoParticipantManager";
import { TodoAssistant } from "@/components/meeting/TodoAssistant";
import { TodoAIRecommendation } from "@/components/TodoAIRecommendation";
import { EditableContent } from "@/components/EditableContent";
import { Todo } from "@/types/meeting";

interface MeetingTodosWithRecommendationsProps {
  meetingId: string;
}

export const MeetingTodosWithRecommendations = ({ meetingId }: MeetingTodosWithRecommendationsProps) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchTodos();
  }, [meetingId]);

  const fetchTodos = async () => {
    try {
      console.log('🔍 Fetching todos for meeting:', meetingId);
      
      const { data, error } = await supabase
        .from("todos")
        .select(`
          *,
          participants(name),
          todo_participants(
            participant_id,
            participants(id, name, email)
          )
        `)
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error fetching todos:", error);
        throw error;
      }

      console.log('📋 Raw todos data:', data);
      console.log('📊 Todos count by status:', data?.reduce((acc, todo) => {
        acc[todo.status] = (acc[todo.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>));
      
      // Convertir tous les statuts 'pending' en 'confirmed' et afficher TOUTES les tâches
      const allTodos = data?.map(todo => {
        if (todo.status === 'pending') {
          console.log(`🔄 Converting todo ${todo.id} from pending to confirmed`);
          // Mettre à jour en base de données aussi
          supabase
            .from("todos")
            .update({ status: 'confirmed' })
            .eq("id", todo.id)
            .then(({ error }) => {
              if (error) console.error('❌ Error updating todo status:', error);
            });
          return { ...todo, status: 'confirmed' };
        }
        return todo;
      }) || [];
      
      console.log(`📊 Total todos found: ${allTodos.length} for meeting ${meetingId}`);
      console.log('📋 Todos details:', allTodos.map(t => ({
        id: t.id,
        description: t.description.substring(0, 50) + '...',
        status: t.status,
        participants: t.todo_participants?.length || 0
      })));
      
      setTodos(allTodos as Todo[]);
    } catch (error: any) {
      console.error("❌ Error fetching todos:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les tâches",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startTodo = async (todoId: string) => {
    try {
      const { error } = await supabase
        .from("todos")
        .update({ status: 'confirmed' })
        .eq("id", todoId);

      if (error) throw error;

      setTodos(todos.map(todo => 
        todo.id === todoId ? { ...todo, status: 'confirmed' } : todo
      ));

      toast({
        title: "Tâche démarrée",
        description: "La tâche est maintenant en cours",
      });
    } catch (error: any) {
      console.error("Error starting todo:", error);
      toast({
        title: "Erreur",
        description: "Impossible de démarrer la tâche",
        variant: "destructive",
      });
    }
  };

  const completeTodo = async (todoId: string) => {
    try {
      const { error } = await supabase
        .from("todos")
        .update({ status: 'completed' })
        .eq("id", todoId);

      if (error) throw error;

      setTodos(todos.map(todo => 
        todo.id === todoId ? { ...todo, status: 'completed' } : todo
      ));

      toast({
        title: "Tâche terminée",
        description: "La tâche a été marquée comme terminée",
      });
    } catch (error: any) {
      console.error("Error completing todo:", error);
      toast({
        title: "Erreur",
        description: "Impossible de terminer la tâche",
        variant: "destructive",
      });
    }
  };

  const deleteTodo = async (todoId: string) => {
    try {
      const { error } = await supabase
        .from("todos")
        .delete()
        .eq("id", todoId);

      if (error) throw error;

      setTodos(todos.filter(todo => todo.id !== todoId));

      toast({
        title: "Tâche supprimée",
        description: "La tâche a été supprimée",
      });
    } catch (error: any) {
      console.error("Error deleting todo:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la tâche",
        variant: "destructive",
      });
    }
  };

  const handleTodoSave = (todoId: string, newDescription: string) => {
    setTodos(todos.map(todo => 
      todo.id === todoId ? { ...todo, description: newDescription } : todo
    ));
  };

  const getStatusBadge = (status: Todo['status']) => {
    const labels = {
      'pending': 'À démarrer',
      'confirmed': 'En cours',
      'completed': 'Terminée'
    };

    const className = status === 'completed' 
      ? 'bg-green-100 text-green-800 border-green-200' 
      : status === 'pending'
      ? 'bg-orange-100 text-orange-800 border-orange-200'
      : 'bg-blue-100 text-blue-800 border-blue-200';

    return (
      <Badge variant="outline" className={className}>
        {labels[status]}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-sm text-muted-foreground">Chargement des tâches...</div>
      </div>
    );
  }

  if (todos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Aucune tâche pour cette réunion</p>
        <p className="text-xs mt-2">Meeting ID: {meetingId}</p>
        <Button 
          onClick={fetchTodos} 
          variant="outline" 
          size="sm" 
          className="mt-3"
        >
          🔄 Recharger
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-2 flex items-center justify-between">
        <span>{todos.length} tâche(s) trouvée(s) pour cette réunion</span>
        <Button 
          onClick={fetchTodos} 
          variant="outline" 
          size="sm"
        >
          🔄 Recharger
        </Button>
      </div>
      
      {todos.map((todo) => (
        <Card key={todo.id} className="hover:shadow-sm transition-shadow">
          <CardContent className="p-4">
            <div className="space-y-3">
              {/* Task header */}
              <div className="flex justify-between items-start">
                <div className="text-sm flex-grow mr-2">
                  <EditableContent
                    content={todo.description}
                    onSave={(newContent) => handleTodoSave(todo.id, newContent)}
                    type="todo"
                    id={todo.id}
                    isEditing={editingTodoId === todo.id}
                    onStartEdit={() => setEditingTodoId(todo.id)}
                    onStopEdit={() => setEditingTodoId(null)}
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteTodo(todo.id)}
                    className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              {/* Status and participants */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusBadge(todo.status)}
                  <div className="text-xs text-gray-600 flex items-center gap-2">
                    <TodoParticipantManager
                      todoId={todo.id}
                      currentParticipants={todo.todo_participants?.map(tp => tp.participants) || []}
                      onParticipantsUpdate={fetchTodos}
                      compact={true}
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {todo.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => startTodo(todo.id)}
                      className="h-7 px-3 bg-blue-600 hover:bg-blue-700 text-xs"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Démarrer
                    </Button>
                  )}
                  {todo.status === 'confirmed' && (
                    <Button
                      size="sm"
                      onClick={() => completeTodo(todo.id)}
                      className="h-7 px-3 bg-green-600 hover:bg-green-700 text-xs"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Terminer
                    </Button>
                  )}
                </div>
              </div>

              {/* AI Recommendation - placed before AI Assistant */}
              <TodoAIRecommendation todoId={todo.id} />

              {/* AI Assistant */}
              <div className="pl-0.5">
                <TodoAssistant 
                  todoId={todo.id} 
                  todoDescription={todo.description}
                  onUpdate={fetchTodos}
                />
              </div>

              {/* Comments */}
              <TodoComments todoId={todo.id} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
