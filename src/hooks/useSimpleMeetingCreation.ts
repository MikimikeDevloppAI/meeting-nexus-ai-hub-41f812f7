
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
  
  // Réactiver la redirection automatique UNIQUEMENT pour les réunions avec audio
  const { cleanup: cleanupAutoRedirect } = useAutoRedirectOnRecommendations(
    currentMeetingId,
    isSubmitting && currentMeetingId !== null // Actif seulement pendant le traitement d'une réunion
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
          console.log('[PROCESS] 🎯 Redirection automatique activée - sera déclenchée quand le traitement sera terminé');
          
          // Start AI processing without waiting (let it run in background)
          // La redirection sera automatique quand les recommendations seront créées
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
            description: "Votre réunion est créée. L'analyse IA continue en arrière-plan. Vous serez redirigé automatiquement.",
          });

          // Ne pas réinitialiser isSubmitting tout de suite - laisser la redirection automatique se faire
          console.log('[REDIRECT] ✅ Réunion créée avec audio, redirection automatique activée');
          
        } catch (audioError) {
          console.error('[AUDIO] Audio processing failed:', audioError);
          toast({
            title: "Réunion créée",
            description: "La réunion a été créée mais le traitement audio a échoué",
          });
          // Réinitialiser l'état car pas de redirection automatique
          setIsSubmitting(false);
          setCurrentMeetingId(null);
        }
      } else {
        // No audio to process - pas de redirection automatique
        console.log('[NO_AUDIO] No audio to process - pas de redirection automatique');
        toast({
          title: "Réunion créée",
          description: "Votre réunion a été créée avec succès",
        });
        // Réinitialiser l'état
        setIsSubmitting(false);
        setCurrentMeetingId(null);
      }

    } catch (error: any) {
      console.error("[ERROR] Meeting creation error:", error);
      
      if (meetingId) {
        // Meeting was created, show success
        console.log('[ERROR] Meeting created, showing success despite errors');
        toast({
          title: "Réunion créée",
          description: "La réunion a été créée avec succès",
        });
      } else {
        // Complete failure
        console.error('[ERROR] Complete failure - meeting not created');
        toast({
          title: "Erreur de création",
          description: error.message || "Veuillez réessayer",
          variant: "destructive",
        });
      }
      
      setIsSubmitting(false);
      setCurrentMeetingId(null);
    }
  };

  const resetMeetingCreation = () => {
    console.log('[useSimpleMeetingCreation] resetMeetingCreation called, isSubmitting:', isSubmitting);
    setIsSubmitting(false);
    setCurrentMeetingId(null);
    cleanupAutoRedirect();
    
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
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
    isComplete: false,
    meetingStatus: { isComplete: false },
    createMeeting,
    resetMeetingCreation,
    cleanupOnUnmount
  };
};
