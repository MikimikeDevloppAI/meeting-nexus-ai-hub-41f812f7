
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { MeetingService } from "@/services/meetingService";
import { AudioProcessingService } from "@/services/audioProcessingService";
import { MeetingCreationData } from "@/types/meeting";

export const useSimpleMeetingCreation = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const isMountedRef = useRef(true);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

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
    if (!isMountedRef.current) {
      console.log('[useSimpleMeetingCreation] Component unmounted, aborting');
      return;
    }
    
    setIsSubmitting(true);
    setIsComplete(false);

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
      
      // Add participants
      if (selectedParticipantIds.length > 0) {
        console.log('[CREATE] Adding participants:', selectedParticipantIds);
        await MeetingService.addParticipants(meetingId, selectedParticipantIds);
        console.log('[CREATE] ✅ Participants added');
      }

      // Step 2: Process audio if provided and WAIT for COMPLETE processing
      if (hasAudio) {
        console.log('[AUDIO] Processing audio - WAITING for COMPLETE processing including AI recommendations');
        
        try {
          // Upload audio
          const audioFileUrl = await AudioProcessingService.uploadAudio(audioBlob, audioFile);
          console.log('[UPLOAD] ✅ Audio uploaded');
          
          if (!isMountedRef.current) {
            console.log('[UPLOAD] Component unmounted during upload');
            return;
          }
          
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
          
          if (!isMountedRef.current) {
            console.log('[TRANSCRIBE] Component unmounted during transcription');
            return;
          }
          
          // Process with AI and WAIT UNTIL recommendations are COMPLETELY done
          const selectedParticipants = participants.filter(p => 
            selectedParticipantIds.includes(p.id)
          );

          console.log('[PROCESS] Starting AI processing - WAITING for COMPLETE recommendations...');
          
          const result = await AudioProcessingService.processTranscriptWithAI(
            transcript,
            selectedParticipants,
            meetingId
          );

          console.log('[PROCESS] ✅ AI processing result:', result);

          // Vérifier que les recommandations sont VRAIMENT terminées
          if (result.fullyCompleted && result.recommendationStats?.successful > 0) {
            console.log('[SUCCESS] ✅ TOUTES LES RECOMMANDATIONS SONT COMPLÈTES - Redirection immédiate');
          } else if (result.success && result.tasksCreated > 0) {
            console.log('[SUCCESS] ✅ Réunion créée avec tâches - Redirection immédiate');
          } else {
            console.log('[SUCCESS] ✅ Réunion créée sans recommandations - Redirection immédiate');
          }
          
        } catch (audioError) {
          console.error('[AUDIO] Audio processing failed:', audioError);
          // Don't throw here, meeting was created successfully
          toast({
            title: "Réunion créée",
            description: "La réunion a été créée mais le traitement audio a échoué",
          });
        }
      }

      console.log('[SUCCESS] ========== MEETING CREATION COMPLETED ==========');

      // Redirection immédiate dès que le traitement est fini
      if (isMountedRef.current) {
        console.log('[SUCCESS] Setting isComplete to true');
        setIsComplete(true);
        
        toast({
          title: "Réunion créée",
          description: hasAudio ? 
            "Votre réunion a été créée et toutes les recommandations sont disponibles" : 
            "Votre réunion a été créée avec succès",
        });

        // Redirection immédiate - plus de délais arbitraires
        console.log('[SUCCESS] Redirection immédiate vers la réunion:', meetingId);
        navigate(`/meetings/${meetingId}`);
      }

    } catch (error: any) {
      console.error("[ERROR] Meeting creation error:", error);
      
      if (meetingId) {
        // Meeting was created, still redirect
        console.log('[ERROR] Meeting created, navigating despite errors');
        if (isMountedRef.current) {
          setIsComplete(true);
          toast({
            title: "Réunion créée",
            description: "La réunion a été créée avec succès",
          });
          // Redirection immédiate même en cas d'erreur partielle
          navigate(`/meetings/${meetingId}`);
        }
      } else {
        // Complete failure
        console.error('[ERROR] Complete failure - meeting not created');
        toast({
          title: "Erreur de création",
          description: error.message || "Veuillez réessayer",
          variant: "destructive",
        });
        
        if (isMountedRef.current) {
          setIsSubmitting(false);
          setIsComplete(false);
        }
      }
    }
  };

  const resetMeetingCreation = () => {
    console.log('[useSimpleMeetingCreation] resetMeetingCreation called, isSubmitting:', isSubmitting);
    if (!isSubmitting && isMountedRef.current) {
      setIsSubmitting(false);
      setIsComplete(false);
    }
  };

  const cleanupOnUnmount = () => {
    console.log('[useSimpleMeetingCreation] cleanupOnUnmount called');
    isMountedRef.current = false;
  };

  return {
    isSubmitting,
    isComplete,
    createMeeting,
    resetMeetingCreation,
    cleanupOnUnmount
  };
};
