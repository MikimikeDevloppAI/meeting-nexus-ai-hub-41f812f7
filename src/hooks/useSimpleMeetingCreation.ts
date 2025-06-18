
import { useState, useRef } from "react";
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
  const isMountedRef = useRef(true);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { status: meetingStatus, startPolling, stopPolling, checkStatus } = useMeetingStatus(currentMeetingId);

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
      setCurrentMeetingId(meetingId);
      
      // Add participants
      if (selectedParticipantIds.length > 0) {
        console.log('[CREATE] Adding participants:', selectedParticipantIds);
        await MeetingService.addParticipants(meetingId, selectedParticipantIds);
        console.log('[CREATE] ✅ Participants added');
      }

      // Step 2: Process audio if provided and WAIT for complete processing
      if (hasAudio) {
        console.log('[AUDIO] Processing audio...');
        
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
          
          // Start monitoring the processing status
          console.log('[MONITOR] 🔄 Starting status monitoring...');
          startPolling();

          // Start AI processing (don't await - runs in background)
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

          // Wait for processing to complete using direct status checks
          console.log('[MONITOR] 🔄 Waiting for processing completion with direct status checks...');
          
          const waitForCompletion = new Promise<boolean>((resolve) => {
            let pollCount = 0;
            const maxPolls = 100; // 5 minutes at 3-second intervals
            
            const checkCompletion = async () => {
              if (!isMountedRef.current) {
                console.log('[MONITOR] Component unmounted during polling');
                resolve(false);
                return;
              }

              pollCount++;
              console.log(`[MONITOR] 🔍 Checking completion status (poll ${pollCount}/${maxPolls})...`);
              
              try {
                // Use direct status check instead of React state
                const currentStatus = await checkStatus();
                
                if (currentStatus) {
                  console.log(`[MONITOR] 📊 Current status:`, {
                    hasSummary: currentStatus.hasSummary,
                    hasCleanedTranscript: currentStatus.hasCleanedTranscript,
                    taskCount: currentStatus.taskCount,
                    recommendationCount: currentStatus.recommendationCount,
                    isComplete: currentStatus.isComplete,
                    progressPercentage: currentStatus.progressPercentage
                  });

                  if (currentStatus.isComplete) {
                    console.log('[MONITOR] ✅ Processing FULLY completed! All tasks have recommendations.');
                    resolve(true);
                    return;
                  }
                }
                
                if (pollCount >= maxPolls) {
                  console.log('[MONITOR] ⏰ Max polling attempts reached');
                  resolve(false);
                  return;
                }

                // Continue polling
                setTimeout(checkCompletion, 3000);
                
              } catch (error) {
                console.error('[MONITOR] ❌ Error checking status:', error);
                setTimeout(checkCompletion, 3000);
              }
            };

            // Start the polling
            checkCompletion();
          });

          const processingCompleted = await waitForCompletion;
          
          if (!isMountedRef.current) {
            console.log('[MONITOR] Component unmounted during wait');
            return;
          }

          if (processingCompleted) {
            console.log('[SUCCESS] ✅ All processing completed - ready for redirection');
          } else {
            console.log('[WARNING] ⚠️ Processing timeout - redirecting anyway');
          }
          
        } catch (audioError) {
          console.error('[AUDIO] Audio processing failed:', audioError);
          toast({
            title: "Réunion créée",
            description: "La réunion a été créée mais le traitement audio a échoué",
          });
        }
      }

      console.log('[SUCCESS] ========== MEETING CREATION COMPLETED ==========');

      // Final redirection after everything is complete
      if (isMountedRef.current) {
        console.log('[SUCCESS] All processing finished - setting completion state and redirecting');
        setIsComplete(true);
        stopPolling();
        
        let description = "Votre réunion a été créée avec succès";
        if (hasAudio) {
          description = "Votre réunion a été créée et toutes les tâches ont été traitées";
        }
        
        toast({
          title: "Réunion créée",
          description,
        });

        console.log('[SUCCESS] Redirection vers la réunion:', meetingId);
        
        // Small delay to ensure the UI shows completion
        setTimeout(() => {
          if (isMountedRef.current) {
            navigate(`/meetings/${meetingId}`);
          }
        }, 1000);
      }

    } catch (error: any) {
      console.error("[ERROR] Meeting creation error:", error);
      stopPolling();
      
      if (meetingId) {
        // Meeting was created, still redirect
        console.log('[ERROR] Meeting created, navigating despite errors');
        if (isMountedRef.current) {
          setIsComplete(true);
          toast({
            title: "Réunion créée",
            description: "La réunion a été créée avec succès",
          });
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
      setCurrentMeetingId(null);
      stopPolling();
    }
  };

  const cleanupOnUnmount = () => {
    console.log('[useSimpleMeetingCreation] cleanupOnUnmount called');
    isMountedRef.current = false;
    stopPolling();
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
