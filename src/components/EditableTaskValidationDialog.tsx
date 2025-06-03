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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface EditableTaskValidationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  taskAction: TaskAction | null;
  onValidate: (action: TaskAction) => void;
  onReject: () => void;
}

const EditableTaskValidationDialog = ({ isOpen, onClose, taskAction, onValidate, onReject }: EditableTaskValidationDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [participants, setParticipants] = useState<{id: string, name: string, email: string}[]>([]);
  
  // Editable fields
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchParticipants();
    }
  }, [isOpen]);

  useEffect(() => {
    if (taskAction && isOpen) {
      // Initialize editable fields with task action data
      setDescription(taskAction.data.description || "");
      setAssignedTo(taskAction.data.assigned_to || "");
      setDueDate(taskAction.data.due_date || "");
      setStatus(taskAction.data.status || "");
    }
  }, [taskAction, isOpen]);

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

  const getAssignedUserName = (assignedToValue: string) => {
    if (!assignedToValue || assignedToValue === "unassigned") return "Non assigné";
    
    // Try to find by ID first
    let user = participants.find(p => p.id === assignedToValue);
    
    // If not found by ID, try to find by name (case-insensitive)
    if (!user) {
      const lowerAssignedTo = assignedToValue.toLowerCase();
      user = participants.find(p => 
        p.name.toLowerCase().includes(lowerAssignedTo) ||
        lowerAssignedTo.includes(p.name.toLowerCase()) ||
        p.email.toLowerCase().includes(lowerAssignedTo)
      );
    }
    
    return user ? user.name : assignedToValue;
  };

  if (!taskAction) return null;

  const handleValidate = async () => {
    setIsLoading(true);
    try {
      // Create updated task action with edited values
      const updatedAction: TaskAction = {
        ...taskAction,
        data: {
          ...taskAction.data,
          description: description.trim(),
          assigned_to: assignedTo === "unassigned" ? undefined : assignedTo,
          due_date: dueDate || undefined,
          status: status || taskAction.data.status
        }
      };
      
      await onValidate(updatedAction);
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
        return 'Vous pouvez modifier les détails de la tâche avant de la créer :';
      case 'update':
        return 'Vous pouvez modifier les informations de la tâche :';
      case 'delete':
        return 'Êtes-vous sûr de vouloir supprimer cette tâche ? Cette action est irréversible.';
      case 'complete':
        return 'Marquer cette tâche comme terminée :';
      default:
        return 'Vous pouvez modifier les détails avant de valider :';
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

  const formatDateForInput = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
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
          {taskAction.type !== 'delete' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description de la tâche"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="assigned_to">Assigné à</Label>
                <Select value={assignedTo || "unassigned"} onValueChange={setAssignedTo}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sélectionner une personne" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Non assigné</SelectItem>
                    {participants.map((participant) => (
                      <SelectItem key={participant.id} value={participant.id}>
                        {participant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="due_date">Date d'échéance</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formatDateForInput(dueDate)}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              {taskAction.type === 'update' && (
                <div>
                  <Label htmlFor="status">Statut</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Sélectionner un statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="confirmed">Confirmée</SelectItem>
                      <SelectItem value="completed">Terminée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {taskAction.type === 'delete' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 text-red-800">
                <XCircle className="h-4 w-4" />
                <span className="font-medium">Attention</span>
              </div>
              <p className="text-sm text-red-700 mt-1">
                Cette action supprimera définitivement la tâche. Cette action ne peut pas être annulée.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReject}>
            Annuler
          </Button>
          <Button 
            onClick={handleValidate} 
            disabled={isLoading || (taskAction.type !== 'delete' && !description.trim())}
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

export default EditableTaskValidationDialog;
