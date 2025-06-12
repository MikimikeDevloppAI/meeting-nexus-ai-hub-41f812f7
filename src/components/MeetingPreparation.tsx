
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { TaskPriorityService, TaskWithPriority } from "@/services/taskPriorityService";
import { Trash2, Plus, Calendar } from "lucide-react";

interface CustomPoint {
  id: string;
  point_text: string;
  created_at: string;
}

export const MeetingPreparation = () => {
  const [tasks, setTasks] = useState<TaskWithPriority[]>([]);
  const [customPoints, setCustomPoints] = useState<CustomPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newPoint, setNewPoint] = useState("");
  
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

  const clearAllPreparationData = async () => {
    if (!confirm("Êtes-vous sûr de vouloir effacer toutes les notes de préparation ? Cette action est irréversible.")) {
      return;
    }

    try {
      // Supprimer toutes les notes de tâches
      const { error: notesError } = await supabase
        .from("meeting_preparation_notes")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (notesError) throw notesError;

      // Supprimer tous les points personnalisés
      const { error: pointsError } = await supabase
        .from("meeting_preparation_custom_points")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

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
        
        {/* Tâches en cours avec bullet points */}
        <div>
          <h3 className="font-semibold mb-3">
            Tâches en cours ({tasks.length})
          </h3>
          
          {tasks.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground bg-gray-50 rounded-lg">
              Aucune tâche en cours
            </div>
          ) : (
            <ul className="space-y-2">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-start gap-3">
                  <span className="text-muted-foreground mt-2">•</span>
                  <div className="flex-1 flex justify-between items-start">
                    <span className="text-sm">{task.description}</span>
                    <Badge variant="outline" className={`${getPriorityColor(task.priority_score)} ml-2 text-xs`}>
                      {task.priority_score}/10
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Points personnels à ajouter */}
        <div>
          <h3 className="font-semibold mb-3">
            Points personnels à aborder
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
            <ul className="space-y-2">
              {customPoints.map((point) => (
                <li key={point.id} className="flex items-start gap-3">
                  <span className="text-muted-foreground mt-1">•</span>
                  <div className="flex-1 flex justify-between items-center">
                    <span className="text-sm">{point.point_text}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteCustomPoint(point.id)}
                      className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-4 text-muted-foreground bg-gray-50 rounded-lg">
              Aucun point personnel ajouté
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
