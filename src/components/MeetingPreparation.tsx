
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Trash2, Plus, Calendar } from "lucide-react";

interface Todo {
  id: string;
  description: string;
  created_at: string;
}

interface CustomPoint {
  id: string;
  point_text: string;
  created_at: string;
}

export const MeetingPreparation = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
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
      
      // Récupérer simplement les tâches en cours
      const { data: todosData, error: todosError } = await supabase
        .from("todos")
        .select("id, description, created_at")
        .eq("status", "confirmed")
        .order("created_at", { ascending: false });

      if (todosError) throw todosError;
      setTodos(todosData || []);

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

  const clearAllCustomPoints = async () => {
    if (!confirm("Êtes-vous sûr de vouloir effacer tous les points personnels ? Cette action est irréversible.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("meeting_preparation_custom_points")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) throw error;

      await fetchData();
      
      toast({
        title: "Points effacés",
        description: "Tous les points personnels ont été supprimés",
      });
    } catch (error: any) {
      console.error("Error clearing custom points:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'effacer les points",
        variant: "destructive",
      });
    }
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
            Chargement...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Préparation de la prochaine réunion
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Tâches en cours */}
        <div>
          <h3 className="font-semibold mb-3">
            Tâches en cours ({todos.length})
          </h3>
          
          {todos.length === 0 ? (
            <div className="text-center py-3 text-muted-foreground text-sm">
              Aucune tâche en cours
            </div>
          ) : (
            <ul className="space-y-1">
              {todos.map((todo) => (
                <li key={todo.id} className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-1 text-sm">•</span>
                  <span className="text-sm">{todo.description}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Séparateur visuel */}
        <div className="border-t pt-6">
          {/* Points personnels à ajouter */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">
                Points personnels à aborder
              </h3>
              {customPoints.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={clearAllCustomPoints}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Effacer les notes
                </Button>
              )}
            </div>
            
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
                <Plus className="h-4 w-4 mr-1" />
                Ajouter
              </Button>
            </div>

            {/* Liste des points */}
            {customPoints.length > 0 ? (
              <ul className="space-y-1">
                {customPoints.map((point) => (
                  <li key={point.id} className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-1 text-sm">•</span>
                    <div className="flex-1 flex justify-between items-start">
                      <span className="text-sm">{point.point_text}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCustomPoint(point.id)}
                        className="text-red-600 hover:text-red-700 h-6 w-6 p-0 ml-2"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-3 text-muted-foreground text-sm">
                Aucun point personnel ajouté
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
