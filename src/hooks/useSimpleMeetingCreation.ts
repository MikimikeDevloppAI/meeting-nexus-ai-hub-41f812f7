
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { MeetingService } from "@/services/meetingService";
import { AudioProcessingService } from "@/services/audioProcessingService";
import { MeetingCreationData } from "@/types/meeting";
import { useAutoRedirectOnRecommendations } from "./useAutoRedirectOnRecommendations";

export const useSimpleMeetingCreation = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Use the new auto-redirect hook
  const { cleanup: cleanupAutoRedirect } = useAutoRedirectOnRecommendations(
    currentMeetingId,
    isSubmitting && !!currentMeetingId
  );

  console.log('[useSimpleMeetingCreation] Hook initialized, current user:', user);

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
          
          // Start AI processing (runs in background)
          const selectedParticipants = participants.filter(p => 
            selectedParticipantIds.includes(p.id)
          );

          console.log('[PROCESS] Starting AI processing in background...');
          console.log('[PROCESS] 🎯 Auto-redirect will trigger when recommendations are created');
          
          // Start AI processing without waiting (let it run in background)
          AudioProcessingService.processTranscriptWithAI(
            transcript,
            selectedParticipants,
            meetingId
          ).then(result => {
            console.log('[PROCESS] ✅ AI processing completed:', result);
          }).catch(error => {
            console.error('[PROCESS] ❌ AI processing error:', error);
          });

          toast({
            title: "Traitement en cours",
            description: "Votre réunion est créée. L'analyse IA est en cours, vous serez redirigé automatiquement.",
          });

          // Set up safety timeout (10 minutes) in case auto-redirect fails
          redirectTimeoutRef.current = setTimeout(() => {
            console.log('[SAFETY] ⏰ 10-minute timeout reached, forcing redirection');
            toast({
              title: "Réunion créée",
              description: "Le traitement continue en arrière-plan. Vous pouvez consulter votre réunion.",
            });
            navigate(`/meetings/${meetingId}`);
          }, 10 * 60 * 1000);
          
        } catch (audioError) {
          console.error('[AUDIO] Audio processing failed:', audioError);
          // For audio processing errors, still redirect to show the meeting
          toast({
            title: "Réunion créée",
            description: "La réunion a été créée mais le traitement audio a échoué",
          });
          navigate(`/meetings/${meetingId}`);
        }
      } else {
        // No audio to process, redirect immediately
        console.log('[NO_AUDIO] No audio to process, redirecting immediately');
        toast({
          title: "Réunion créée",
          description: "Votre réunion a été créée avec succès",
        });
        navigate(`/meetings/${meetingId}`);
      }

    } catch (error: any) {
      console.error("[ERROR] Meeting creation error:", error);
      
      if (meetingId) {
        // Meeting was created, still redirect
        console.log('[ERROR] Meeting created, navigating despite errors');
        toast({
          title: "Réunion créée",
          description: "La réunion a été créée avec succès",
        });
        navigate(`/meetings/${meetingId}`);
      } else {
        // Complete failure
        console.error('[ERROR] Complete failure - meeting not created');
        toast({
          title: "Erreur de création",
          description: error.message || "Veuillez réessayer",
          variant: "destructive",
        });
        
        setIsSubmitting(false);
        setCurrentMeetingId(null);
      }
    }
  };

  const resetMeetingCreation = () => {
    console.log('[useSimpleMeetingCreation] resetMeetingCreation called, isSubmitting:', isSubmitting);
    if (!isSubmitting) {
      setIsSubmitting(false);
      setCurrentMeetingId(null);
      cleanupAutoRedirect();
      
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    }
  };

  const cleanupOnUnmount = () => {
    console.log('[useSimpleMeetingCreation] cleanupOnUnmount called');
    isMountedRef.current = false;
    cleanupAutoRedirect();
    
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
  };

  return {
    isSubmitting,
    isComplete: false, // Simplified - no longer needed
    meetingStatus: { isComplete: false }, // Simplified - no longer needed
    createMeeting,
    resetMeetingCreation,
    cleanupOnUnmount
  };
};
