import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { MeetingService } from "@/services/meetingService";
import { AudioProcessingService } from "@/services/audioProcessingService";
import { MeetingCreationData } from "@/types/meeting";
import { supabase } from "@/integrations/supabase/client";

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

      // Step 2: Process audio if provided and listen for task completion
      if (hasAudio) {
        console.log('[AUDIO] Processing audio - Setting up task completion listener');
        
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
          
          // Set up Realtime listener for task completion BEFORE starting AI processing
          console.log('[REALTIME] 🔗 Setting up task completion listener for meeting:', meetingId);
          
          const taskCompletionPromise = new Promise<boolean>((resolve) => {
            let processedTasks = new Set<string>();
            let totalTasksFound = false;
            let expectedTaskCount = 0;
            
            // Setup Realtime subscription for todos table updates
            const channel = supabase
              .channel(`task-completion-${meetingId}`)
              .on(
                'postgres_changes',
                {
                  event: '*',
                  schema: 'public',
                  table: 'todos',
                  filter: `meeting_id=eq.${meetingId}`
                },
                async (payload) => {
                  console.log('[REALTIME] 📋 Task event detected:', {
                    event: payload.eventType,
                    taskId: payload.new?.id || payload.old?.id,
                    aiRecommendationGenerated: payload.new?.ai_recommendation_generated
                  });
                  
                  if (payload.eventType === 'INSERT') {
                    // Nouvelle tâche créée
                    expectedTaskCount++;
                    console.log('[REALTIME] ➕ Nouvelle tâche créée, total attendu:', expectedTaskCount);
                  } else if (payload.eventType === 'UPDATE' && payload.new?.ai_recommendation_generated === true) {
                    // Tâche traitée
                    const taskId = payload.new.id;
                    processedTasks.add(taskId);
                    console.log('[REALTIME] ✅ Tâche traitée:', taskId, `(${processedTasks.size}/${expectedTaskCount})`);
                    
                    // Vérifier si toutes les tâches sont traitées
                    if (totalTasksFound && processedTasks.size >= expectedTaskCount && expectedTaskCount > 0) {
                      console.log('[REALTIME] 🎯 Toutes les tâches sont traitées! Redirection dans 3 secondes...');
                      setTimeout(() => {
                        console.log('[REALTIME] ✅ Redirection après traitement complet des tâches');
                        channel.unsubscribe();
                        resolve(true);
                      }, 3000);
                    }
                  }
                }
              )
              .subscribe((status) => {
                console.log('[REALTIME] Subscription status:', status);
              });

            // Marquer que la phase de création des tâches est terminée après 10 secondes
            setTimeout(() => {
              totalTasksFound = true;
              console.log('[REALTIME] 📝 Phase de création des tâches terminée, tâches attendues:', expectedTaskCount);
              
              // Si aucune tâche créée, rediriger immédiatement
              if (expectedTaskCount === 0) {
                console.log('[REALTIME] ⚠️ Aucune tâche créée, redirection immédiate');
                channel.unsubscribe();
                resolve(false);
              }
              // Si toutes les tâches sont déjà traitées, rediriger
              else if (processedTasks.size >= expectedTaskCount) {
                console.log('[REALTIME] ✅ Toutes les tâches déjà traitées');
                channel.unsubscribe();
                resolve(true);
              }
            }, 10000);

            // Check if component unmounted
            const checkUnmounted = setInterval(() => {
              if (!isMountedRef.current) {
                console.log('[REALTIME] Component unmounted, cleaning up listener');
                clearInterval(checkUnmounted);
                channel.unsubscribe();
                resolve(false);
              }
            }, 1000);
          });

          // Start AI processing
          const selectedParticipants = participants.filter(p => 
            selectedParticipantIds.includes(p.id)
          );

          console.log('[PROCESS] Starting AI processing...');
          
          // Don't await this - let it run in background while we listen for task completion
          AudioProcessingService.processTranscriptWithAI(
            transcript,
            selectedParticipants,
            meetingId
          ).then(result => {
            console.log('[PROCESS] ✅ AI processing completed:', result);
          }).catch(error => {
            console.error('[PROCESS] ❌ AI processing error:', error);
          });

          // Wait for task completion to be detected (no timeout)
          console.log('[REALTIME] 🔄 Waiting for task completion...');
          const hasCompletedTasks = await taskCompletionPromise;
          
          if (!isMountedRef.current) {
            console.log('[REALTIME] Component unmounted during wait');
            return;
          }

          if (hasCompletedTasks) {
            console.log('[SUCCESS] ✅ Toutes les tâches ont été traitées');
          } else {
            console.log('[WARNING] ⚠️ Attente interrompue');
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

      // Redirection après traitement complet
      if (isMountedRef.current) {
        console.log('[SUCCESS] Setting isComplete to true');
        setIsComplete(true);
        
        // Message personnalisé
        let description = "Votre réunion a été créée avec succès";
        if (hasAudio) {
          description = "Votre réunion a été créée et toutes les tâches ont été traitées";
        }
        
        toast({
          title: "Réunion créée",
          description,
        });

        console.log('[SUCCESS] Redirection vers la réunion:', meetingId);
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
