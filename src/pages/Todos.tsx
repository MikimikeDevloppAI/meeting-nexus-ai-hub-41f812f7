import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Calendar, Trash2, Pen, Users, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TodoComments } from "@/components/TodoComments";
import { TodoParticipantManager } from "@/components/TodoParticipantManager";
import { TodoAIChat } from "@/components/TodoAIChat";
import { TodoAIRecommendation } from "@/components/TodoAIRecommendation";
import { EditableContent } from "@/components/EditableContent";
import { Todo } from "@/types/meeting";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";

interface NewTodoForm {
  description: string;
}

export default function Todos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showParticipantDialog, setShowParticipantDialog] = useState(false);
  const [currentTodoId, setCurrentTodoId] = useState<string | null>(null);
  const [showNewTodoDialog, setShowNewTodoDialog] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<NewTodoForm>({
    defaultValues: {
      description: ""
    }
  });

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

      // Convert any 'pending' status to 'confirmed' and filter to only 'confirmed' and 'completed'
      const updatedTodos = data?.map(todo => {
        if (todo.status === 'pending') {
          return { ...todo, status: 'confirmed' };
        }
        return todo;
      }).filter(todo => todo.status === 'confirmed' || todo.status === 'completed') || [];

      console.log("Fetched todos:", updatedTodos);
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

  const openParticipantManager = (todoId: string) => {
    setCurrentTodoId(todoId);
    setShowParticipantDialog(true);
  };

  const handleParticipantsUpdated = () => {
    fetchTodos();
  };

  const createNewTodo = async (data: NewTodoForm) => {
    try {
      const { data: newTodo, error } = await supabase
        .from("todos")
        .insert([{ 
          description: data.description,
          status: 'confirmed'
        }])
        .select()
        .single();
        
      if (error) throw error;
      
      setTodos([newTodo, ...todos]);
      setShowNewTodoDialog(false);
      form.reset();
      
      toast({
        title: "Tâche créée",
        description: "La nouvelle tâche a été créée avec succès",
      });
    } catch (error: any) {
      console.error("Error creating todo:", error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la tâche",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: Todo['status']) => {
    const labels = {
      'pending': 'En cours',
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

  const filteredTodos = statusFilter === "all" 
    ? todos 
    : todos.filter(todo => {
        const effectiveStatus = todo.status === 'pending' ? 'confirmed' : todo.status;
        return effectiveStatus === statusFilter;
      });

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
        <div>
          <h1 className="text-2xl font-bold">Mes Tâches</h1>
          <p className="text-muted-foreground">Gérer et suivre toutes les tâches</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
            >
              Toutes
            </Button>
            <Button
              variant={statusFilter === "confirmed" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("confirmed")}
            >
              En cours
            </Button>
            <Button
              variant={statusFilter === "completed" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("completed")}
            >
              Terminées
            </Button>
          </div>
          <Button
            onClick={() => setShowNewTodoDialog(true)}
            variant="default"
            size="sm"
            className="ml-4"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nouvelle tâche
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
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Tâches ({filteredTodos.length})</h3>
          {filteredTodos.map((todo) => (
            <Card key={todo.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Task header with edit and delete buttons - edit on left, delete on right */}
                  <div className="flex justify-between items-start">
                    <div className="text-sm font-medium flex-grow mr-2">
                      <EditableContent
                        content={todo.description}
                        onSave={(newContent) => handleTodoSave(todo.id, newContent)}
                        type="todo"
                        id={todo.id}
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 hover:bg-blue-100 hover:text-blue-800"
                      >
                        <Pen className="h-3 w-3" />
                      </Button>
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
                  
                  {/* Status, meeting and participants */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusBadge(todo.status)}
                      {todo.meetings?.[0] && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {todo.meetings[0].title}
                        </Badge>
                      )}
                      <div className="text-xs text-gray-600 flex items-center gap-2">
                        <TodoParticipantManager
                          todoId={todo.id}
                          currentParticipants={todo.todo_participants?.map(tp => tp.participants) || []}
                          onParticipantsUpdate={fetchTodos}
                          compact={true}
                        />
                        <Button 
                          onClick={() => openParticipantManager(todo.id)}
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-blue-100 hover:text-blue-800 rounded-full flex items-center justify-center"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
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

                  {/* AI Recommendation */}
                  <TodoAIRecommendation todoId={todo.id} />

                  {/* AI Chat for this todo */}
                  <TodoAIChat todoId={todo.id} todoDescription={todo.description} />

                  {/* Inline Comments section */}
                  <TodoComments todoId={todo.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog for managing participants */}
      <Dialog open={showParticipantDialog} onOpenChange={setShowParticipantDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gérer les participants</DialogTitle>
          </DialogHeader>
          {currentTodoId && (
            <TodoParticipantManager
              todoId={currentTodoId}
              currentParticipants={
                todos.find(todo => todo.id === currentTodoId)?.todo_participants?.map(tp => tp.participants) || []
              }
              onParticipantsUpdate={handleParticipantsUpdated}
              compact={false}
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Dialog for creating new todo */}
      <Dialog open={showNewTodoDialog} onOpenChange={setShowNewTodoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Créer une nouvelle tâche</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(createNewTodo)} className="space-y-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Description de la tâche..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowNewTodoDialog(false)}>
                  Annuler
                </Button>
                <Button type="submit">Créer</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
