
import { useState, useRef } from "react";
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
  const isMountedRef = useRef(true);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { processingSteps, updateStepStatus, resetSteps } = useProcessingSteps();

  console.log('[useMeetingCreation] Current user:', user);

  // Reset function to reinitialize all states
  const resetMeetingCreation = () => {
    console.log('[useMeetingCreation] Resetting meeting creation state');
    if (!isMountedRef.current) return;
    setIsSubmitting(false);
    setProgress(0);
    resetSteps();
  };

  const createMeeting = async (
    title: string,
    audioBlob: Blob | null,
    audioFile: File | null,
    participants: MeetingCreationData['participants'],
    selectedParticipantIds: string[]
  ) => {
    console.log('[useMeetingCreation] Starting createMeeting with:', { title, hasAudio: !!(audioBlob || audioFile), participantCount: selectedParticipantIds.length });
    
    if (!title?.trim()) {
      console.error('[useMeetingCreation] No title provided');
      toast({
        title: "Information manquante",
        description: "Veuillez saisir un titre de réunion",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    if (!user) {
      console.error('[useMeetingCreation] No user found, redirecting to login');
      toast({
        title: "Erreur d'authentification",
        description: "Vous devez être connecté pour créer une réunion. Veuillez vous reconnecter.",
        variant: "destructive",
        duration: 5000,
      });
      navigate("/login");
      return;
    }

    console.log('[useMeetingCreation] Starting submission process - setting isSubmitting to true');
    if (!isMountedRef.current) return;
    
    // IMPORTANT: S'assurer que les états sont correctement initialisés
    setIsSubmitting(true);
    setProgress(5);
    resetSteps();

    // Petit délai pour s'assurer que l'UI se met à jour
    await new Promise(resolve => setTimeout(resolve, 100));

    let meetingId: string | null = null;

    try {
      // Step 1: Create meeting and add participants immediately
      console.log('[CREATE] Creating meeting...');
      if (!isMountedRef.current) return;
      updateStepStatus('create', 'processing');
      setProgress(15);
      
      meetingId = await MeetingService.createMeeting(title.trim(), user.id);
      console.log('[CREATE] Meeting created with ID:', meetingId);
      
      if (!meetingId) {
        throw new Error('Failed to create meeting - no ID returned');
      }
      
      // Add participants immediately after creating the meeting
      if (selectedParticipantIds.length > 0) {
        console.log('[CREATE] Adding participants to meeting:', selectedParticipantIds);
        await MeetingService.addParticipants(meetingId, selectedParticipantIds);
        console.log('[CREATE] Participants added successfully');
      }
      
      if (!isMountedRef.current) return;
      updateStepStatus('create', 'completed');
      setProgress(25);

      // Step 2: Upload and save audio if provided
      if (audioBlob || audioFile) {
        console.log('[UPLOAD] Starting audio upload...');
        if (!isMountedRef.current) return;
        updateStepStatus('upload', 'processing');
        setProgress(30);

        let audioFileUrl;
        try {
          audioFileUrl = await AudioProcessingService.uploadAudio(audioBlob, audioFile);
          console.log('[UPLOAD] Audio uploaded:', audioFileUrl);
          
          if (!isMountedRef.current) return;
          setProgress(35);
          
          // Save audio URL using dedicated method
          await AudioProcessingService.saveAudioUrl(meetingId, audioFileUrl);
          console.log('[UPLOAD] Audio URL saved to meeting');
          
          if (!isMountedRef.current) return;
          updateStepStatus('upload', 'completed');
          setProgress(40);
        } catch (uploadError: any) {
          console.error('[UPLOAD] Audio upload failed:', uploadError);
          if (!isMountedRef.current) return;
          updateStepStatus('upload', 'error');
          toast({
            title: "Erreur de téléchargement",
            description: uploadError.message || "Le téléchargement audio a échoué",
            variant: "destructive",
            duration: 10000,
          });
          // Don't throw error, continue with meeting creation without audio
          console.log('[UPLOAD] Continuing without audio after upload failure');
        }

        // Step 3: Transcribe audio (only if upload succeeded)
        if (audioFileUrl) {
          console.log('[TRANSCRIBE] Starting transcription...');
          if (!isMountedRef.current) return;
          updateStepStatus('transcribe', 'processing');
          setProgress(45);
          
          try {
            const participantCount = Math.max(selectedParticipantIds.length, 2);
            const transcript = await AudioProcessingService.transcribeAudio(
              audioFileUrl, 
              participantCount, 
              meetingId
            );
            
            console.log('[TRANSCRIBE] Transcription completed');
            if (!isMountedRef.current) return;
            updateStepStatus('transcribe', 'completed');
            setProgress(65);
            
            // Step 4: Process transcript with OpenAI (including tasks extraction)
            console.log('[PROCESS] Starting OpenAI processing...');
            if (!isMountedRef.current) return;
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

              if (!isMountedRef.current) return;

              if (result.processedTranscript) {
                updateStepStatus('process', 'completed');
                console.log('[PROCESS] Processed transcript saved successfully');
              } else {
                console.warn('[PROCESS] No processed transcript returned, keeping original');
                updateStepStatus('process', 'error');
              }

              if (result.summary) {
                updateStepStatus('summary', 'completed');
                console.log('[SUMMARY] Summary generated and saved successfully');
              } else {
                console.warn('[SUMMARY] No summary returned from OpenAI');
                updateStepStatus('summary', 'error');
              }

              if (result.tasks && result.tasks.length > 0) {
                console.log(`[TASKS] ${result.tasks.length} tasks extracted and saved successfully`);
                toast({
                  title: "Tâches extraites",
                  description: `${result.tasks.length} tâche(s) ont été automatiquement créées à partir de la réunion`,
                  duration: 5000,
                });
              }
              
              if (!isMountedRef.current) return;
              setProgress(85);
            } catch (openaiError: any) {
              console.error('[PROCESS] OpenAI processing failed:', openaiError);
              if (!isMountedRef.current) return;
              updateStepStatus('process', 'error');
              updateStepStatus('summary', 'error');
              toast({
                title: "Erreur de traitement",
                description: openaiError.message || "Le traitement OpenAI a échoué, transcript original conservé",
                variant: "destructive",
                duration: 10000,
              });
              // Continue to finalization even if OpenAI fails
            }
          } catch (transcriptionError: any) {
            console.error("[TRANSCRIBE] Transcription failed:", transcriptionError);
            if (!isMountedRef.current) return;
            updateStepStatus('transcribe', 'error');
            updateStepStatus('process', 'error');
            updateStepStatus('summary', 'error');
            toast({
              title: "Erreur de transcription",
              description: transcriptionError.message || "La transcription a échoué, mais la réunion a été créée avec l'audio.",
              variant: "destructive",
              duration: 10000,
            });
            // Continue to finalization even if transcription fails
          }
        }
      } else {
        // No audio provided - skip audio processing steps but mark them as completed
        console.log('[NO_AUDIO] No audio provided, skipping audio processing steps');
        if (!isMountedRef.current) return;
        updateStepStatus('upload', 'completed');
        updateStepStatus('transcribe', 'completed');
        updateStepStatus('process', 'completed');
        updateStepStatus('summary', 'completed');
        setProgress(85);
      }

      // Step 5: Finalize
      console.log('[SAVE] Finalizing...');
      if (!isMountedRef.current) return;
      updateStepStatus('save', 'processing');
      setProgress(90);

      // Small delay to show the finalization step
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!isMountedRef.current) return;
      updateStepStatus('save', 'completed');
      setProgress(100);

      console.log('[COMPLETE] Meeting creation completed successfully');

      toast({
        title: "Réunion créée",
        description: "Votre réunion a été créée avec succès",
        duration: 5000,
      });

      // Wait to show completion and add navigation message
      console.log('[NAVIGATION] Preparing navigation to meeting page...');
      
      // Navigate after sufficient delay to show completion
      setTimeout(() => {
        if (!isMountedRef.current) return;
        console.log('[NAVIGATION] Navigating to meeting:', meetingId);
        navigate(`/meetings/${meetingId}`);
      }, 2000); // 2 seconds delay to see completion

    } catch (error: any) {
      console.error("[ERROR] Erreur lors de la création de la réunion:", error);
      
      // Better error handling for authentication issues
      if (error.message?.includes('auth') || error.message?.includes('unauthorized') || error.message?.includes('JWT')) {
        console.error('[ERROR] Authentication error detected');
        toast({
          title: "Erreur d'authentification",
          description: "Votre session a expiré. Veuillez vous reconnecter.",
          variant: "destructive",
          duration: 10000,
        });
        if (isMountedRef.current) {
          setIsSubmitting(false);
        }
        navigate("/login");
        return;
      }
      
      // If we created a meeting but failed later, still try to navigate to it
      if (meetingId) {
        console.log('[ERROR] Meeting was created but processing failed, navigating to meeting:', meetingId);
        toast({
          title: "Réunion créée partiellement",
          description: error.message || "La réunion a été créée mais certains traitements ont échoué",
          variant: "destructive",
          duration: 10000,
        });
        setTimeout(() => {
          if (!isMountedRef.current) return;
          navigate(`/meetings/${meetingId}`);
        }, 2000);
      } else {
        // Complete failure - show error and reset after delay
        console.log('[ERROR] Complete failure, resetting form after delay');
        toast({
          title: "Erreur de création de la réunion",
          description: error.message || "Veuillez réessayer",
          variant: "destructive",
          duration: 10000,
        });
        
        // Mark all steps as error
        if (isMountedRef.current) {
          updateStepStatus('create', 'error');
          updateStepStatus('upload', 'error');
          updateStepStatus('transcribe', 'error');
          updateStepStatus('process', 'error');
          updateStepStatus('summary', 'error');
          updateStepStatus('save', 'error');
          setProgress(0);
          
          // Reset after showing error for a while
          setTimeout(() => {
            if (isMountedRef.current) {
              setIsSubmitting(false);
              resetSteps();
            }
          }, 5000);
        }
      }
    }
  };

  // Cleanup on unmount
  const cleanupOnUnmount = () => {
    isMountedRef.current = false;
  };

  return {
    isSubmitting,
    processingSteps,
    progress,
    createMeeting,
    resetMeetingCreation,
    cleanupOnUnmount
  };
};
