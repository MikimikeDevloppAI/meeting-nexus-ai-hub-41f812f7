import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Calendar, Trash2, Users, Plus, Lightbulb, Bot, Zap, ChevronUp, ChevronDown, Mail, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TodoComments } from "@/components/TodoComments";
import { TodoUserManager } from "@/components/TodoUserManager";
import { EditableContent } from "@/components/EditableContent";
import { EditableDueDate } from "@/components/EditableDueDate";
import { TodoAIRecommendationContent } from "@/components/TodoAIRecommendationContent";
import { TodoAssistantContent } from "@/components/meeting/TodoAssistantContent";
import { TaskDeepSearchContent } from "@/components/TaskDeepSearchContent";
import { TodoPriorityButton } from "@/components/TodoPriorityButton";
import { TodoSubtasks } from "@/components/TodoSubtasks";
import { TodoAttachments } from "@/components/TodoAttachments";
import { Todo } from "@/types/meeting";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useTodoCounter } from "@/hooks/useTodoCounter";

interface NewTodoForm {
  description: string;
  user_ids?: string[];
  comment?: string;
  due_date?: string;
  priority?: 'high' | 'normal' | 'low';
  subtasks?: string[];
}

interface User {
  id: string;
  name: string;
  email: string;
}

type ActiveAITool = 'none' | 'recommendation' | 'assistant' | 'search';

// Étendre l'interface Todo pour inclure la priorité et les utilisateurs
interface TodoWithPriority extends Todo {
  priority?: 'high' | 'normal' | 'low';
  due_date?: string | null;
  todo_users?: Array<{
    user_id: string;
    users: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

export default function Todos() {
  const [todos, setTodos] = useState<TodoWithPriority[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("confirmed"); // Filtre par défaut sur "En cours"
  const [participantFilter, setParticipantFilter] = useState<string>(""); // Vide au début, sera initialisé avec l'utilisateur connecté
  const [participantFilterInitialized, setParticipantFilterInitialized] = useState(false);
  const [showParticipantDialog, setShowParticipantDialog] = useState(false);
  const [currentTodoId, setCurrentTodoId] = useState<string | null>(null);
  const [showNewTodoDialog, setShowNewTodoDialog] = useState(false);
  const [newTodoSubtasks, setNewTodoSubtasks] = useState<string[]>([]);
  const [newTodoAttachments, setNewTodoAttachments] = useState<File[]>([]);
  const [newTodoPriority, setNewTodoPriority] = useState<'high' | 'normal' | 'low'>('normal');
  const [users, setUsers] = useState<User[]>([]);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [activeAITools, setActiveAITools] = useState<Record<string, ActiveAITool>>({});
  const [deepSearchResults, setDeepSearchResults] = useState<Record<string, boolean>>({});
  const [expandedTodos, setExpandedTodos] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const { user } = useAuth();
  const todoCount = useTodoCounter();
  
  const form = useForm<NewTodoForm>({
    defaultValues: {
      description: "",
      user_ids: [],
      comment: "",
      due_date: undefined,
      priority: 'normal',
      subtasks: []
    }
  });

  useEffect(() => {
    fetchTodos();
    fetchUsers();
  }, []);

  // Définir le filtre par défaut sur l'utilisateur connecté (une seule fois)
  useEffect(() => {
    if (user?.id && users.length > 0 && !participantFilterInitialized) {
      setParticipantFilter(user.id);
      setParticipantFilterInitialized(true);
    }
  }, [user?.id, users, participantFilterInitialized]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email")
        .eq('approved', true)
        .order("name");

      if (error) throw error;
      const filtered = (data || []).filter(u => (u.email || '').toLowerCase() !== 'michael.enry4@gmail.com');
      setUsers(filtered);
    } catch (error: any) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchTodos = async () => {
    try {
      console.log('🔍 Fetching todos from main todos page...');
      
      // Requête mise à jour pour utiliser la nouvelle structure avec todo_meetings
      const { data, error } = await supabase
        .from("todos")
        .select(`
          *,
          todo_users(
            user_id,
            users(id, name, email)
          ),
          todo_meetings(
            meeting_id,
            meetings(title)
          )
        `)
        .order("priority", { ascending: false }) // Tri par priorité d'abord
        .order("created_at", { ascending: false }); // Puis par date

      if (error) {
        console.error("❌ Error fetching todos:", error);
        throw error;
      }

      console.log('📋 Raw todos data from main page:', data);

      // Convert any 'pending' status to 'confirmed' and filter to only 'confirmed' and 'completed'
      const updatedTodos = data?.map(todo => {
        // Adapter les meetings pour la compatibilité
        const adaptedTodo = {
          ...todo,
          meetings: todo.todo_meetings?.map((tm: any) => tm.meetings).filter(Boolean) || []
        };
        
        if (todo.status === 'pending') {
          return { ...adaptedTodo, status: 'confirmed' };
        }
        return adaptedTodo;
      }).filter(todo => todo.status === 'confirmed' || todo.status === 'completed') || [];

      console.log("📊 Processed todos:", updatedTodos);
      console.log(`📈 Total todos count: ${updatedTodos.length}`);
      setTodos(updatedTodos as TodoWithPriority[]);
      
      // Check for existing deep search results
      checkDeepSearchResults(updatedTodos.map(todo => todo.id));
    } catch (error: any) {
      console.error("❌ Error in fetchTodos:", error);
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

  const extractTextFromAttachment = async (attachmentId: string, contentType: string) => {
    try {
      console.log('🔍 Starting text extraction for attachment:', attachmentId);
      
      const { data, error } = await supabase.functions.invoke('extract-attachment-text', {
        body: { attachmentId }
      });

      if (error) {
        console.error('Text extraction error:', error);
        return;
      }

      if (data.success) {
        console.log('✅ Text extraction completed:', data.message);
        
        if (data.extractedText && data.extractedText.length > 0) {
          toast({
            title: 'Texte extrait',
            description: `Texte extrait du fichier (${data.textLength} caractères)`,
          });
        }
      }
    } catch (error) {
      console.error('Error calling text extraction function:', error);
    }
  };

  const createNewTodo = async (data: NewTodoForm) => {
    try {
      // Créer la tâche
      const { data: newTodo, error } = await supabase
        .from("todos")
        .insert([{ 
          description: data.description,
          status: 'confirmed',
          priority: newTodoPriority,
          due_date: data.due_date || null
        }])
        .select()
        .single();
        
      if (error) throw error;
      
      // Assigner plusieurs utilisateurs si sélectionnés
      if (data.user_ids && data.user_ids.length > 0) {
        const rows = data.user_ids.map((uid) => ({
          todo_id: newTodo.id,
          user_id: uid,
        }));
        const { error: usersError } = await supabase.from("todo_users").insert(rows);
        if (usersError) {
          console.error("Error assigning users:", usersError);
          // On continue même si l'attribution échoue
        }
      }

      // Ajouter les sous-tâches
      if (newTodoSubtasks.length > 0) {
        const subtasksToInsert = newTodoSubtasks.map(description => ({
          todo_id: newTodo.id,
          description,
          completed: false,
          created_by: user?.id
        }));

        const { error: subtasksError } = await supabase
          .from("todo_subtasks")
          .insert(subtasksToInsert);
          
        if (subtasksError) {
          console.error("Error creating subtasks:", subtasksError);
        }
      }

      // Gérer les attachements
      if (newTodoAttachments.length > 0) {
        for (const file of newTodoAttachments) {
          try {
            // Upload du fichier vers le storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${crypto.randomUUID()}.${fileExt}`;
            const filePath = `todo-attachments/${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from('todo-attachments')
              .upload(filePath, file);

            if (uploadError) {
              console.error('Error uploading file:', uploadError);
              continue;
            }

            // Créer l'enregistrement de l'attachement et récupérer l'ID
            const { data: attachmentData, error: attachmentError } = await supabase
              .from("todo_attachments")
              .insert({
                todo_id: newTodo.id,
                file_name: file.name,
                file_path: filePath,
                content_type: file.type,
                file_size: file.size,
                created_by: user?.id
              })
              .select('id')
              .single();

            if (attachmentError) {
              console.error('Error creating attachment record:', attachmentError);
              continue;
            }

            // Lancer l'extraction de texte en arrière-plan
            if (attachmentData?.id) {
              extractTextFromAttachment(attachmentData.id, file.type);
            }
          } catch (error) {
            console.error('Error processing attachment:', error);
          }
        }
      }
      
      // Ajouter un commentaire initial si fourni
      if (data.comment && data.comment.trim()) {
        const { error: commentError } = await supabase
          .from("todo_comments")
          .insert({
            todo_id: newTodo.id,
            user_id: user?.id,
            comment: data.comment.trim()
          });
        if (commentError) {
          console.error("Error adding initial comment:", commentError);
        }
      }
      
      // Recharger les tâches pour obtenir les participants
      fetchTodos();
      setShowNewTodoDialog(false);
      form.reset();
      setNewTodoSubtasks([]);
      setNewTodoAttachments([]);
      setNewTodoPriority('normal');
      
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
        todo.todo_users?.some(tu => tu.user_id === participantFilter);
      
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
      
      // Puis par échéance (due_date) - les tâches sans date en dernier
      const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      
      if (aDate !== bDate) {
        return aDate - bDate; // Échéance la plus proche en premier
      }
      
      // En dernier recours, par date de création (plus récent en premier)
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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Mes Tâches</h1>
            {todoCount > 0 && (
              <Badge 
                variant="secondary" 
                className="bg-red-500 text-white font-medium text-sm px-2 py-1 rounded-full"
              >
                {todoCount}
              </Badge>
            )}
          </div>
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
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
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
            const isExpanded = expandedTodos[todo.id] || false;
            
            return (
              <Card key={todo.id} className={`shadow-md hover:shadow-lg transition-shadow ${
                todo.priority === 'high' ? 'ring-2 ring-orange-200' : ''
              }`}>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Due date, priority, and participants header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <EditableDueDate 
                          todoId={todo.id}
                          dueDate={todo.due_date}
                          onUpdate={fetchTodos}
                        />
                        <div className="text-xs text-gray-600 flex items-center gap-2">
                    <TodoUserManager
                            todoId={todo.id}
                            currentUsers={todo.todo_users?.map(tu => tu.users) || []}
                            onUsersUpdate={() => {}}
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

                    {/* Collapsible section for additional content */}
                    <Collapsible open={isExpanded} onOpenChange={(open) => 
                      setExpandedTodos(prev => ({ ...prev, [todo.id]: open }))
                    }>
                      <CollapsibleTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full mt-3 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-4 w-4" />
                              Voir moins
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              Voir plus
                            </>
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent className="space-y-4 pt-4">
                        {/* Attachments and Subtasks */}
                        <div className="space-y-4 pt-4 border-t border-gray-100">
                          <TodoAttachments todoId={todo.id} />
                          <TodoSubtasks todoId={todo.id} />
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
                      </CollapsibleContent>
                    </Collapsible>
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
            <TodoUserManager
              todoId={currentTodoId}
              currentUsers={
                todos.find(todo => todo.id === currentTodoId)?.todo_users?.map(tu => tu.users) || []
              }
              onUsersUpdate={() => handleParticipantsUpdated()}
              compact={false}
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Dialog for creating new todo with participant selection */}
      <Dialog open={showNewTodoDialog} onOpenChange={setShowNewTodoDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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

              <div className="flex items-center gap-4">
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Date d'échéance</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex flex-col items-center">
                  <FormLabel className="mb-2">Priorité</FormLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setNewTodoPriority(newTodoPriority === 'high' ? 'normal' : 'high')}
                    className={`h-10 w-10 p-0 ${
                      newTodoPriority === 'high' 
                        ? 'text-orange-500 hover:text-orange-600' 
                        : 'text-gray-400 hover:text-orange-500'
                    }`}
                  >
                    <Star className={`h-5 w-5 ${newTodoPriority === 'high' ? 'fill-current' : ''}`} />
                  </Button>
                </div>
              </div>
              
              <FormField
                control={form.control}
                name="user_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Participants assignés</FormLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {users.map((u) => {
                        const selected: string[] = field.value || [];
                        const checked = selected.includes(u.id);
                        return (
                          <label key={u.id} className="flex items-center gap-2 p-2 rounded border hover:bg-gray-50">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                const set = new Set<string>(selected);
                                if (v) set.add(u.id); else set.delete(u.id);
                                field.onChange(Array.from(set));
                              }}
                            />
                            <span className="text-sm truncate">{u.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="comment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commentaire initial</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Ajouter un commentaire (optionnel)" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Sous-tâches */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormLabel>Sous-tâches</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setNewTodoSubtasks([...newTodoSubtasks, ''])}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter
                  </Button>
                </div>
                {newTodoSubtasks.map((subtask, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="Description de la sous-tâche..."
                      value={subtask}
                      onChange={(e) => {
                        const updated = [...newTodoSubtasks];
                        updated[index] = e.target.value;
                        setNewTodoSubtasks(updated);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const updated = newTodoSubtasks.filter((_, i) => i !== index);
                        setNewTodoSubtasks(updated);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Attachements */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormLabel>Fichiers joints</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.multiple = true;
                      input.onchange = (e) => {
                        const files = Array.from((e.target as HTMLInputElement).files || []);
                        setNewTodoAttachments([...newTodoAttachments, ...files]);
                      };
                      input.click();
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter des fichiers
                  </Button>
                </div>
                {newTodoAttachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm truncate">{file.name}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const updated = newTodoAttachments.filter((_, i) => i !== index);
                        setNewTodoAttachments(updated);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setShowNewTodoDialog(false);
                  setNewTodoSubtasks([]);
                  setNewTodoAttachments([]);
                  setNewTodoPriority('normal');
                  form.reset();
                }}>
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
