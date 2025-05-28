
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Circle, Clock, MessageCircle } from "lucide-react";
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

  const updateTodoStatus = async (todoId: string, newStatus: Todo['status']) => {
    try {
      const { error } = await supabase
        .from("todos")
        .update({ status: newStatus })
        .eq("id", todoId);

      if (error) throw error;

      setTodos(todos.map(todo => 
        todo.id === todoId ? { ...todo, status: newStatus } : todo
      ));

      toast({
        title: "Statut mis à jour",
        description: `La tâche a été marquée comme ${newStatus === 'completed' ? 'terminée' : newStatus === 'confirmed' ? 'confirmée' : 'en attente'}`,
      });
    } catch (error: any) {
      console.error("Error updating todo status:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: Todo['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'confirmed':
        return <Clock className="h-5 w-5 text-blue-500" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: Todo['status']) => {
    const variants = {
      'pending': 'secondary',
      'confirmed': 'default',
      'completed': 'default'
    } as const;

    const labels = {
      'pending': 'En attente',
      'confirmed': 'Confirmée',
      'completed': 'Terminée'
    };

    const className = status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' : '';

    return (
      <Badge variant={variants[status] || 'secondary'} className={className}>
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
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-gray-500">Aucune tâche trouvée pour cette réunion</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Tâches extraites ({todos.length})</h3>
      {todos.map((todo) => (
        <Card key={todo.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {getStatusIcon(todo.status)}
                <div className="flex-1">
                  <CardTitle className="text-lg font-medium">
                    {todo.description}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    {getStatusBadge(todo.status)}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {todo.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateTodoStatus(todo.id, 'confirmed')}
                  >
                    Confirmer
                  </Button>
                )}
                {todo.status === 'confirmed' && (
                  <Button
                    size="sm"
                    onClick={() => updateTodoStatus(todo.id, 'completed')}
                  >
                    Terminer
                  </Button>
                )}
                {todo.status === 'completed' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateTodoStatus(todo.id, 'pending')}
                  >
                    Réouvrir
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Participants assignés:</h4>
              <TodoParticipantManager
                todoId={todo.id}
                currentParticipants={todo.todo_participants?.map(tp => tp.participants) || []}
                onParticipantsUpdate={fetchTodos}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpenComments(todo.id)}
                className="flex items-center gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                Commentaires
              </Button>
            </div>

            <TodoComments 
              todoId={todo.id} 
              isOpen={openComments === todo.id}
              onClose={() => setOpenComments(null)}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
