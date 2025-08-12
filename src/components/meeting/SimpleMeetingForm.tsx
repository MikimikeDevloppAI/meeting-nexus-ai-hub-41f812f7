
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

interface User {
  id: string;
  name: string;
  email: string;
}

interface SimpleMeetingFormProps {
  isSubmitting: boolean;
  isComplete: boolean;
  meetingStatus?: any;
  onSubmit: (
    title: string,
    audioBlob: Blob | null,
    audioFile: File | null,
    users: User[],
    selectedUserIds: string[]
  ) => void;
}

export const SimpleMeetingForm = ({ 
  isSubmitting, 
  isComplete, 
  meetingStatus,
  onSubmit 
}: SimpleMeetingFormProps) => {
  console.log('[SimpleMeetingForm] Rendered with props:', { isSubmitting, isComplete });
  
  const [title, setTitle] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isNewParticipantDialogOpen, setIsNewParticipantDialogOpen] = useState(false);
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  // Extract meeting ID from URL if we're on a meeting page
  useEffect(() => {
    const path = window.location.pathname;
    const meetingMatch = path.match(/\/meetings\/([^\/]+)/);
    if (meetingMatch) {
      setCurrentMeetingId(meetingMatch[1]);
    }
  }, []);

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq('approved', true)
          .order('name', { ascending: true });

        if (error) throw error;
        
        const usersList = (data || []).filter(u => (u.email || '').toLowerCase() !== 'michael.enry4@gmail.com');
        setUsers(usersList);
        
        // Automatiquement sélectionner tous les utilisateurs (filtrés)
        const allUserIds = usersList.map(u => u.id);
        setSelectedUserIds(allUserIds);
        console.log('[SimpleMeetingForm] Auto-selected users:', allUserIds);
      } catch (error: any) {
        console.error("Error fetching users:", error);
        toast({
          title: "Error loading users",
          description: error.message || "Please try again later",
          variant: "destructive",
        });
      }
    };

    fetchParticipants();
  }, [toast]);

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

  const handleViewMeeting = () => {
    if (currentMeetingId) {
      navigate(`/meetings/${currentMeetingId}`);
    }
  };

  const handleSubmit = () => {
    console.log('[SimpleMeetingForm] handleSubmit called');
    console.log('[SimpleMeetingForm] Form state:', { 
      title: title?.trim() || 'EMPTY', 
      hasAudio: !!(audioBlob || audioFile), 
      participantCount: selectedUserIds.length,
      isSubmitting 
    });
    
    // Basic validation
    if (!title?.trim()) {
      console.log('[SimpleMeetingForm] Validation failed: no title');
      toast({
        title: "Titre requis",
        description: "Veuillez saisir un titre pour la réunion",
        variant: "destructive",
      });
      return;
    }

    if (selectedUserIds.length === 0) {
      console.log('[SimpleMeetingForm] Validation failed: no participants');
      toast({
        title: "Participants requis",
        description: "Veuillez sélectionner au moins un utilisateur",
        variant: "destructive",
      });
      return;
    }

    if (!audioBlob && !audioFile) {
      console.log('[SimpleMeetingForm] Validation failed: no audio');
      toast({
        title: "Audio requis",
        description: "Veuillez enregistrer ou télécharger un fichier audio",
        variant: "destructive",
      });
      return;
    }
    
    console.log('[SimpleMeetingForm] Validation passed, calling onSubmit');
    console.log('[SimpleMeetingForm] Calling onSubmit with:', {
      title: title.trim(),
      hasAudioBlob: !!audioBlob,
      hasAudioFile: !!audioFile,
      participantsCount: users.length,
      selectedParticipantsCount: selectedUserIds.length
    });
    
    try {
      onSubmit(title, audioBlob, audioFile, users, selectedUserIds);
      console.log('[SimpleMeetingForm] onSubmit called successfully');
    } catch (error) {
      console.error('[SimpleMeetingForm] Error calling onSubmit:', error);
    }
  };

  // Show loading screen when submitting
  if (isSubmitting) {
    console.log('[SimpleMeetingForm] Showing loading screen');
    return (
      <SimpleLoadingScreen 
        isComplete={isComplete} 
        meetingStatus={meetingStatus}
        onViewMeeting={handleViewMeeting}
      />
    );
  }

  console.log('[SimpleMeetingForm] Rendering form');
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
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Traitement en cours..." : "Soumettre la réunion"}
        </Button>
      </div>

    </Card>
  );
};
