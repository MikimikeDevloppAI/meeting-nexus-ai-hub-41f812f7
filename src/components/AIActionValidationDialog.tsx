
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Plus, Calendar } from "lucide-react";

interface AIActionValidationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  action: {
    type: 'create_task' | 'add_meeting_point';
    description: string;
    details?: any;
  } | null;
  onConfirm: () => void;
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

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
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

  const getActionDescription = () => {
    switch (action.type) {
      case 'create_task':
        return `L'assistant IA souhaite créer la tâche suivante : "${action.description}"`;
      case 'add_meeting_point':
        return `L'assistant IA souhaite ajouter le point suivant à l'ordre du jour : "${action.description}"`;
      default:
        return action.description;
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {getActionIcon()}
            <AlertDialogTitle className="text-lg">
              {getActionTitle()}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            {getActionDescription()}
          </AlertDialogDescription>
          
          {action.details && (
            <div className="mt-3 p-3 bg-muted rounded-lg">
              <h4 className="font-medium text-sm mb-2">Détails supplémentaires :</h4>
              <div className="text-xs space-y-1">
                {action.details.participants && (
                  <div>
                    <span className="font-medium">Participants : </span>
                    {action.details.participants.join(', ')}
                  </div>
                )}
                {action.details.dueDate && (
                  <div>
                    <span className="font-medium">Échéance : </span>
                    {new Date(action.details.dueDate).toLocaleDateString('fr-FR')}
                  </div>
                )}
                {action.details.priority && (
                  <div>
                    <span className="font-medium">Priorité : </span>
                    {action.details.priority}
                  </div>
                )}
              </div>
            </div>
          )}
        </AlertDialogHeader>
        
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={handleReject} disabled={isProcessing}>
            Rejeter
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm} 
            disabled={isProcessing}
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
