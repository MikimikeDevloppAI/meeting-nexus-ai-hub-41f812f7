
import { useState, useEffect } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Plus, Calendar, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface Participant {
  id: string;
  name: string;
  email: string;
}

interface AIActionValidationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  action: {
    type: 'create_task' | 'add_meeting_point';
    description: string;
    details?: any;
  } | null;
  onConfirm: (selectedParticipants?: string[], modifiedDescription?: string) => void;
  onReject: () => void;
}

export const AIActionValidationDialog = ({ 
  isOpen, 
  onClose, 
  action, 
  onConfirm, 
  onReject 
}: AIActionValidationDialogProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [modifiedDescription, setModifiedDescription] = useState("");

  // Charger les participants et initialiser la description quand on ouvre le dialog
  useEffect(() => {
    if (isOpen && action) {
      setModifiedDescription(action.description);
      if (action.type === 'create_task') {
        loadParticipants();
      }
    }
  }, [isOpen, action]);

  const loadParticipants = async () => {
    setLoadingParticipants(true);
    try {
      const { data, error } = await supabase
        .from('participants')
        .select('id, name, email')
        .order('name');

      if (error) throw error;
      setParticipants(data || []);
    } catch (error) {
      console.error('Erreur chargement participants:', error);
    } finally {
      setLoadingParticipants(false);
    }
  };

  const toggleParticipant = (participantId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(participantId)
        ? prev.filter(id => id !== participantId)
        : [...prev, participantId]
    );
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      if (action?.type === 'create_task') {
        await onConfirm(selectedParticipants, modifiedDescription);
      } else {
        await onConfirm(undefined, modifiedDescription);
      }
      onClose();
    } catch (error) {
      console.error('Error confirming action:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = () => {
    onReject();
    onClose();
  };

  const handleClose = () => {
    setSelectedParticipants([]);
    setModifiedDescription("");
    onClose();
  };

  if (!action) return null;

  const getActionIcon = () => {
    switch (action.type) {
      case 'create_task':
        return <CheckCircle className="h-6 w-6 text-blue-600" />;
      case 'add_meeting_point':
        return <Calendar className="h-6 w-6 text-green-600" />;
      default:
        return <AlertCircle className="h-6 w-6 text-orange-600" />;
    }
  };

  const getActionTitle = () => {
    switch (action.type) {
      case 'create_task':
        return 'Créer une nouvelle tâche';
      case 'add_meeting_point':
        return 'Ajouter un point à l\'ordre du jour';
      default:
        return 'Action demandée';
    }
  };

  const getSelectedParticipantNames = () => {
    return selectedParticipants
      .map(id => participants.find(p => p.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {getActionIcon()}
            <AlertDialogTitle className="text-lg">
              {getActionTitle()}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            Vérifiez et modifiez si nécessaire la description ci-dessous :
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Section d'édition de la description */}
        <div className="my-4">
          <Label htmlFor="description" className="text-sm font-medium">
            Description :
          </Label>
          <Textarea
            id="description"
            value={modifiedDescription}
            onChange={(e) => setModifiedDescription(e.target.value)}
            className="mt-2 min-h-[100px]"
            placeholder="Entrez la description..."
          />
        </div>

        {/* Section de sélection des participants pour les tâches */}
        {action.type === 'create_task' && (
          <div className="flex-1 min-h-0 my-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-blue-600" />
              <h4 className="font-medium text-sm">Assigner à :</h4>
            </div>
            
            {loadingParticipants ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Chargement des participants...
              </div>
            ) : (
              <ScrollArea className="h-48 border rounded-lg p-3">
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div key={participant.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={participant.id}
                        checked={selectedParticipants.includes(participant.id)}
                        onChange={() => toggleParticipant(participant.id)}
                        className="rounded border-gray-300"
                      />
                      <label 
                        htmlFor={participant.id} 
                        className="text-sm cursor-pointer flex-1"
                      >
                        <div className="font-medium">{participant.name}</div>
                        <div className="text-xs text-muted-foreground">{participant.email}</div>
                      </label>
                    </div>
                  ))}
                  
                  {participants.length === 0 && (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      Aucun participant disponible
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
            
            {selectedParticipants.length > 0 && (
              <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                <div className="text-xs font-medium text-blue-800 mb-1">
                  Assigné à ({selectedParticipants.length}) :
                </div>
                <div className="text-xs text-blue-700">
                  {getSelectedParticipantNames()}
                </div>
              </div>
            )}
          </div>
        )}
        
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={handleReject} disabled={isProcessing}>
            Rejeter
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm} 
            disabled={isProcessing || !modifiedDescription.trim()}
            className="bg-primary hover:bg-primary/90"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Création...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Confirmer
              </span>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
