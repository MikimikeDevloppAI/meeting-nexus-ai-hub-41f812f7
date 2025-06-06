
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Trash2, Pen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TodoComments } from "@/components/TodoComments";
import { TodoParticipantManager } from "@/components/TodoParticipantManager";
import { TodoAIChat } from "@/components/TodoAIChat";
import { TodoAIRecommendation } from "@/components/TodoAIRecommendation";
import { EditableContent } from "@/components/EditableContent";
import { Todo } from "@/types/meeting";

interface MeetingTodosProps {
  meetingId: string;
}

export const MeetingTodos = ({ meetingId }: MeetingTodosProps) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
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

      // Convert any 'pending' status to 'confirmed'
      const updatedTodos = data?.map(todo => {
        if (todo.status === 'pending') {
          return { ...todo, status: 'confirmed' };
        }
        return todo;
      }) || [];

      console.log("Fetched meeting todos:", updatedTodos);
      setTodos(updatedTodos as Todo[]);
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

  const handleTodoSave = (todoId: string, newDescription: string) => {
    setTodos(todos.map(todo => 
      todo.id === todoId ? { ...todo, description: newDescription } : todo
    ));
  };

  const getStatusBadge = (status: Todo['status']) => {
    const labels = {
      'pending': 'En cours', // Convert pending to "En cours" label
      'confirmed': 'En cours',
      'completed': 'Terminée'
    };

    const className = status === 'completed' 
      ? 'bg-green-100 text-green-800 border-green-200' 
      : 'bg-blue-100 text-blue-800 border-blue-200';

    return (
      <Badge variant="outline" className={className}>
        {labels[status] || 'En cours'}
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
              {/* Task header with edit button */}
              <div className="flex justify-between items-start">
                <div className="text-sm font-medium flex-grow">
                  <EditableContent
                    content={todo.description}
                    onSave={(newContent) => handleTodoSave(todo.id, newContent)}
                    type="todo"
                    id={todo.id}
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
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
              
              {/* Status, participants and actions */}
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
                </div>
              </div>

              {/* AI Recommendation - displayed prominently */}
              <TodoAIRecommendation todoId={todo.id} />

              {/* AI Chat for this todo */}
              <TodoAIChat todoId={todo.id} todoDescription={todo.description} />

              {/* Comments section */}
              <TodoComments todoId={todo.id} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
