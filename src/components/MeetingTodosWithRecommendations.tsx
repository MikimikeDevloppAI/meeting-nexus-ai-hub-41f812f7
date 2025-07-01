import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Calendar, Trash2, Pen, Users, Play, Lightbulb, Bot, Zap, ChevronUp, ChevronDown, Mail, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TodoComments } from "@/components/TodoComments";
import { TodoParticipantManager } from "@/components/TodoParticipantManager";
import { TodoAIRecommendationContent } from "@/components/TodoAIRecommendationContent";
import { TodoAssistantContent } from "@/components/meeting/TodoAssistantContent";
import { TaskDeepSearchContent } from "@/components/TaskDeepSearchContent";
import { EditableContent } from "@/components/EditableContent";
import { Todo } from "@/types/meeting";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MeetingTodosWithRecommendationsProps {
  meetingId: string;
}

type ActiveAITool = 'none' | 'recommendation' | 'assistant' | 'search';

export const MeetingTodosWithRecommendations = ({ meetingId }: MeetingTodosWithRecommendationsProps) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [activeAITools, setActiveAITools] = useState<Record<string, ActiveAITool>>({});
  const [deepSearchResults, setDeepSearchResults] = useState<Record<string, boolean>>({});
  const [showParticipantDialog, setShowParticipantDialog] = useState(false);
  const [currentTodoId, setCurrentTodoId] = useState<string | null>(null);
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
      
      // Check for existing deep search results
      checkDeepSearchResults(allTodos.map(todo => todo.id));
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
    <div className="space-y-6">
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
      
      {todos.map((todo) => {
        const activeTool = activeAITools[todo.id] || 'none';
        const hasDeepSearchResults = deepSearchResults[todo.id] || false;
        
        return (
          <Card key={todo.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-6">
              <div className="space-y-4">
                {/* Task header with edit, complete and delete buttons */}
                <div className="flex justify-between items-start">
                  <div className="text-lg flex-grow mr-2">
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
                      onClick={() => setEditingTodoId(todo.id)}
                      className="h-8 px-3 hover:bg-blue-100 hover:text-blue-800"
                    >
                      <Pen className="h-4 w-4" />
                    </Button>
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
                
                {/* Status and participants with management */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusBadge(todo.status)}
                    <div className="flex items-center gap-2">
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
                        title="Gérer les participants"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
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
                      {activeTool === 'search' && (
                        <TaskDeepSearchContent 
                          todoId={todo.id} 
                          todoDescription={todo.description}
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

      {/* Dialog for managing participants */}
      <Dialog open={showParticipantDialog} onOpenChange={setShowParticipantDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gérer les participants de la tâche</DialogTitle>
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
    </div>
  );
};
