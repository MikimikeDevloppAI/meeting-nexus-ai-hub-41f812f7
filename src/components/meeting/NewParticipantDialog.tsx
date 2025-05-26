
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface Participant {
  id: string;
  name: string;
  email: string;
}

interface NewParticipantDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onParticipantAdded: (participant: Participant) => void;
}

export const NewParticipantDialog = ({
  isOpen,
  onClose,
  onParticipantAdded
}: NewParticipantDialogProps) => {
  const [newParticipantName, setNewParticipantName] = useState("");
  const [newParticipantEmail, setNewParticipantEmail] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();

  const addNewParticipant = async () => {
    if (!newParticipantName || !newParticipantEmail || !user) return;

    try {
      // Insert new participant
      const { data, error } = await supabase
        .from("participants")
        .insert([
          {
            name: newParticipantName,
            email: newParticipantEmail,
            created_by: user.id,
          },
        ])
        .select();

      if (error) throw error;
      
      if (data && data.length > 0) {
        onParticipantAdded(data[0] as Participant);
        toast({
          title: "Participant added",
          description: `${newParticipantName} has been added as a participant.`,
        });
      }

      onClose();
      setNewParticipantName("");
      setNewParticipantEmail("");
    } catch (error: any) {
      console.error("Error adding participant:", error);
      toast({
        title: "Error adding participant",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    onClose();
    setNewParticipantName("");
    setNewParticipantEmail("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un nouveau participant</DialogTitle>
          <DialogDescription>
            Entrez les informations du nouveau participant.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom</Label>
            <Input
              id="name"
              placeholder="Nom du participant"
              value={newParticipantName}
              onChange={(e) => setNewParticipantName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Email du participant"
              value={newParticipantEmail}
              onChange={(e) => setNewParticipantEmail(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button onClick={addNewParticipant}>Ajouter le participant</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
