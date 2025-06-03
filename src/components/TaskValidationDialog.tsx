
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Calendar, User, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TaskAction {
  type: 'create' | 'update' | 'delete' | 'complete';
  data: {
    description?: string;
    assigned_to?: string;
    due_date?: string;
    meeting_id?: string;
    status?: string;
    id?: string;
  };
}

interface TaskValidationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  taskAction: TaskAction | null;
  onValidate: (action: TaskAction) => void;
  onReject: () => void;
}

const TaskValidationDialog = ({ isOpen, onClose, taskAction, onValidate, onReject }: TaskValidationDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [assignedUserName, setAssignedUserName] = useState<string>("");
  const [participants, setParticipants] = useState<{id: string, name: string, email: string}[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchParticipants();
    }
  }, [isOpen]);

  useEffect(() => {
    if (taskAction?.data.assigned_to && participants.length > 0) {
      findUserName(taskAction.data.assigned_to);
    }
  }, [taskAction, participants]);

  const fetchParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from("participants")
        .select("id, name, email")
        .order("name");

      if (error) throw error;
      setParticipants(data || []);
    } catch (error) {
      console.error("Error fetching participants:", error);
    }
  };

  const findUserName = (assignedTo: string) => {
    // First try to find by ID
    let user = participants.find(p => p.id === assignedTo);
    
    // If not found by ID, try to find by name (case-insensitive)
    if (!user) {
      const lowerAssignedTo = assignedTo.toLowerCase();
      user = participants.find(p => 
        p.name.toLowerCase().includes(lowerAssignedTo) ||
        lowerAssignedTo.includes(p.name.toLowerCase()) ||
        p.email.toLowerCase().includes(lowerAssignedTo)
      );
    }
    
    setAssignedUserName(user ? user.name : assignedTo);
  };

  // Clean description by removing CONTEXT_UTILISATEURS
  const getCleanDescription = (description?: string) => {
    if (!description) return "";
    return description.replace(/\s*CONTEXT_UTILISATEURS:.*$/gi, '').trim();
  };

  if (!taskAction) return null;

  const handleValidate = async () => {
    setIsLoading(true);
    try {
      // Clean the description before validating
      const cleanedAction = {
        ...taskAction,
        data: {
          ...taskAction.data,
          description: getCleanDescription(taskAction.data.description)
        }
      };
      await onValidate(cleanedAction);
      onClose();
    } catch (error) {
      console.error('Error validating task action:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = () => {
    onReject();
    onClose();
  };

  const getActionTitle = () => {
    switch (taskAction.type) {
      case 'create':
        return 'Créer une nouvelle tâche';
      case 'update':
        return 'Modifier la tâche';
      case 'delete':
        return 'Supprimer la tâche';
      case 'complete':
        return 'Marquer la tâche comme terminée';
      default:
        return 'Action sur la tâche';
    }
  };

  const getActionDescription = () => {
    switch (taskAction.type) {
      case 'create':
        return 'L\'assistant souhaite créer une nouvelle tâche avec les détails suivants :';
      case 'update':
        return 'L\'assistant souhaite modifier cette tâche avec les nouvelles informations :';
      case 'delete':
        return 'L\'assistant souhaite supprimer cette tâche. Cette action est irréversible.';
      case 'complete':
        return 'L\'assistant souhaite marquer cette tâche comme terminée :';
      default:
        return 'L\'assistant souhaite effectuer une action sur cette tâche :';
    }
  };

  const getActionIcon = () => {
    switch (taskAction.type) {
      case 'create':
        return <FileText className="h-5 w-5 text-blue-500" />;
      case 'update':
        return <FileText className="h-5 w-5 text-orange-500" />;
      case 'delete':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Non définie';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const cleanDescription = getCleanDescription(taskAction.data.description);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getActionIcon()}
            {getActionTitle()}
          </DialogTitle>
          <DialogDescription>
            {getActionDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            {cleanDescription && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">Description</h4>
                <p className="text-sm">{cleanDescription}</p>
              </div>
            )}
            
            {taskAction.data.assigned_to && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Assigné à: {assignedUserName}</span>
              </div>
            )}
            
            {taskAction.data.due_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Échéance: {formatDate(taskAction.data.due_date)}</span>
              </div>
            )}
            
            {taskAction.data.status && (
              <div>
                <Badge variant={taskAction.data.status === 'completed' ? 'default' : 'secondary'}>
                  {taskAction.data.status === 'completed' ? 'Terminée' : 
                   taskAction.data.status === 'confirmed' ? 'Confirmée' : 'En attente'}
                </Badge>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReject}>
            Annuler
          </Button>
          <Button 
            onClick={handleValidate} 
            disabled={isLoading}
            className={taskAction.type === 'delete' ? 'bg-red-500 hover:bg-red-600' : ''}
          >
            {isLoading ? 'Traitement...' : 
             taskAction.type === 'delete' ? 'Supprimer' : 'Valider'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TaskValidationDialog;
