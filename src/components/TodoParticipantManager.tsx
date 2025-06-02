
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Participant {
  id: string;
  name: string;
  email: string;
}

interface TodoParticipantManagerProps {
  todoId: string;
  currentParticipants: Participant[];
  onParticipantsUpdate: () => void;
  compact?: boolean;
}

export const TodoParticipantManager = ({ 
  todoId, 
  currentParticipants, 
  onParticipantsUpdate,
  compact = false
}: TodoParticipantManagerProps) => {
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAllParticipants();
  }, []);

  const fetchAllParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from("participants")
        .select("id, name, email")
        .order("name");

      if (error) throw error;
      setAllParticipants(data || []);
    } catch (error: any) {
      console.error("Error fetching participants:", error);
    }
  };

  const addParticipant = async () => {
    if (!selectedParticipantId) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("todo_participants")
        .insert({
          todo_id: todoId,
          participant_id: selectedParticipantId
        });

      if (error) throw error;

      setSelectedParticipantId("");
      onParticipantsUpdate();
      
      toast({
        title: "Participant ajouté",
        description: "Le participant a été assigné à la tâche avec succès.",
      });
    } catch (error: any) {
      console.error("Error adding participant:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'ajouter le participant",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const removeParticipant = async (participantId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("todo_participants")
        .delete()
        .eq("todo_id", todoId)
        .eq("participant_id", participantId);

      if (error) throw error;

      onParticipantsUpdate();
      
      toast({
        title: "Participant retiré",
        description: "Le participant a été retiré de la tâche avec succès.",
      });
    } catch (error: any) {
      console.error("Error removing participant:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de retirer le participant",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const availableParticipants = allParticipants.filter(
    p => !currentParticipants.some(cp => cp.id === p.id)
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {currentParticipants.map((participant) => (
          <Badge key={participant.id} variant="secondary" className="text-xs">
            {participant.name}
          </Badge>
        ))}
        {currentParticipants.length === 0 && (
          <span className="text-xs text-muted-foreground">Non assignée</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {currentParticipants.map((participant) => (
          <Badge key={participant.id} variant="secondary" className="flex items-center gap-1">
            {participant.name}
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => removeParticipant(participant.id)}
              disabled={isLoading}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
        {currentParticipants.length === 0 && (
          <span className="text-sm text-muted-foreground">Non assignée</span>
        )}
      </div>

      <div className="flex gap-2">
        <Select value={selectedParticipantId} onValueChange={setSelectedParticipantId}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Ajouter un participant" />
          </SelectTrigger>
          <SelectContent>
            {availableParticipants.map((participant) => (
              <SelectItem key={participant.id} value={participant.id}>
                {participant.name} ({participant.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="icon"
          onClick={addParticipant}
          disabled={!selectedParticipantId || isLoading}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
