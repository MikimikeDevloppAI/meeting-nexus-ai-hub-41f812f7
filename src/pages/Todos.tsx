import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Calendar, Trash2, Users, Plus, Lightbulb, Bot, Zap, ChevronUp, ChevronDown, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TodoComments } from "@/components/TodoComments";
import { TodoParticipantManager } from "@/components/TodoParticipantManager";
import { EditableContent } from "@/components/EditableContent";
import { TodoAIRecommendationContent } from "@/components/TodoAIRecommendationContent";
import { TodoAssistantContent } from "@/components/meeting/TodoAssistantContent";
import { TaskDeepSearchContent } from "@/components/TaskDeepSearchContent";
import { TodoPriorityButton } from "@/components/TodoPriorityButton";
import { TodoSubtasks } from "@/components/TodoSubtasks";
import { TodoAttachments } from "@/components/TodoAttachments";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface NewTodoForm {
  description: string;
  participant_id?: string;
}

interface Participant {
  id: string;
  name: string;
  email: string;
}

type ActiveAITool = 'none' | 'recommendation' | 'assistant' | 'search';

// Étendre l'interface Todo pour inclure la priorité
interface TodoWithPriority extends Todo {
  priority?: 'high' | 'normal' | 'low';
}

export default function Todos() {
  const [todos, setTodos] = useState<TodoWithPriority[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("confirmed"); // Filtre par défaut sur "En cours"
  const [participantFilter, setParticipantFilter] = useState<string>("all");
  const [showParticipantDialog, setShowParticipantDialog] = useState(false);
  const [currentTodoId, setCurrentTodoId] = useState<string | null>(null);
  const [showNewTodoDialog, setShowNewTodoDialog] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [activeAITools, setActiveAITools] = useState<Record<string, ActiveAITool>>({});
  const [deepSearchResults, setDeepSearchResults] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  
  const form = useForm<NewTodoForm>({
    defaultValues: {
      description: "",
      participant_id: undefined
    }
  });

  useEffect(() => {
    fetchTodos();
    fetchParticipants();
  }, []);

  const fetchParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from("participants")
        .select("id, name, email")
        .order("name");

      if (error) throw error;
      setParticipants(data || []);
    } catch (error: any) {
      console.error("Error fetching participants:", error);
    }
  };

  const fetchTodos = async () => {
    try {
      // Requête corrigée : utiliser todo_participants au lieu de participants directement
      const { data, error } = await supabase
        .from("todos")
        .select(`
          *,
          meetings(title),
          todo_participants(
            participant_id,
            participants(id, name, email)
          )
        `)
        .order("priority", { ascending: false }) // Tri par priorité d'abord
        .order("created_at", { ascending: false }); // Puis par date

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
      setTodos(updatedTodos as TodoWithPriority[]);
      
      // Check for existing deep search results
      checkDeepSearchResults(updatedTodos.map(todo => todo.id));
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

  const checkDeepSearchResults = async (todoIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('task_deep_searches')
        .select('todo_id')
        .in('todo_id', todoIds);

      if (error) {
        console.error('Error checking deep search results:', error);
        return;
      }

      const resultsMap: Record<string, boolean> = {};
      todoIds.forEach(id => {
        resultsMap[id] = data?.some(result => result.todo_id === id) || false;
      });
      
      setDeepSearchResults(resultsMap);
    } catch (error) {
      console.error('Error checking deep search results:', error);
    }
  };

  const completeTodo = async (todoId: string) => {
    try {
      const currentTodo = todos.find(todo => todo.id === todoId);
      if (!currentTodo) return;

      // Toggle between completed and confirmed
      const newStatus = currentTodo.status === 'completed' ? 'confirmed' : 'completed';
      
      const { error } = await supabase
        .from("todos")
        .update({ status: newStatus })
        .eq("id", todoId);

      if (error) throw error;

      setTodos(todos.map(todo => 
        todo.id === todoId ? { ...todo, status: newStatus } : todo
      ));

      toast({
        title: newStatus === 'completed' ? "Tâche terminée" : "Tâche remise en cours",
        description: newStatus === 'completed' 
          ? "La tâche a été marquée comme terminée" 
          : "La tâche a été remise en cours",
      });
    } catch (error: any) {
      console.error("Error updating todo:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le statut de la tâche",
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
      // Créer la tâche
      const { data: newTodo, error } = await supabase
        .from("todos")
        .insert([{ 
          description: data.description,
          status: 'confirmed',
          priority: 'normal' // Priorité normale par défaut
        }])
        .select()
        .single();
        
      if (error) throw error;
      
      // Si un participant est sélectionné, l'ajouter à la tâche
      if (data.participant_id) {
        const { error: participantError } = await supabase
          .from("todo_participants")
          .insert({
            todo_id: newTodo.id,
            participant_id: data.participant_id
          });
          
        if (participantError) {
          console.error("Error assigning participant:", participantError);
          // On continue même si l'attribution échoue
        }
      }
      
      // Recharger les tâches pour obtenir les participants
      fetchTodos();
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

  const handleAIToolToggle = (todoId: string, tool: ActiveAITool) => {
    setActiveAITools(prev => ({
      ...prev,
      [todoId]: prev[todoId] === tool ? 'none' : tool
    }));
  };

  // Tri des tâches avec priorité en premier
  const filteredTodos = todos
    .filter(todo => {
      const effectiveStatus = todo.status === 'pending' ? 'confirmed' : todo.status;
      const statusMatch = statusFilter === "all" || effectiveStatus === statusFilter;
      
      const participantMatch = participantFilter === "all" || 
        todo.todo_participants?.some(tp => tp.participant_id === participantFilter);
      
      return statusMatch && participantMatch;
    })
    .sort((a, b) => {
      // Tri par priorité d'abord (high > normal > low)
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      const aPriority = priorityOrder[a.priority || 'normal'];
      const bPriority = priorityOrder[b.priority || 'normal'];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      // Puis par date de création (plus récent en premier)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Mes Tâches</h1>
          <p className="text-muted-foreground">Gérer et suivre toutes les tâches</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
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
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
            >
              Toutes
            </Button>
          </div>
          
          <Select value={participantFilter} onValueChange={setParticipantFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrer par participant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les participants</SelectItem>
              {participants.map((participant) => (
                <SelectItem key={participant.id} value={participant.id}>
                  {participant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
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
        <div className="space-y-6">
          {filteredTodos.map((todo) => {
            const activeTool = activeAITools[todo.id] || 'none';
            const hasDeepSearchResults = deepSearchResults[todo.id] || false;
            
            return (
              <Card key={todo.id} className={`hover:shadow-sm transition-shadow ${
                todo.priority === 'high' ? 'ring-2 ring-orange-200 bg-orange-50/30' : ''
              }`}>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Status, priority, and participants header */}
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
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <TodoPriorityButton
                          todoId={todo.id}
                          currentPriority={todo.priority || 'normal'}
                          onPriorityUpdate={fetchTodos}
                          compact={true}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => completeTodo(todo.id)}
                          className={`h-8 px-3 ${
                            todo.status === 'completed'
                              ? 'bg-green-500 text-white hover:bg-green-600 border-green-500'
                              : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                          }`}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteTodo(todo.id)}
                          className="h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Task description */}
                    <div className="border-l-4 border-gray-200 pl-4">
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

                    {/* Subtasks and Attachments */}
                    <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                      <TodoSubtasks todoId={todo.id} />
                      <TodoAttachments todoId={todo.id} />
                    </div>

                    {/* AI Tools - Style professionnel sans background coloré */}
                    <div className="space-y-3">
                      <div className="flex gap-3 border-t pt-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAIToolToggle(todo.id, 'recommendation')}
                          className={`flex-1 h-11 flex items-center justify-between px-4 border border-gray-200 rounded-lg transition-all ${
                            activeTool === 'recommendation' 
                              ? 'border-blue-400 bg-blue-50/50 shadow-sm' 
                              : 'hover:border-gray-300 hover:bg-gray-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Mail className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-gray-900">Communication</span>
                          </div>
                          {activeTool === 'recommendation' ? (
                            <ChevronUp className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAIToolToggle(todo.id, 'assistant')}
                          className={`flex-1 h-11 flex items-center justify-between px-4 border border-gray-200 rounded-lg transition-all ${
                            activeTool === 'assistant' 
                              ? 'border-green-400 bg-green-50/50 shadow-sm' 
                              : 'hover:border-gray-300 hover:bg-gray-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Bot className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-gray-900">Assistant IA</span>
                          </div>
                          {activeTool === 'assistant' ? (
                            <ChevronUp className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          )}
                        </Button>
                      </div>

                      {/* AI Tool Content */}
                      {activeTool !== 'none' && (
                        <div className="w-full bg-gray-50/30 rounded-lg p-4 border border-gray-100">
                          {activeTool === 'recommendation' && (
                            <TodoAIRecommendationContent todoId={todo.id} autoOpenEmail={true} />
                          )}
                          {activeTool === 'assistant' && (
                            <TodoAssistantContent 
                              todoId={todo.id} 
                              todoDescription={todo.description}
                              onUpdate={fetchTodos}
                            />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Inline Comments section */}
                    <TodoComments todoId={todo.id} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
      
      {/* Dialog for creating new todo with participant selection */}
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
              
              <FormField
                control={form.control}
                name="participant_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Participant assigné</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un participant (optionnel)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {participants.map((participant) => (
                          <SelectItem key={participant.id} value={participant.id}>
                            {participant.name} ({participant.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
