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

interface Participant {
  id: string;
  name: string;
  email: string;
}

interface ProcessingStep {
  id: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

interface MeetingFormProps {
  isSubmitting: boolean;
  processingSteps: ProcessingStep[];
  progress: number;
  onSubmit: (
    title: string,
    audioBlob: Blob | null,
    audioFile: File | null,
    participants: Participant[],
    selectedParticipantIds: string[]
  ) => void;
}

export const MeetingForm = ({ isSubmitting, processingSteps, progress, onSubmit }: MeetingFormProps) => {
  console.log('[MeetingForm] Props received:', { isSubmitting, progress, stepsCount: processingSteps.length });
  
  const [title, setTitle] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [isNewParticipantDialogOpen, setIsNewParticipantDialogOpen] = useState(false);
  const [meetingResults, setMeetingResults] = useState<{
    transcript?: string;
    summary?: string;
    tasks?: Array<{ description: string; assignedTo?: string; recommendation?: string }>;
  }>({});
  
  // NEW: Add hasStartedSubmission state to prevent returning to form once submission starts
  const [hasStartedSubmission, setHasStartedSubmission] = useState(false);
  
  const { toast } = useToast();

  // Show form only when we haven't started submission AND not currently submitting
  const showForm = !hasStartedSubmission && !isSubmitting;
  // Show processing when we have started submission OR currently submitting
  const showProcessing = hasStartedSubmission || isSubmitting;
  
  console.log('[MeetingForm] State:', { 
    showForm, 
    showProcessing, 
    isSubmitting, 
    hasStartedSubmission, 
    title 
  });

  // Reset hasStartedSubmission when component mounts (for new session)
  useEffect(() => {
    console.log('[MeetingForm] Component mounted, resetting hasStartedSubmission');
    setHasStartedSubmission(false);
  }, []);

  // Track when submission starts
  useEffect(() => {
    if (isSubmitting && !hasStartedSubmission) {
      console.log('[MeetingForm] Submission started, setting hasStartedSubmission to true');
      setHasStartedSubmission(true);
    }
  }, [isSubmitting, hasStartedSubmission]);

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        const { data, error } = await supabase
          .from("participants")
          .select("*")
          .order('name', { ascending: true });

        if (error) throw error;
        setParticipants(data || []);
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
    console.log('[MeetingForm] handleSubmit called');
    setMeetingResults({}); // Reset results
    // DON'T set hasStartedSubmission here - let the useEffect handle it when isSubmitting becomes true
    onSubmit(title, audioBlob, audioFile, participants, selectedParticipantIds);
  };

  return (
    <div className="space-y-6">
      {/* Show form only when showForm is true */}
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
              disabled={isSubmitting || hasStartedSubmission}
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
      )}

      {/* Show processing and results when showProcessing is true */}
      {showProcessing && (
        <>
          <ProcessingSteps 
            isSubmitting={true} // Always show as submitting when in processing mode
            processingSteps={processingSteps}
            progress={progress}
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
