import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import { uploadAudioToAssemblyAI, requestTranscription, pollForTranscription } from "@/lib/assemblyai";
import { ProcessingSteps } from "@/components/meeting/ProcessingSteps";
import { ParticipantsSection } from "@/components/meeting/ParticipantsSection";
import { AudioRecordingSection } from "@/components/meeting/AudioRecordingSection";
import { NewParticipantDialog } from "@/components/meeting/NewParticipantDialog";

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

const NewMeeting = () => {
  const [title, setTitle] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [isNewParticipantDialogOpen, setIsNewParticipantDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Processing states
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
    { id: 'upload', title: 'Téléchargement de l\'audio', status: 'pending' },
    { id: 'transcribe', title: 'Transcription en cours', status: 'pending' },
    { id: 'speakers', title: 'Détection des intervenants', status: 'pending' },
    { id: 'process', title: 'Traitement du transcript', status: 'pending' },
    { id: 'save', title: 'Sauvegarde de la réunion', status: 'pending' }
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

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

  const updateStepStatus = (stepId: string, status: ProcessingStep['status']) => {
    setProcessingSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const nextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, processingSteps.length - 1));
  };

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

  const uploadAudioToStorage = async (): Promise<string | null> => {
    if (!audioBlob && !audioFile) return null;

    updateStepStatus('upload', 'processing');
    setProgress(25);

    const fileToUpload = audioFile || new File([audioBlob!], "recording.webm", { 
      type: audioBlob?.type || "audio/webm" 
    });
    
    const fileName = `meetings/${Date.now()}-${fileToUpload.name}`;

    try {
      const { data, error } = await supabase.storage
        .from("meeting-audio")
        .upload(fileName, fileToUpload);

      if (error) throw error;
      
      const { data: publicUrlData } = supabase.storage
        .from("meeting-audio")
        .getPublicUrl(fileName);
      
      updateStepStatus('upload', 'completed');
      nextStep();
      setProgress(50);
      return publicUrlData.publicUrl;
    } catch (error) {
      updateStepStatus('upload', 'error');
      throw error;
    }
  };

  const processTranscription = async (audioFileUrl: string): Promise<string> => {
    try {
      updateStepStatus('transcribe', 'processing');
      setProgress(50);
      
      const uploadUrl = await uploadAudioToAssemblyAI(audioFileUrl);
      const participantCount = Math.max(selectedParticipantIds.length, 2); // Minimum 2 speakers
      const transcriptId = await requestTranscription(uploadUrl, participantCount);
      
      updateStepStatus('transcribe', 'completed');
      updateStepStatus('speakers', 'processing');
      nextStep();
      setProgress(65);
      
      const result = await pollForTranscription(transcriptId);
      
      updateStepStatus('speakers', 'completed');
      updateStepStatus('process', 'processing');
      nextStep();
      setProgress(80);
      
      if (result.text) {
        console.log(`Original transcript from AssemblyAI: ${result.text.length} characters`);
        
        // Get selected participants details for OpenAI processing
        const selectedParticipants = participants.filter(p => 
          selectedParticipantIds.includes(p.id)
        );

        // Process transcript with OpenAI
        try {
          console.log('Sending transcript to OpenAI for processing...');
          const { data: { processedTranscript }, error } = await supabase.functions.invoke('process-transcript', {
            body: {
              transcript: result.text,
              participants: selectedParticipants
            }
          });

          if (error) {
            console.error('Error processing transcript with OpenAI:', error);
            updateStepStatus('process', 'error');
            toast({
              title: "Erreur de traitement",
              description: "Le traitement OpenAI a échoué, transcript original conservé",
              variant: "destructive",
            });
            return result.text; // Return original transcript if processing fails
          }

          console.log(`Processed transcript from OpenAI: ${processedTranscript?.length || 0} characters`);
          
          // Validate processed transcript
          if (!processedTranscript || processedTranscript.length < result.text.length * 0.3) {
            console.warn('Processed transcript seems incomplete, using original');
            updateStepStatus('process', 'error');
            toast({
              title: "Traitement incomplet",
              description: "Le transcript traité semble incomplet, transcript original conservé",
              variant: "destructive",
            });
            return result.text;
          }

          updateStepStatus('process', 'completed');
          nextStep();
          setProgress(90);
          return processedTranscript || result.text;
        } catch (openaiError) {
          console.error('OpenAI processing failed:', openaiError);
          updateStepStatus('process', 'error');
          toast({
            title: "Erreur de traitement",
            description: "Le traitement OpenAI a échoué, transcript original conservé",
            variant: "destructive",
          });
          return result.text; // Return original transcript if processing fails
        }
      }
      
      return result.text || "";
    } catch (error) {
      const currentStepId = processingSteps[currentStep]?.id;
      if (currentStepId) {
        updateStepStatus(currentStepId, 'error');
      }
      throw error;
    }
  };

  const createMeeting = async () => {
    if (!title) {
      toast({
        title: "Information manquante",
        description: "Veuillez saisir un titre de réunion",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Erreur d'authentification",
        description: "Vous devez être connecté pour créer une réunion",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setProgress(0);
    setCurrentStep(0);
    
    // Reset all steps to pending
    setProcessingSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));

    try {
      let audioFileUrl = null;
      let transcript = null;

      if (audioBlob || audioFile) {
        audioFileUrl = await uploadAudioToStorage();
        
        if (audioFileUrl) {
          try {
            transcript = await processTranscription(audioFileUrl);
          } catch (transcriptionError) {
            console.error("Transcription failed:", transcriptionError);
            toast({
              title: "Erreur de transcription",
              description: "La transcription a échoué, mais la réunion sera créée sans transcription.",
              variant: "destructive",
            });
          }
        }
      }

      updateStepStatus('save', 'processing');
      setProgress(95);

      const { data: meetingData, error: meetingError } = await supabase
        .from("meetings")
        .insert([
          {
            title,
            audio_url: audioFileUrl,
            created_by: user.id,
            transcript,
            summary: null
          },
        ])
        .select();

      if (meetingError) throw meetingError;
      
      if (!meetingData || meetingData.length === 0) {
        throw new Error("Échec de la création de la réunion");
      }

      const meetingId = meetingData[0].id;

      if (selectedParticipantIds.length > 0) {
        const participantsToAdd = selectedParticipantIds.map(participantId => ({
          meeting_id: meetingId,
          participant_id: participantId,
        }));

        const { error: participantsError } = await supabase
          .from("meeting_participants")
          .insert(participantsToAdd);

        if (participantsError) throw participantsError;
      }

      updateStepStatus('save', 'completed');
      setProgress(100);

      toast({
        title: "Réunion créée",
        description: transcript 
          ? "Votre réunion a été créée avec succès et la transcription a été générée"
          : "Votre réunion a été créée avec succès",
      });

      navigate(`/meetings/${meetingId}`);
    } catch (error: any) {
      console.error("Erreur lors de la création de la réunion:", error);
      toast({
        title: "Erreur de création de la réunion",
        description: error.message || "Veuillez réessayer",
        variant: "destructive",
      });
      setIsSubmitting(false);
      setProgress(0);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/meetings")}
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour aux Réunions
        </Button>
        <h1 className="text-2xl font-bold">Créer une nouvelle réunion</h1>
        <p className="text-muted-foreground">
          Remplissez les détails de la réunion et ajoutez des participants
        </p>
      </div>

      <div>
        <Card className="p-6 mb-6">
          <div className="space-y-6">
            <ProcessingSteps 
              isSubmitting={isSubmitting}
              processingSteps={processingSteps}
              progress={progress}
            />

            {/* Meeting Title */}
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
          
          {/* Submit Button */}
          <div className="mt-6">
            <Button
              onClick={createMeeting}
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Traitement en cours...
                </>
              ) : (
                "Soumettre la réunion"
              )}
            </Button>
          </div>
        </Card>
      </div>

      <NewParticipantDialog
        isOpen={isNewParticipantDialogOpen}
        onClose={() => setIsNewParticipantDialogOpen(false)}
        onParticipantAdded={handleParticipantAdded}
      />
    </div>
  );
};

export default NewMeeting;
