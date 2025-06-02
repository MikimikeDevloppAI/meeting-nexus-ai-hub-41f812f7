
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Trash2, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TodoComments } from "@/components/TodoComments";
import { TodoParticipantManager } from "@/components/TodoParticipantManager";
import { Todo } from "@/types/meeting";

interface MeetingTodosProps {
  meetingId: string;
}

export const MeetingTodos = ({ meetingId }: MeetingTodosProps) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchTodos();
  }, [meetingId]);

  const fetchTodos = async () => {
    try {
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
        console.error("Error fetching todos:", error);
        throw error;
      }

      console.log("Fetched meeting todos:", data);
      setTodos(data as Todo[]);
    } catch (error: any) {
      console.error("Error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les tâches",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  const getStatusBadge = (status: Todo['status']) => {
    const labels = {
      'pending': 'En attente',
      'confirmed': 'En cours',
      'completed': 'Terminée'
    };

    const className = status === 'completed' 
      ? 'bg-green-100 text-green-800 border-green-200' 
      : status === 'confirmed'
      ? 'bg-blue-100 text-blue-800 border-blue-200'
      : 'bg-gray-100 text-gray-800 border-gray-200';

    return (
      <Badge variant="outline" className={className}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Chargement des tâches...</div>
      </div>
    );
  }

  if (todos.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Aucune tâche trouvée pour cette réunion</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Tâches extraites ({todos.length})</h3>
      {todos.map((todo) => (
        <Card key={todo.id} className="hover:shadow-sm transition-shadow">
          <CardContent className="p-4">
            <div className="space-y-3">
              {/* Task description */}
              <div className="text-sm font-medium">
                {todo.description}
              </div>
              
              {/* Status, participants and actions in one row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusBadge(todo.status)}
                  <div className="text-xs text-gray-600">
                    <TodoParticipantManager
                      todoId={todo.id}
                      currentParticipants={todo.todo_participants?.map(tp => tp.participants) || []}
                      onParticipantsUpdate={fetchTodos}
                      compact={true}
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOpenComments(todo.id)}
                    className="h-7 px-2"
                  >
                    <MessageCircle className="h-3 w-3" />
                  </Button>
                  
                  {todo.status !== 'completed' && (
                    <Button
                      size="sm"
                      onClick={() => completeTodo(todo.id)}
                      className="h-7 px-3 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Terminer
                    </Button>
                  )}
                  
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

              {/* Comments section */}
              <TodoComments 
                todoId={todo.id} 
                isOpen={openComments === todo.id}
                onClose={() => setOpenComments(null)}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
