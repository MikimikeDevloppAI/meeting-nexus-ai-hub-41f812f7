import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

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
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showMultiSelect, setShowMultiSelect] = useState(false);
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

  const addMultipleParticipants = async () => {
    if (selectedParticipantIds.length === 0) return;
    
    setIsLoading(true);
    try {
      // Insérer tous les participants sélectionnés
      const insertData = selectedParticipantIds.map(participantId => ({
        todo_id: todoId,
        participant_id: participantId
      }));

      const { error } = await supabase
        .from("todo_participants")
        .insert(insertData);

      if (error) throw error;

      setSelectedParticipantIds([]);
      setShowMultiSelect(false);
      onParticipantsUpdate();
      
      toast({
        title: "Participants ajoutés",
        description: `${selectedParticipantIds.length} participant(s) ont été assigné(s) à la tâche avec succès.`,
      });
    } catch (error: any) {
      console.error("Error adding participants:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'ajouter les participants",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addSingleParticipant = async (participantId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("todo_participants")
        .insert({
          todo_id: todoId,
          participant_id: participantId
        });

      if (error) throw error;

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

  const toggleParticipantSelection = (participantId: string) => {
    setSelectedParticipantIds(prev => 
      prev.includes(participantId)
        ? prev.filter(id => id !== participantId)
        : [...prev, participantId]
    );
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

      {!showMultiSelect ? (
        <div className="flex gap-2">
          <Select onValueChange={addSingleParticipant}>
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
            variant="outline"
            onClick={() => setShowMultiSelect(true)}
            disabled={availableParticipants.length === 0}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-medium">Sélectionner plusieurs participants</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowMultiSelect(false);
                setSelectedParticipantIds([]);
              }}
            >
              Annuler
            </Button>
          </div>
          
          <div className="max-h-32 overflow-y-auto space-y-2 border rounded-md p-2">
            {availableParticipants.map((participant) => (
              <div key={participant.id} className="flex items-center space-x-2">
                <Checkbox
                  id={participant.id}
                  checked={selectedParticipantIds.includes(participant.id)}
                  onCheckedChange={() => toggleParticipantSelection(participant.id)}
                />
                <label
                  htmlFor={participant.id}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                >
                  {participant.name} ({participant.email})
                </label>
              </div>
            ))}
            {availableParticipants.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Tous les participants sont déjà assignés
              </p>
            )}
          </div>
          
          {selectedParticipantIds.length > 0 && (
            <div className="flex gap-2">
              <Button
                onClick={addMultipleParticipants}
                disabled={isLoading}
                className="flex-1"
              >
                Ajouter {selectedParticipantIds.length} participant(s)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
