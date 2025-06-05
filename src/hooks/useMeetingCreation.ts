
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
    console.log('[useMeetingCreation] ========== STARTING MEETING CREATION ==========');
    console.log('[useMeetingCreation] Input validation:', { 
      title: title?.trim() || 'EMPTY', 
      hasAudio: !!(audioBlob || audioFile), 
      participantCount: selectedParticipantIds.length,
      userId: user?.id || 'NO USER'
    });
    
    // Critical validation with explicit error handling
    if (!title?.trim()) {
      console.error('[useMeetingCreation] CRITICAL ERROR: No title provided');
      toast({
        title: "Information manquante",
        description: "Veuillez saisir un titre de réunion",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    if (!user?.id) {
      console.error('[useMeetingCreation] CRITICAL ERROR: No user ID found');
      toast({
        title: "Erreur d'authentification",
        description: "Vous devez être connecté pour créer une réunion. Veuillez vous reconnecter.",
        variant: "destructive",
        duration: 5000,
      });
      navigate("/login");
      return;
    }

    console.log('[useMeetingCreation] ========== VALIDATION PASSED - STARTING PROCESS ==========');
    
    // Initialize states immediately
    if (!isMountedRef.current) return;
    setIsSubmitting(true);
    setProgress(5);
    resetSteps();

    // Small delay to ensure UI updates
    await new Promise(resolve => setTimeout(resolve, 100));

    let meetingId: string | null = null;

    try {
      // Step 1: Create meeting in database FIRST - this is critical
      console.log('[CREATE] ========== CREATING MEETING IN DATABASE ==========');
      if (!isMountedRef.current) return;
      updateStepStatus('create', 'processing');
      setProgress(15);
      
      // CRITICAL: Create meeting and verify it was created
      meetingId = await MeetingService.createMeeting(title.trim(), user.id);
      console.log('[CREATE] Meeting creation result:', meetingId);
      
      if (!meetingId) {
        throw new Error('CRITICAL: Meeting creation failed - no ID returned from database');
      }
      
      // Verify meeting was actually created by trying to fetch it
      console.log('[CREATE] Verifying meeting was created in database...');
      const { data: verifyMeeting, error: verifyError } = await supabase
        .from('meetings')
        .select('id, title, created_by')
        .eq('id', meetingId)
        .single();
      
      if (verifyError || !verifyMeeting) {
        throw new Error(`CRITICAL: Meeting verification failed - meeting not found in database: ${verifyError?.message}`);
      }
      
      console.log('[CREATE] ✅ Meeting successfully created and verified:', verifyMeeting);
      
      // Add participants immediately after creating the meeting
      if (selectedParticipantIds.length > 0) {
        console.log('[CREATE] Adding participants to meeting:', selectedParticipantIds);
        await MeetingService.addParticipants(meetingId, selectedParticipantIds);
        console.log('[CREATE] ✅ Participants added successfully');
      } else {
        console.log('[CREATE] No participants to add');
      }
      
      if (!isMountedRef.current) return;
      updateStepStatus('create', 'completed');
      setProgress(30);

      // Step 2: Process audio only if provided
      if (audioBlob || audioFile) {
        console.log('[AUDIO] ========== PROCESSING AUDIO ==========');
        
        // Upload audio
        console.log('[UPLOAD] Starting audio upload...');
        if (!isMountedRef.current) return;
        updateStepStatus('upload', 'processing');
        setProgress(35);

        try {
          const audioFileUrl = await AudioProcessingService.uploadAudio(audioBlob, audioFile);
          console.log('[UPLOAD] ✅ Audio uploaded:', audioFileUrl);
          
          if (!isMountedRef.current) return;
          setProgress(40);
          
          // Save audio URL to meeting
          await AudioProcessingService.saveAudioUrl(meetingId, audioFileUrl);
          console.log('[UPLOAD] ✅ Audio URL saved to meeting');
          
          if (!isMountedRef.current) return;
          updateStepStatus('upload', 'completed');
          setProgress(45);

          // Transcribe audio
          console.log('[TRANSCRIBE] Starting transcription...');
          if (!isMountedRef.current) return;
          updateStepStatus('transcribe', 'processing');
          setProgress(50);
          
          try {
            const participantCount = Math.max(selectedParticipantIds.length, 2);
            const transcript = await AudioProcessingService.transcribeAudio(
              audioFileUrl, 
              participantCount, 
              meetingId
            );
            
            console.log('[TRANSCRIBE] ✅ Transcription completed');
            if (!isMountedRef.current) return;
            updateStepStatus('transcribe', 'completed');
            setProgress(65);
            
            // Process transcript with OpenAI
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
                console.log('[PROCESS] ✅ Processed transcript saved successfully');
              }

              if (result.summary) {
                updateStepStatus('summary', 'completed');
                console.log('[SUMMARY] ✅ Summary generated and saved successfully');
              }

              if (result.tasks && result.tasks.length > 0) {
                console.log(`[TASKS] ✅ ${result.tasks.length} tasks extracted and saved successfully`);
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
                description: "Le traitement OpenAI a échoué, mais la réunion et la transcription ont été sauvegardées",
                variant: "destructive",
                duration: 8000,
              });
            }
          } catch (transcriptionError: any) {
            console.error("[TRANSCRIBE] Transcription failed:", transcriptionError);
            if (!isMountedRef.current) return;
            updateStepStatus('transcribe', 'error');
            updateStepStatus('process', 'error');
            updateStepStatus('summary', 'error');
            toast({
              title: "Erreur de transcription",
              description: "La transcription a échoué, mais la réunion a été créée avec l'audio",
              variant: "destructive",
              duration: 8000,
            });
          }
        } catch (uploadError: any) {
          console.error('[UPLOAD] Audio upload failed:', uploadError);
          if (!isMountedRef.current) return;
          updateStepStatus('upload', 'error');
          updateStepStatus('transcribe', 'error');
          updateStepStatus('process', 'error');
          updateStepStatus('summary', 'error');
          toast({
            title: "Erreur de téléchargement",
            description: "Le téléchargement audio a échoué, mais la réunion a été créée",
            variant: "destructive",
            duration: 8000,
          });
        }
      } else {
        // No audio provided - mark audio steps as completed
        console.log('[NO_AUDIO] No audio provided, skipping audio processing');
        if (!isMountedRef.current) return;
        updateStepStatus('upload', 'completed');
        updateStepStatus('transcribe', 'completed');
        updateStepStatus('process', 'completed');
        updateStepStatus('summary', 'completed');
        setProgress(85);
      }

      // Step 3: Finalize
      console.log('[FINALIZE] ========== FINALIZING MEETING CREATION ==========');
      if (!isMountedRef.current) return;
      updateStepStatus('save', 'processing');
      setProgress(90);

      // Small delay to show the finalization step
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!isMountedRef.current) return;
      updateStepStatus('save', 'completed');
      setProgress(100);

      console.log('[SUCCESS] ========== MEETING CREATION COMPLETED SUCCESSFULLY ==========');

      toast({
        title: "Réunion créée",
        description: "Votre réunion a été créée avec succès",
        duration: 5000,
      });

      // Navigate after showing completion
      console.log('[NAVIGATION] Preparing navigation to meeting page...');
      setTimeout(() => {
        if (!isMountedRef.current) return;
        console.log('[NAVIGATION] Navigating to meeting:', meetingId);
        navigate(`/meetings/${meetingId}`);
      }, 2000);

    } catch (error: any) {
      console.error("[ERROR] ========== CRITICAL ERROR IN MEETING CREATION ==========");
      console.error("[ERROR] Error details:", error);
      console.error("[ERROR] Meeting ID at time of error:", meetingId);
      
      // If we created a meeting but failed later, still navigate to it
      if (meetingId) {
        console.log('[ERROR] Meeting was created successfully, navigating despite later errors');
        toast({
          title: "Réunion créée partiellement",
          description: "La réunion a été créée mais certains traitements ont échoué",
          variant: "destructive",
          duration: 8000,
        });
        setTimeout(() => {
          if (!isMountedRef.current) return;
          navigate(`/meetings/${meetingId}`);
        }, 2000);
      } else {
        // Complete failure - meeting not created
        console.log('[ERROR] Complete failure - meeting was not created');
        toast({
          title: "Erreur de création de la réunion",
          description: error.message || "Veuillez réessayer",
          variant: "destructive",
          duration: 10000,
        });
        
        // Mark all steps as error and reset after delay
        if (isMountedRef.current) {
          updateStepStatus('create', 'error');
          updateStepStatus('upload', 'error');
          updateStepStatus('transcribe', 'error');
          updateStepStatus('process', 'error');
          updateStepStatus('summary', 'error');
          updateStepStatus('save', 'error');
          setProgress(0);
          
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
