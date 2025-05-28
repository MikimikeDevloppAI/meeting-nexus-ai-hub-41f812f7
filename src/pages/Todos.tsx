
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Circle, Clock, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TodoComments } from "@/components/TodoComments";
import { TodoParticipantManager } from "@/components/TodoParticipantManager";
import { Todo } from "@/types/meeting";

export default function Todos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      const { data, error } = await supabase
        .from("todos")
        .select(`
          *,
          meetings!inner(title),
          participants(name),
          todo_participants(
            participant_id,
            participants(id, name, email)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching todos:", error);
        throw error;
      }

      console.log("Fetched todos:", data);
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
      'completed': 'success'
    } as const;

    const labels = {
      'pending': 'En attente',
      'confirmed': 'Confirmée',
      'completed': 'Terminée'
    };

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const filteredTodos = statusFilter === "all" 
    ? todos 
    : todos.filter(todo => todo.status === statusFilter);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Chargement des tâches...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Mes Tâches</h1>
        <div className="flex gap-2">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("all")}
          >
            Toutes
          </Button>
          <Button
            variant={statusFilter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("pending")}
          >
            En attente
          </Button>
          <Button
            variant={statusFilter === "confirmed" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("confirmed")}
          >
            Confirmées
          </Button>
          <Button
            variant={statusFilter === "completed" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("completed")}
          >
            Terminées
          </Button>
        </div>
      </div>

      {filteredTodos.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500">Aucune tâche trouvée</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredTodos.map((todo) => (
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
                        {todo.meetings?.[0] && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {todo.meetings[0].title}
                          </Badge>
                        )}
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

                <TodoComments todoId={todo.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
