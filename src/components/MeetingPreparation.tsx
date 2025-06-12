
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { TaskPriorityService, TaskWithPriority } from "@/services/taskPriorityService";
import { Trash2, Plus, Users, Calendar, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface CustomPoint {
  id: string;
  point_text: string;
  created_at: string;
}

interface TaskNote {
  id: string;
  todo_id: string;
  note_text: string;
  created_at: string;
}

export const MeetingPreparation = () => {
  const [tasks, setTasks] = useState<TaskWithPriority[]>([]);
  const [customPoints, setCustomPoints] = useState<CustomPoint[]>([]);
  const [taskNotes, setTaskNotes] = useState<TaskNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newPoint, setNewPoint] = useState("");
  const [newNotes, setNewNotes] = useState<Record<string, string>>({});
  
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Récupérer les tâches avec priorité
      const prioritizedTasks = await TaskPriorityService.getTasksWithPriority();
      setTasks(prioritizedTasks);

      // Récupérer les points personnalisés
      const { data: points, error: pointsError } = await supabase
        .from("meeting_preparation_custom_points")
        .select("*")
        .order("created_at", { ascending: false });

      if (pointsError) throw pointsError;
      setCustomPoints(points || []);

      // Récupérer les notes des tâches
      const { data: notes, error: notesError } = await supabase
        .from("meeting_preparation_notes")
        .select("*")
        .order("created_at", { ascending: false });

      if (notesError) throw notesError;
      setTaskNotes(notes || []);

    } catch (error: any) {
      console.error("Error fetching preparation data:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données de préparation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addCustomPoint = async () => {
    if (!newPoint.trim() || !user?.id) return;

    try {
      const { error } = await supabase
        .from("meeting_preparation_custom_points")
        .insert([{
          point_text: newPoint.trim(),
          created_by: user.id
        }]);

      if (error) throw error;

      setNewPoint("");
      await fetchData();
      
      toast({
        title: "Point ajouté",
        description: "Le point a été ajouté à la préparation",
      });
    } catch (error: any) {
      console.error("Error adding custom point:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le point",
        variant: "destructive",
      });
    }
  };

  const deleteCustomPoint = async (id: string) => {
    try {
      const { error } = await supabase
        .from("meeting_preparation_custom_points")
        .delete()
        .eq("id", id);

      if (error) throw error;

      await fetchData();
      
      toast({
        title: "Point supprimé",
        description: "Le point a été retiré de la préparation",
      });
    } catch (error: any) {
      console.error("Error deleting custom point:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le point",
        variant: "destructive",
      });
    }
  };

  const saveTaskNote = async (todoId: string) => {
    const noteText = newNotes[todoId]?.trim();
    if (!noteText || !user?.id) return;

    try {
      const { error } = await supabase
        .from("meeting_preparation_notes")
        .insert([{
          todo_id: todoId,
          note_text: noteText,
          created_by: user.id
        }]);

      if (error) throw error;

      setNewNotes(prev => ({ ...prev, [todoId]: "" }));
      await fetchData();
      
      toast({
        title: "Note ajoutée",
        description: "La note a été ajoutée à la tâche",
      });
    } catch (error: any) {
      console.error("Error saving task note:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la note",
        variant: "destructive",
      });
    }
  };

  const deleteTaskNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("meeting_preparation_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;

      await fetchData();
      
      toast({
        title: "Note supprimée",
        description: "La note a été supprimée",
      });
    } catch (error: any) {
      console.error("Error deleting task note:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la note",
        variant: "destructive",
      });
    }
  };

  const clearAllPreparationData = async () => {
    if (!confirm("Êtes-vous sûr de vouloir effacer toutes les notes de préparation ? Cette action est irréversible.")) {
      return;
    }

    try {
      // Supprimer toutes les notes de tâches
      const { error: notesError } = await supabase
        .from("meeting_preparation_notes")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (notesError) throw notesError;

      // Supprimer tous les points personnalisés
      const { error: pointsError } = await supabase
        .from("meeting_preparation_custom_points")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (pointsError) throw pointsError;

      await fetchData();
      
      toast({
        title: "Données effacées",
        description: "Toutes les notes de préparation ont été supprimées",
      });
    } catch (error: any) {
      console.error("Error clearing preparation data:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'effacer les données",
        variant: "destructive",
      });
    }
  };

  const getPriorityColor = (score: number) => {
    if (score >= 8) return "bg-red-100 text-red-800 border-red-200";
    if (score >= 6) return "bg-orange-100 text-orange-800 border-orange-200";
    if (score >= 4) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-green-100 text-green-800 border-green-200";
  };

  const getTaskNotesByTodoId = (todoId: string) => {
    return taskNotes.filter(note => note.todo_id === todoId);
  };

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Préparation de la prochaine réunion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Chargement des tâches en cours...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Préparation de la prochaine réunion
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={clearAllPreparationData}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Effacer après réunion
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Tâches en cours classées par importance */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Tâches en cours ({tasks.length})
          </h3>
          
          {tasks.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground bg-gray-50 rounded-lg">
              Aucune tâche en cours
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="border rounded-lg p-4 bg-white">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-medium">{task.description}</p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        {task.due_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(task.due_date), "d MMM yyyy", { locale: fr })}
                          </span>
                        )}
                        {task.todo_participants && task.todo_participants.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {task.todo_participants.length} participant(s)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className={getPriorityColor(task.priority_score)}>
                        Priorité {task.priority_score}/10
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {task.priority_reason}
                      </p>
                    </div>
                  </div>

                  {/* Notes existantes pour cette tâche */}
                  {getTaskNotesByTodoId(task.id).length > 0 && (
                    <div className="mb-2">
                      <p className="text-sm font-medium mb-1">Notes :</p>
                      {getTaskNotesByTodoId(task.id).map((note) => (
                        <div key={note.id} className="flex justify-between items-start bg-blue-50 p-2 rounded text-sm">
                          <span>{note.note_text}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTaskNote(note.id)}
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Ajouter une note */}
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Ajouter une note pour cette tâche..."
                      value={newNotes[task.id] || ""}
                      onChange={(e) => setNewNotes(prev => ({ ...prev, [task.id]: e.target.value }))}
                      className="flex-1 min-h-[60px]"
                    />
                    <Button
                      onClick={() => saveTaskNote(task.id)}
                      disabled={!newNotes[task.id]?.trim()}
                      size="sm"
                    >
                      Ajouter
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Points additionnels */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Points additionnels à aborder
          </h3>
          
          {/* Ajouter un point */}
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Ajouter un point à aborder..."
              value={newPoint}
              onChange={(e) => setNewPoint(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCustomPoint()}
              className="flex-1"
            />
            <Button onClick={addCustomPoint} disabled={!newPoint.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </div>

          {/* Liste des points */}
          {customPoints.length > 0 ? (
            <div className="space-y-2">
              {customPoints.map((point) => (
                <div key={point.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                  <span>{point.point_text}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteCustomPoint(point.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground bg-gray-50 rounded-lg">
              Aucun point additionnel ajouté
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
