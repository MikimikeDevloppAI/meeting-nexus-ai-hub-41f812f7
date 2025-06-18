
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, User, CheckCircle, Trash2, Pen, Plus } from "lucide-react";
import { TodoComments } from "@/components/TodoComments";
import { TodoParticipantManager } from "@/components/TodoParticipantManager";
import { TodoAssistant } from "@/components/meeting/TodoAssistant";
import { TodoAIRecommendation } from "@/components/TodoAIRecommendation";
import { EditableContent } from "@/components/EditableContent";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Task {
  id: string;
  description: string;
  status: 'pending' | 'confirmed' | 'completed';
  assignedTo?: string;
  recommendation?: string;
  todo_participants?: Array<{
    participant_id: string;
    participants: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

interface MeetingResultsProps {
  transcript?: string;
  summary?: string;
  tasks?: Task[];
  meetingId?: string;
}

export const MeetingResults = ({ transcript, summary, tasks, meetingId }: MeetingResultsProps) => {
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks || []);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const { toast } = useToast();

  const completeTodo = async (todoId: string) => {
    try {
      const { error } = await supabase
        .from("todos")
        .update({ status: 'completed' })
        .eq("id", todoId);

      if (error) throw error;

      setLocalTasks(localTasks.map(task => 
        task.id === todoId ? { ...task, status: 'completed' } : task
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

      setLocalTasks(localTasks.filter(task => task.id !== todoId));

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
    setLocalTasks(localTasks.map(task => 
      task.id === todoId ? { ...task, description: newDescription } : task
    ));
  };

  const getStatusBadge = (status: Task['status']) => {
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

  const fetchTodos = async () => {
    if (!meetingId) return;
    
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

      if (error) throw error;

      const updatedTasks = data?.map(todo => ({
        ...todo,
        status: todo.status === 'pending' ? 'confirmed' : todo.status
      })) || [];

      setLocalTasks(updatedTasks as Task[]);
    } catch (error: any) {
      console.error("Error fetching todos:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Transcript Section */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          {transcript ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <Clock className="h-5 w-5 text-gray-400" />
          )}
          <h3 className="text-lg font-semibold">Transcript nettoyé</h3>
          {transcript && <Badge variant="outline" className="text-green-700">Prêt</Badge>}
        </div>
        {transcript ? (
          <div className="prose prose-sm max-w-none">
            <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap text-sm">
              {transcript}
            </div>
          </div>
        ) : (
          <div className="text-gray-500 italic">
            En attente de la transcription et du nettoyage...
          </div>
        )}
      </Card>

      {/* Summary Section */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          {summary ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <Clock className="h-5 w-5 text-gray-400" />
          )}
          <h3 className="text-lg font-semibold">Résumé de la réunion</h3>
          {summary && <Badge variant="outline" className="text-green-700">Prêt</Badge>}
        </div>
        {summary ? (
          <div className="prose prose-sm max-w-none">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm whitespace-pre-wrap">{summary}</div>
            </div>
          </div>
        ) : (
          <div className="text-gray-500 italic">
            En attente de la génération du résumé...
          </div>
        )}
      </Card>

      {/* Tasks Section with same layout as Todos page */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          {localTasks ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <Clock className="h-5 w-5 text-gray-400" />
          )}
          <h3 className="text-lg font-semibold">Tâches extraites</h3>
          {localTasks && (
            <Badge variant="outline" className="text-green-700">
              {localTasks.length} tâche(s)
            </Badge>
          )}
        </div>
        
        {localTasks ? (
          localTasks.length > 0 ? (
            <div className="space-y-6">
              {localTasks.map((task) => (
                <Card key={task.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Task header with edit, complete and delete buttons */}
                      <div className="flex justify-between items-start">
                        <div className="text-lg flex-grow mr-2">
                          <EditableContent
                            content={task.description}
                            onSave={(newContent) => handleTodoSave(task.id, newContent)}
                            type="todo"
                            id={task.id}
                            isEditing={editingTodoId === task.id}
                            onStartEdit={() => setEditingTodoId(task.id)}
                            onStopEdit={() => setEditingTodoId(null)}
                          />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingTodoId(task.id)}
                            className="h-8 px-3 hover:bg-blue-100 hover:text-blue-800"
                          >
                            <Pen className="h-4 w-4" />
                          </Button>
                          {task.status !== 'completed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => completeTodo(task.id)}
                              className="h-8 px-3 text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteTodo(task.id)}
                            className="h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Status and participants */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusBadge(task.status)}
                          <div className="text-xs text-gray-600 flex items-center gap-2">
                            <TodoParticipantManager
                              todoId={task.id}
                              currentParticipants={task.todo_participants?.map(tp => tp.participants) || []}
                              onParticipantsUpdate={fetchTodos}
                              compact={true}
                            />
                          </div>
                        </div>
                      </div>

                      {/* AI Recommendation */}
                      <TodoAIRecommendation todoId={task.id} />

                      {/* AI Assistant */}
                      <div className="pl-0.5">
                        <TodoAssistant 
                          todoId={task.id} 
                          todoDescription={task.description}
                          onUpdate={fetchTodos}
                        />
                      </div>

                      {/* Comments section */}
                      <TodoComments todoId={task.id} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 italic">
              Aucune tâche extraite de cette réunion.
            </div>
          )
        ) : (
          <div className="text-gray-500 italic">
            En attente de l'extraction des tâches...
          </div>
        )}
      </Card>
    </div>
  );
};
