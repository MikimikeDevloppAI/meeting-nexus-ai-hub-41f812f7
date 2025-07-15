
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProcessingSteps } from "./ProcessingSteps";
import { ParticipantsSection } from "./ParticipantsSection";
import { AudioRecordingSection } from "./AudioRecordingSection";
import { NewParticipantDialog } from "./NewParticipantDialog";
import { MeetingResults } from "./MeetingResults";

interface User {
  id: string;
  name: string;
  email: string;
}

interface ProcessingStep {
  id: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

interface Task {
  id: string;
  description: string;
  status: 'pending' | 'confirmed' | 'completed';
  assignedTo?: string;
  recommendation?: string;
  todo_participants?: Array<{
    participant_id: string;
    participants: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

interface MeetingFormProps {
  isSubmitting: boolean;
  processingSteps: ProcessingStep[];
  onSubmit: (
    title: string,
    audioBlob: Blob | null,
    audioFile: File | null,
    users: User[],
    selectedUserIds: string[]
  ) => void;
}

export const MeetingForm = ({ isSubmitting, processingSteps, onSubmit }: MeetingFormProps) => {
  console.log('[MeetingForm] Props received:', { isSubmitting, stepsCount: processingSteps.length });
  
  const [title, setTitle] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isNewParticipantDialogOpen, setIsNewParticipantDialogOpen] = useState(false);
  const [meetingResults, setMeetingResults] = useState<{
    transcript?: string;
    summary?: string;
    tasks?: Task[];
  }>({});
  
  const { toast } = useToast();

  // Logique d'affichage simplifiée - on utilise uniquement isSubmitting du hook
  const showForm = !isSubmitting;
  const showProcessing = isSubmitting;
  
  console.log('[MeetingForm] State:', { 
    showForm, 
    showProcessing, 
    isSubmitting,
    title 
  });

  // Add useEffect to log when isSubmitting changes
  useEffect(() => {
    console.log('[MeetingForm] isSubmitting changed to:', isSubmitting);
  }, [isSubmitting]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq('approved', true)
          .order('name', { ascending: true });

        if (error) throw error;
        setUsers(data || []);
      } catch (error: any) {
        console.error("Error fetching users:", error);
        toast({
          title: "Error loading users",
          description: error.message || "Please try again later",
          variant: "destructive",
        });
      }
    };

    fetchUsers();
  }, [toast]);

  useEffect(() => {
    if (!isSubmitting) return;

    const checkForUpdates = async () => {
      const interval = setInterval(async () => {
        // Check if transcript is ready
        if (processingSteps.find(s => s.id === 'transcribe')?.status === 'completed' && !meetingResults.transcript) {
          setMeetingResults(prev => ({
            ...prev,
            transcript: "Transcript en cours de génération..."
          }));
        }

        // Check if summary is ready
        if (processingSteps.find(s => s.id === 'summary')?.status === 'completed' && !meetingResults.summary) {
          setMeetingResults(prev => ({
            ...prev,
            summary: "Résumé en cours de génération..."
          }));
        }

        // Check if tasks are ready
        if (processingSteps.find(s => s.id === 'save')?.status === 'completed' && !meetingResults.tasks) {
          setMeetingResults(prev => ({
            ...prev,
            tasks: []
          }));
        }
      }, 1000);

      return () => clearInterval(interval);
    };

    checkForUpdates();
  }, [isSubmitting, processingSteps, meetingResults]);

  const toggleUserSelection = (id: string) => {
    setSelectedUserIds(prev =>
      prev.includes(id)
        ? prev.filter(userId => userId !== id)
        : [...prev, id]
    );
  };

  const handleUserAdded = (newUser: User) => {
    setUsers(prev => [...prev, newUser]);
    setSelectedUserIds(prev => [...prev, newUser.id]);
  };

  const handleSubmit = () => {
    console.log('[MeetingForm] handleSubmit called with:', { 
      title, 
      hasAudio: !!(audioBlob || audioFile), 
      participantCount: selectedUserIds.length 
    });
    
    // Basic validation before calling onSubmit
    if (!title?.trim()) {
      toast({
        title: "Titre requis",
        description: "Veuillez saisir un titre pour la réunion",
        variant: "destructive",
      });
      return;
    }

    if (selectedUserIds.length === 0) {
      toast({
        title: "Participants requis",
        description: "Veuillez sélectionner au moins un utilisateur",
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
    
    console.log('[MeetingForm] Validation passed, calling onSubmit');
    // Reset results et appeler directement onSubmit
    setMeetingResults({});
    onSubmit(title, audioBlob, audioFile, users, selectedUserIds);
  };

  return (
    <div className="space-y-6">
      {/* Show form only when not submitting */}
      {showForm && (
        <Card className="p-6 mb-6">
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
              users={users}
              selectedUserIds={selectedUserIds}
              onToggleUser={toggleUserSelection}
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
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? "Traitement en cours..." : "Soumettre la réunion"}
            </Button>
          </div>

        </Card>
      )}

      {/* Show processing when submitting */}
      {showProcessing && (
        <>
          <ProcessingSteps 
            isSubmitting={showProcessing}
            processingSteps={processingSteps}
          />
          
          <MeetingResults 
            transcript={meetingResults.transcript}
            summary={meetingResults.summary}
            tasks={meetingResults.tasks}
          />
        </>
      )}
    </div>
  );
};
