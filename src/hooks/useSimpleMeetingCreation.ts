
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { MeetingService } from "@/services/meetingService";
import { AudioProcessingService } from "@/services/audioProcessingService";
import { MeetingCreationData } from "@/types/meeting";
import { useMeetingStatus } from "./useMeetingStatus";

export const useSimpleMeetingCreation = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [hasRedirected, setHasRedirected] = useState(false);
  const isMountedRef = useRef(true);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { status: meetingStatus, startPolling, stopPolling, checkStatus } = useMeetingStatus(currentMeetingId);

  console.log('[useSimpleMeetingCreation] Hook initialized, current user:', user);

  // Effect to handle automatic redirection when processing is complete
  useEffect(() => {
    console.log('[REDIRECTION] Status check:', {
      isComplete: meetingStatus.isComplete,
      hasRedirected,
      currentMeetingId,
      progressPercentage: meetingStatus.progressPercentage,
      taskCount: meetingStatus.taskCount,
      recommendationCount: meetingStatus.recommendationCount
    });

    if (meetingStatus.isComplete && currentMeetingId && !hasRedirected && isMountedRef.current) {
      console.log('[REDIRECTION] 🎯 All conditions met for redirection!');
      console.log('[REDIRECTION] Final status:', {
        hasSummary: meetingStatus.hasSummary,
        hasCleanedTranscript: meetingStatus.hasCleanedTranscript,
        taskCount: meetingStatus.taskCount,
        recommendationCount: meetingStatus.recommendationCount,
        isComplete: meetingStatus.isComplete
      });

      setHasRedirected(true);
      setIsComplete(true);
      stopPolling();
      
      toast({
        title: "Réunion traitée avec succès",
        description: `Toutes les tâches (${meetingStatus.taskCount}) ont été analysées et les recommandations ont été générées.`,
      });

      console.log('[REDIRECTION] ✅ Redirecting to meeting:', currentMeetingId);
      navigate(`/meetings/${currentMeetingId}`);
    }
  }, [meetingStatus.isComplete, currentMeetingId, hasRedirected, navigate, toast, stopPolling, meetingStatus]);

  // Safety timeout to prevent infinite waiting
  useEffect(() => {
    if (isSubmitting && currentMeetingId && !hasRedirected) {
      console.log('[SAFETY] Setting up 10-minute safety timeout');
      
      redirectTimeoutRef.current = setTimeout(() => {
        if (!hasRedirected && isMountedRef.current) {
          console.log('[SAFETY] ⏰ 10-minute timeout reached, forcing redirection');
          setHasRedirected(true);
          setIsComplete(true);
          stopPolling();
          
          toast({
            title: "Réunion créée",
            description: "Le traitement continue en arrière-plan. Vous pouvez consulter votre réunion.",
          });
          
          navigate(`/meetings/${currentMeetingId}`);
        }
      }, 10 * 60 * 1000); // 10 minutes
    }

    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    };
  }, [isSubmitting, currentMeetingId, hasRedirected, navigate, toast, stopPolling]);

  const createMeeting = async (
    title: string,
    audioBlob: Blob | null,
    audioFile: File | null,
    participants: MeetingCreationData['participants'],
    selectedParticipantIds: string[]
  ) => {
    console.log('[useSimpleMeetingCreation] ========== STARTING MEETING CREATION ==========');
    console.log('[useSimpleMeetingCreation] Input received:', { 
      title: title?.trim() || 'EMPTY', 
      hasAudioBlob: !!audioBlob,
      hasAudioFile: !!audioFile,
      participantCount: selectedParticipantIds.length,
      userId: user?.id || 'NO USER'
    });
    
    if (!user?.id) {
      console.error('[useSimpleMeetingCreation] CRITICAL ERROR: No user ID found');
      toast({
        title: "Erreur d'authentification",
        description: "Vous devez être connecté pour créer une réunion",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    console.log('[useSimpleMeetingCreation] Setting isSubmitting to true');
    setIsSubmitting(true);
    setIsComplete(false);
    setHasRedirected(false);

    const hasAudio = !!(audioBlob || audioFile);
    let meetingId: string | null = null;

    try {
      // Step 1: Create meeting in database
      console.log('[CREATE] Creating meeting in database');
      meetingId = await MeetingService.createMeeting(title.trim(), user.id);
      
      if (!meetingId) {
        throw new Error('Meeting creation failed - no ID returned');
      }
      
      console.log('[CREATE] ✅ Meeting created:', meetingId);
      setCurrentMeetingId(meetingId);
      
      // Add participants
      if (selectedParticipantIds.length > 0) {
        console.log('[CREATE] Adding participants:', selectedParticipantIds);
        await MeetingService.addParticipants(meetingId, selectedParticipantIds);
        console.log('[CREATE] ✅ Participants added');
      }

      // Step 2: Process audio if provided
      if (hasAudio) {
        console.log('[AUDIO] Processing audio...');
        
        try {
          // Upload audio
          const audioFileUrl = await AudioProcessingService.uploadAudio(audioBlob, audioFile);
          console.log('[UPLOAD] ✅ Audio uploaded');
          
          // Save audio URL
          await AudioProcessingService.saveAudioUrl(meetingId, audioFileUrl);
          console.log('[UPLOAD] ✅ Audio URL saved');

          // Transcribe audio
          const participantCount = Math.max(selectedParticipantIds.length, 2);
          const transcript = await AudioProcessingService.transcribeAudio(
            audioFileUrl, 
            participantCount, 
            meetingId
          );
          
          console.log('[TRANSCRIBE] ✅ Transcription completed');
          
          // Start monitoring the processing status
          console.log('[MONITOR] 🔄 Starting status monitoring...');
          startPolling();

          // Start AI processing (runs in background)
          const selectedParticipants = participants.filter(p => 
            selectedParticipantIds.includes(p.id)
          );

          console.log('[PROCESS] Starting AI processing...');
          
          AudioProcessingService.processTranscriptWithAI(
            transcript,
            selectedParticipants,
            meetingId
          ).then(result => {
            console.log('[PROCESS] ✅ AI processing completed:', result);
          }).catch(error => {
            console.error('[PROCESS] ❌ AI processing error:', error);
          });

          console.log('[MONITOR] 🔄 Waiting for complete processing...');
          console.log('[MONITOR] Note: Redirection will happen automatically when all steps are complete');
          
        } catch (audioError) {
          console.error('[AUDIO] Audio processing failed:', audioError);
          // For audio processing errors, still redirect to show the meeting
          if (!hasRedirected && isMountedRef.current) {
            setHasRedirected(true);
            setIsComplete(true);
            stopPolling();
            
            toast({
              title: "Réunion créée",
              description: "La réunion a été créée mais le traitement audio a échoué",
            });
            
            navigate(`/meetings/${meetingId}`);
          }
        }
      } else {
        // No audio to process, redirect immediately
        console.log('[NO_AUDIO] No audio to process, redirecting immediately');
        if (!hasRedirected && isMountedRef.current) {
          setHasRedirected(true);
          setIsComplete(true);
          
          toast({
            title: "Réunion créée",
            description: "Votre réunion a été créée avec succès",
          });
          
          navigate(`/meetings/${meetingId}`);
        }
      }

    } catch (error: any) {
      console.error("[ERROR] Meeting creation error:", error);
      stopPolling();
      
      if (meetingId && !hasRedirected) {
        // Meeting was created, still redirect
        console.log('[ERROR] Meeting created, navigating despite errors');
        setHasRedirected(true);
        setIsComplete(true);
        toast({
          title: "Réunion créée",
          description: "La réunion a été créée avec succès",
        });
        navigate(`/meetings/${meetingId}`);
      } else if (!hasRedirected) {
        // Complete failure
        console.error('[ERROR] Complete failure - meeting not created');
        toast({
          title: "Erreur de création",
          description: error.message || "Veuillez réessayer",
          variant: "destructive",
        });
        
        setIsSubmitting(false);
        setIsComplete(false);
      }
    }
  };

  const resetMeetingCreation = () => {
    console.log('[useSimpleMeetingCreation] resetMeetingCreation called, isSubmitting:', isSubmitting);
    if (!isSubmitting) {
      setIsSubmitting(false);
      setIsComplete(false);
      setCurrentMeetingId(null);
      setHasRedirected(false);
      stopPolling();
      
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    }
  };

  const cleanupOnUnmount = () => {
    console.log('[useSimpleMeetingCreation] cleanupOnUnmount called');
    isMountedRef.current = false;
    stopPolling();
    
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
  };

  return {
    isSubmitting,
    isComplete,
    meetingStatus,
    createMeeting,
    resetMeetingCreation,
    cleanupOnUnmount
  };
};
