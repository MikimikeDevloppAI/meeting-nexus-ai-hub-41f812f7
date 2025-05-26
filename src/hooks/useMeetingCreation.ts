
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useProcessingSteps } from "./useProcessingSteps";
import { MeetingService } from "@/services/meetingService";
import { AudioProcessingService } from "@/services/audioProcessingService";
import { MeetingCreationData } from "@/types/meeting";

export const useMeetingCreation = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { processingSteps, updateStepStatus, resetSteps } = useProcessingSteps();

  const createMeeting = async (
    title: string,
    audioBlob: Blob | null,
    audioFile: File | null,
    participants: MeetingCreationData['participants'],
    selectedParticipantIds: string[]
  ) => {
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
    resetSteps();

    let meetingId: string | null = null;

    try {
      // Step 1: Create meeting
      updateStepStatus('create', 'processing');
      setProgress(10);
      
      meetingId = await MeetingService.createMeeting(title, user.id);
      
      updateStepStatus('create', 'completed');
      setProgress(20);

      // Step 2: Upload and save audio if provided
      if (audioBlob || audioFile) {
        updateStepStatus('upload', 'processing');
        setProgress(25);

        const audioFileUrl = await AudioProcessingService.uploadAudio(audioBlob, audioFile);
        
        // Save audio URL immediately
        console.log('[UPLOAD] Saving audio URL to database...');
        await MeetingService.updateMeetingField(meetingId, 'audio_url', audioFileUrl);
        console.log('[UPLOAD] Audio URL saved successfully');
        
        updateStepStatus('upload', 'completed');
        setProgress(35);

        // Step 3: Transcribe audio
        updateStepStatus('transcribe', 'processing');
        setProgress(40);
        
        try {
          const participantCount = Math.max(selectedParticipantIds.length, 2);
          const transcript = await AudioProcessingService.transcribeAudio(
            audioFileUrl, 
            participantCount, 
            meetingId
          );
          
          updateStepStatus('transcribe', 'completed');
          setProgress(60);
          
          // Step 4: Process transcript with OpenAI
          updateStepStatus('process', 'processing');
          setProgress(70);
          
          const selectedParticipants = participants.filter(p => 
            selectedParticipantIds.includes(p.id)
          );

          try {
            const result = await AudioProcessingService.processTranscriptWithAI(
              transcript,
              selectedParticipants,
              meetingId
            );

            if (result.processedTranscript) {
              updateStepStatus('process', 'completed');
            } else {
              console.warn('[PROCESS] No processed transcript returned, keeping original');
              updateStepStatus('process', 'error');
            }

            if (result.summary) {
              updateStepStatus('summary', 'completed');
            } else {
              console.warn('[SUMMARY] No summary returned from OpenAI');
              updateStepStatus('summary', 'error');
            }
            
            setProgress(85);
          } catch (openaiError) {
            console.error('[PROCESS] OpenAI processing failed:', openaiError);
            updateStepStatus('process', 'error');
            updateStepStatus('summary', 'error');
            toast({
              title: "Erreur de traitement",
              description: "Le traitement OpenAI a échoué, transcript original conservé",
              variant: "destructive",
            });
          }
        } catch (transcriptionError) {
          console.error("[TRANSCRIBE] Transcription failed:", transcriptionError);
          updateStepStatus('transcribe', 'error');
          updateStepStatus('process', 'error');
          updateStepStatus('summary', 'error');
          toast({
            title: "Erreur de transcription",
            description: "La transcription a échoué, mais la réunion a été créée avec l'audio.",
            variant: "destructive",
          });
        }
      }

      // Step 5: Add participants
      updateStepStatus('save', 'processing');
      setProgress(90);

      await MeetingService.addParticipants(meetingId, selectedParticipantIds);

      updateStepStatus('save', 'completed');
      setProgress(100);

      console.log('[COMPLETE] Meeting creation completed successfully');

      toast({
        title: "Réunion créée",
        description: "Votre réunion a été créée avec succès",
      });

      // Navigate after a small delay
      setTimeout(() => {
        navigate(`/meetings/${meetingId}`);
      }, 500);

    } catch (error: any) {
      console.error("[ERROR] Erreur lors de la création de la réunion:", error);
      
      // If we created a meeting but failed later, still try to navigate to it
      if (meetingId) {
        console.log('[ERROR] Meeting was created but processing failed, navigating to meeting:', meetingId);
        toast({
          title: "Réunion créée partiellement",
          description: "La réunion a été créée mais certains traitements ont échoué",
          variant: "destructive",
        });
        setTimeout(() => {
          navigate(`/meetings/${meetingId}`);
        }, 1000);
      } else {
        toast({
          title: "Erreur de création de la réunion",
          description: error.message || "Veuillez réessayer",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    processingSteps,
    progress,
    createMeeting
  };
};
