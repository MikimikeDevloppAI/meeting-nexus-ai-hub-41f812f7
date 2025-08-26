import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useRealisticProcessing } from "./useRealisticProcessing";
import { MeetingService } from "@/services/meetingService";
import { AudioProcessingService } from "@/services/audioProcessingService";
import { MeetingCreationData } from "@/types/meeting";
import { supabase } from "@/integrations/supabase/client";

export const useMeetingCreation = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMountedRef = useRef(true);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { 
    processingSteps, 
    resetSteps, 
    startRealisticProcessing, 
    cleanup 
  } = useRealisticProcessing();

  console.log('[useMeetingCreation] Current user:', user);

  // Reset function to reinitialize all states
  const resetMeetingCreation = () => {
    console.log('[useMeetingCreation] resetMeetingCreation called - current isSubmitting:', isSubmitting);
    
    // Don't reset if we're currently submitting
    if (isSubmitting) {
      console.log('[useMeetingCreation] PREVENTING reset - submission in progress');
      return;
    }
    
    console.log('[useMeetingCreation] Resetting meeting creation state');
    if (!isMountedRef.current) return;
    setIsSubmitting(false);
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
    
    // IMPORTANT: Set isSubmitting to true IMMEDIATELY to trigger UI changes
    if (!isMountedRef.current) return;
    console.log('[useMeetingCreation] Setting isSubmitting to true');
    setIsSubmitting(true);
    resetSteps();

    const hasAudio = !!(audioBlob || audioFile);
    let meetingId: string | null = null;

    // Start realistic processing animation with custom completion callback
    startRealisticProcessing(hasAudio, () => {
      // This callback will only be called when ALL processing is truly complete
      console.log('[useMeetingCreation] All processing steps completed, navigating...');
      if (meetingId && isMountedRef.current) {
        // Add a small delay to ensure UI shows completion
        setTimeout(() => {
          if (isMountedRef.current) {
            navigate(`/meetings/${meetingId}`);
          }
        }, 1000);
      }
    });

    try {
      // Step 1: Create meeting in database FIRST - this is critical
      console.log('[CREATE] ========== CREATING MEETING IN DATABASE ==========');
      
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

      // Step 2: Process audio only if provided and WAIT for complete processing
      if (hasAudio) {
        console.log('[AUDIO] ========== PROCESSING AUDIO - WAITING FOR COMPLETION ==========');
        
        try {
          // Upload audio
          console.log('[UPLOAD] Starting audio upload...');
          const audioFileUrl = await AudioProcessingService.uploadAudio(audioBlob, audioFile);
          console.log('[UPLOAD] ✅ Audio uploaded:', audioFileUrl);
          
          if (!isMountedRef.current) return;
          
          // Save audio URL to meeting
          await AudioProcessingService.saveAudioUrl(meetingId, audioFileUrl);
          console.log('[UPLOAD] ✅ Audio URL saved to meeting');

          // Transcribe audio
          console.log('[TRANSCRIBE] Starting transcription...');
          const participantCount = Math.max(selectedParticipantIds.length, 2);
          console.log(`[TRANSCRIBE] Participants selected: ${selectedParticipantIds.length}, sending ${participantCount} to AssemblyAI for speaker diarization`);
          const transcript = await AudioProcessingService.transcribeAudio(
            audioFileUrl, 
            participantCount, 
            meetingId
          );
          
          console.log('[TRANSCRIBE] ✅ Transcription completed');
          
          // Process transcript with OpenAI and WAIT for completion
          console.log('[PROCESS] Starting OpenAI processing and WAITING for completion...');
          const selectedParticipants = participants.filter(p => 
            selectedParticipantIds.includes(p.id)
          );

          const result = await AudioProcessingService.processTranscriptWithAI(
            transcript,
            selectedParticipants,
            meetingId
          );

          console.log('[PROCESS] ✅ OpenAI processing result:', result);
          
          if (result.tasks && result.tasks.length > 0) {
            console.log(`[TASKS] ✅ ${result.tasks.length} tasks extracted and saved successfully`);
            toast({
              title: "Tâches extraites",
              description: `${result.tasks.length} tâche(s) ont été automatiquement créées à partir de la réunion`,
              duration: 5000,
            });
          }

          // Wait additional time to ensure all database operations are complete
          console.log('[FINALIZE] Waiting for all database operations to complete...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (audioError: any) {
          console.error('[AUDIO] Audio processing failed:', audioError);
          // Don't throw, meeting was created successfully
          toast({
            title: "Réunion créée",
            description: "La réunion a été créée mais le traitement audio a échoué",
          });
        }
      } else {
        console.log('[NO_AUDIO] No audio provided, skipping audio processing');
      }

      console.log('[SUCCESS] ========== MEETING CREATION COMPLETED SUCCESSFULLY ==========');

      toast({
        title: "Réunion créée",
        description: hasAudio ? 
          "Votre réunion a été créée et le traitement est terminé" :
          "Votre réunion a été créée avec succès",
        duration: 5000,
      });

    } catch (error: any) {
      console.error("[ERROR] ========== CRITICAL ERROR IN MEETING CREATION ==========");
      console.error("[ERROR] Error details:", error);
      console.error("[ERROR] Meeting ID at time of error:", meetingId);
      
      // If we created a meeting but failed later, still navigate to it
      if (meetingId) {
        console.log('[ERROR] Meeting was created successfully, navigating despite later errors');
        toast({
          title: "Réunion créée",
          description: "La réunion a été créée avec succès",
          duration: 5000,
        });
      } else {
        // Complete failure - meeting not created
        console.log('[ERROR] Complete failure - meeting was not created');
        toast({
          title: "Erreur de création de la réunion",
          description: error.message || "Veuillez réessayer",
          variant: "destructive",
          duration: 10000,
        });
        
        // Reset after delay
        if (isMountedRef.current) {
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
    console.log('[useMeetingCreation] Cleanup on unmount');
    isMountedRef.current = false;
    cleanup();
  };

  return {
    isSubmitting,
    processingSteps,
    createMeeting,
    resetMeetingCreation,
    cleanupOnUnmount
  };
};
