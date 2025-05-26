
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { uploadAudioToAssemblyAI, requestTranscription, pollForTranscription } from "@/lib/assemblyai";

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

export const useMeetingCreation = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
    { id: 'upload', title: 'Téléchargement de l\'audio', status: 'pending' },
    { id: 'transcribe', title: 'Transcription en cours', status: 'pending' },
    { id: 'speakers', title: 'Détection des intervenants', status: 'pending' },
    { id: 'process', title: 'Nettoyage du transcript', status: 'pending' },
    { id: 'summary', title: 'Génération du résumé', status: 'pending' },
    { id: 'save', title: 'Sauvegarde de la réunion', status: 'pending' }
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const updateStepStatus = (stepId: string, status: ProcessingStep['status']) => {
    setProcessingSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const nextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, processingSteps.length - 1));
  };

  const uploadAudioToStorage = async (audioBlob: Blob | null, audioFile: File | null): Promise<string | null> => {
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

  const processTranscription = async (
    audioFileUrl: string, 
    meetingId: string, 
    participants: Participant[], 
    selectedParticipantIds: string[]
  ): Promise<{ transcript: string, summary: string | null }> => {
    try {
      updateStepStatus('transcribe', 'processing');
      setProgress(50);
      
      const uploadUrl = await uploadAudioToAssemblyAI(audioFileUrl);
      const participantCount = Math.max(selectedParticipantIds.length, 2);
      const transcriptId = await requestTranscription(uploadUrl, participantCount);
      
      updateStepStatus('transcribe', 'completed');
      updateStepStatus('speakers', 'processing');
      nextStep();
      setProgress(65);
      
      const result = await pollForTranscription(transcriptId);
      
      updateStepStatus('speakers', 'completed');
      updateStepStatus('process', 'processing');
      nextStep();
      setProgress(75);
      
      if (result.text) {
        console.log(`Original transcript from AssemblyAI: ${result.text.length} characters`);
        
        const selectedParticipants = participants.filter(p => 
          selectedParticipantIds.includes(p.id)
        );

        try {
          console.log('Sending transcript to OpenAI for processing and summary generation...');
          const { data: { processedTranscript, summary }, error } = await supabase.functions.invoke('process-transcript', {
            body: {
              transcript: result.text,
              participants: selectedParticipants,
              meetingId
            }
          });

          if (error) {
            console.error('Error processing transcript with OpenAI:', error);
            updateStepStatus('process', 'error');
            updateStepStatus('summary', 'error');
            toast({
              title: "Erreur de traitement",
              description: "Le traitement OpenAI a échoué, transcript original conservé",
              variant: "destructive",
            });
            return { transcript: result.text, summary: null };
          }

          console.log(`Processed transcript from OpenAI: ${processedTranscript?.length || 0} characters`);
          console.log(`Generated summary: ${summary?.length || 0} characters`);
          
          if (!processedTranscript || processedTranscript.length < result.text.length * 0.3) {
            console.warn('Processed transcript seems incomplete, using original');
            updateStepStatus('process', 'error');
            updateStepStatus('summary', 'error');
            toast({
              title: "Traitement incomplet",
              description: "Le transcript traité semble incomplet, transcript original conservé",
              variant: "destructive",
            });
            return { transcript: result.text, summary: null };
          }

          updateStepStatus('process', 'completed');
          updateStepStatus('summary', 'processing');
          nextStep();
          setProgress(85);

          updateStepStatus('summary', 'completed');
          nextStep();
          setProgress(90);
          
          return { transcript: processedTranscript || result.text, summary };
        } catch (openaiError) {
          console.error('OpenAI processing failed:', openaiError);
          updateStepStatus('process', 'error');
          updateStepStatus('summary', 'error');
          toast({
            title: "Erreur de traitement",
            description: "Le traitement OpenAI a échoué, transcript original conservé",
            variant: "destructive",
          });
          return { transcript: result.text, summary: null };
        }
      }
      
      return { transcript: result.text || "", summary: null };
    } catch (error) {
      const currentStepId = processingSteps[currentStep]?.id;
      if (currentStepId) {
        updateStepStatus(currentStepId, 'error');
      }
      throw error;
    }
  };

  const createMeeting = async (
    title: string,
    audioBlob: Blob | null,
    audioFile: File | null,
    participants: Participant[],
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
    setCurrentStep(0);
    
    setProcessingSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));

    try {
      let audioFileUrl = null;
      let transcript = null;
      let summary = null;

      updateStepStatus('save', 'processing');
      setProgress(10);

      const { data: meetingData, error: meetingError } = await supabase
        .from("meetings")
        .insert([
          {
            title,
            audio_url: null,
            created_by: user.id,
            transcript: null,
            summary: null
          },
        ])
        .select();

      if (meetingError) throw meetingError;
      
      if (!meetingData || meetingData.length === 0) {
        throw new Error("Échec de la création de la réunion");
      }

      const meetingId = meetingData[0].id;

      if (audioBlob || audioFile) {
        audioFileUrl = await uploadAudioToStorage(audioBlob, audioFile);
        
        if (audioFileUrl) {
          try {
            const result = await processTranscription(audioFileUrl, meetingId, participants, selectedParticipantIds);
            transcript = result.transcript;
            summary = result.summary;
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

      const { error: updateError } = await supabase
        .from("meetings")
        .update({
          audio_url: audioFileUrl,
          transcript,
          summary
        })
        .eq('id', meetingId);

      if (updateError) throw updateError;

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

      let successMessage = "Votre réunion a été créée avec succès";
      if (transcript && summary) {
        successMessage += " avec transcription et résumé";
      } else if (transcript) {
        successMessage += " avec transcription";
      }

      toast({
        title: "Réunion créée",
        description: successMessage,
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

  return {
    isSubmitting,
    processingSteps,
    progress,
    createMeeting
  };
};
