
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ParticipantsSection } from "./ParticipantsSection";
import { AudioRecordingSection } from "./AudioRecordingSection";
import { NewParticipantDialog } from "./NewParticipantDialog";
import { SimpleLoadingScreen } from "./SimpleLoadingScreen";

interface Participant {
  id: string;
  name: string;
  email: string;
}

interface SimpleMeetingFormProps {
  isSubmitting: boolean;
  isComplete: boolean;
  onSubmit: (
    title: string,
    audioBlob: Blob | null,
    audioFile: File | null,
    participants: Participant[],
    selectedParticipantIds: string[]
  ) => void;
}

export const SimpleMeetingForm = ({ isSubmitting, isComplete, onSubmit }: SimpleMeetingFormProps) => {
  const [title, setTitle] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [isNewParticipantDialogOpen, setIsNewParticipantDialogOpen] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        const { data, error } = await supabase
          .from("participants")
          .select("*")
          .order('name', { ascending: true });

        if (error) throw error;
        
        const participantsList = data || [];
        setParticipants(participantsList);
        
        // Automatiquement sélectionner tous les participants
        const allParticipantIds = participantsList.map(p => p.id);
        setSelectedParticipantIds(allParticipantIds);
      } catch (error: any) {
        console.error("Error fetching participants:", error);
        toast({
          title: "Error loading participants",
          description: error.message || "Please try again later",
          variant: "destructive",
        });
      }
    };

    fetchParticipants();
  }, [toast]);

  const toggleParticipantSelection = (id: string) => {
    setSelectedParticipantIds(prev =>
      prev.includes(id)
        ? prev.filter(participantId => participantId !== id)
        : [...prev, id]
    );
  };

  const handleParticipantAdded = (newParticipant: Participant) => {
    setParticipants(prev => [...prev, newParticipant]);
    setSelectedParticipantIds(prev => [...prev, newParticipant.id]);
  };

  const handleSubmit = () => {
    // Basic validation
    if (!title?.trim()) {
      toast({
        title: "Titre requis",
        description: "Veuillez saisir un titre pour la réunion",
        variant: "destructive",
      });
      return;
    }

    if (selectedParticipantIds.length === 0) {
      toast({
        title: "Participants requis",
        description: "Veuillez sélectionner au moins un participant",
        variant: "destructive",
      });
      return;
    }

    if (!audioBlob && !audioFile) {
      toast({
        title: "Audio requis",
        description: "Veuillez enregistrer ou télécharger un fichier audio",
        variant: "destructive",
      });
      return;
    }
    
    onSubmit(title, audioBlob, audioFile, participants, selectedParticipantIds);
  };

  // Show loading screen when submitting
  if (isSubmitting) {
    return <SimpleLoadingScreen isComplete={isComplete} />;
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="space-y-4">
          <Label htmlFor="title">Titre de la réunion</Label>
          <Input
            id="title"
            placeholder="Entrez le titre de la réunion"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <ParticipantsSection
          participants={participants}
          selectedParticipantIds={selectedParticipantIds}
          onToggleParticipant={toggleParticipantSelection}
          onOpenNewParticipantDialog={() => setIsNewParticipantDialogOpen(true)}
        />

        <AudioRecordingSection
          audioBlob={audioBlob}
          audioFile={audioFile}
          audioUrl={audioUrl}
          isRecording={isRecording}
          onAudioBlobChange={setAudioBlob}
          onAudioFileChange={setAudioFile}
          onAudioUrlChange={setAudioUrl}
          onRecordingChange={setIsRecording}
        />
      </div>
      
      <div className="mt-6">
        <Button
          onClick={handleSubmit}
          className="w-full"
        >
          Soumettre la réunion
        </Button>
      </div>

      <NewParticipantDialog
        isOpen={isNewParticipantDialogOpen}
        onClose={() => setIsNewParticipantDialogOpen(false)}
        onParticipantAdded={handleParticipantAdded}
      />
    </Card>
  );
};
