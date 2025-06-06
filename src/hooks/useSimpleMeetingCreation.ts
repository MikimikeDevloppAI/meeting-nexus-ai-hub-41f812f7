
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

  console.log('[useSimpleMeetingCreation] Current user:', user);

  const createMeeting = async (
    title: string,
    audioBlob: Blob | null,
    audioFile: File | null,
    participants: MeetingCreationData['participants'],
    selectedParticipantIds: string[]
  ) => {
    console.log('[useSimpleMeetingCreation] ========== STARTING MEETING CREATION ==========');
    console.log('[useSimpleMeetingCreation] Input validation:', { 
      title: title?.trim() || 'EMPTY', 
      hasAudio: !!(audioBlob || audioFile), 
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
    if (!isMountedRef.current) return;
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
        await MeetingService.addParticipants(meetingId, selectedParticipantIds);
        console.log('[CREATE] ✅ Participants added');
      }

      // Step 2: Process audio if provided
      if (hasAudio) {
        console.log('[AUDIO] Processing audio');
        
        // Upload audio
        const audioFileUrl = await AudioProcessingService.uploadAudio(audioBlob, audioFile);
        console.log('[UPLOAD] ✅ Audio uploaded');
        
        if (!isMountedRef.current) return;
        
        // Save audio URL
        await AudioProcessingService.saveAudioUrl(meetingId, audioFileUrl);
        console.log('[UPLOAD] ✅ Audio URL saved');

        // Transcribe and process
        const participantCount = Math.max(selectedParticipantIds.length, 2);
        const transcript = await AudioProcessingService.transcribeAudio(
          audioFileUrl, 
          participantCount, 
          meetingId
        );
        
        console.log('[TRANSCRIBE] ✅ Transcription completed');
        
        // Process with AI
        const selectedParticipants = participants.filter(p => 
          selectedParticipantIds.includes(p.id)
        );

        await AudioProcessingService.processTranscriptWithAI(
          transcript,
          selectedParticipants,
          meetingId
        );

        console.log('[PROCESS] ✅ AI processing completed');
      }

      console.log('[SUCCESS] ========== MEETING CREATION COMPLETED ==========');

      // Mark as complete and redirect after short delay
      if (isMountedRef.current) {
        setIsComplete(true);
        
        toast({
          title: "Réunion créée",
          description: "Votre réunion a été créée avec succès",
        });

        // Redirect after showing completion state
        setTimeout(() => {
          if (isMountedRef.current && meetingId) {
            navigate(`/meetings/${meetingId}`);
          }
        }, 2000);
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
          setTimeout(() => {
            if (isMountedRef.current) {
              navigate(`/meetings/${meetingId}`);
            }
          }, 2000);
        }
      } else {
        // Complete failure
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
    if (!isSubmitting && isMountedRef.current) {
      setIsSubmitting(false);
      setIsComplete(false);
    }
  };

  const cleanupOnUnmount = () => {
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
