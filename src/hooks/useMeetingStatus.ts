
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MeetingStatus {
  hasSummary: boolean;
  hasCleanedTranscript: boolean;
  taskCount: number;
  recommendationCount: number;
  isComplete: boolean;
  progressPercentage: number;
  currentStep: string;
}

export const useMeetingStatus = (meetingId: string | null) => {
  const [status, setStatus] = useState<MeetingStatus>({
    hasSummary: false,
    hasCleanedTranscript: false,
    taskCount: 0,
    recommendationCount: 0,
    isComplete: false,
    progressPercentage: 0,
    currentStep: "Initialisation...",
  });
  
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkMeetingStatus = async () => {
    if (!meetingId) return;

    try {
      console.log('[MeetingStatus] Checking status for meeting:', meetingId);

      // Check meeting data (summary and transcript)
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('summary, transcript')
        .eq('id', meetingId)
        .single();

      if (meetingError) {
        console.error('[MeetingStatus] Error fetching meeting:', meetingError);
        return;
      }

      // Count tasks
      const { count: taskCount, error: taskError } = await supabase
        .from('todos')
        .select('*', { count: 'exact', head: true })
        .eq('meeting_id', meetingId);

      if (taskError) {
        console.error('[MeetingStatus] Error counting tasks:', taskError);
        return;
      }

      // Count recommendations
      const { count: recommendationCount, error: recError } = await supabase
        .from('todo_ai_recommendations')
        .select('todo_id', { count: 'exact', head: true })
        .in('todo_id', 
          supabase
            .from('todos')
            .select('id')
            .eq('meeting_id', meetingId)
        );

      if (recError) {
        console.error('[MeetingStatus] Error counting recommendations:', recError);
        return;
      }

      const hasSummary = !!meetingData?.summary;
      const hasCleanedTranscript = !!meetingData?.transcript;
      const tasksCreated = taskCount || 0;
      const recommendationsCreated = recommendationCount || 0;

      // Calculate progress
      let progressPercentage = 0;
      let currentStep = "Initialisation...";

      if (hasSummary && hasCleanedTranscript) {
        progressPercentage = 25;
        currentStep = "Analyse terminée, création des tâches...";
        
        if (tasksCreated > 0) {
          progressPercentage = 50;
          currentStep = `${tasksCreated} tâches créées, génération des recommandations...`;
          
          if (recommendationsCreated > 0) {
            progressPercentage = 75 + (recommendationsCreated / tasksCreated) * 25;
            currentStep = `Génération des recommandations (${recommendationsCreated}/${tasksCreated})...`;
            
            if (recommendationsCreated >= tasksCreated) {
              progressPercentage = 100;
              currentStep = "Traitement terminé !";
            }
          }
        }
      } else {
        currentStep = "Transcription et analyse en cours...";
      }

      const isComplete = hasSummary && hasCleanedTranscript && tasksCreated > 0 && recommendationsCreated >= tasksCreated;

      const newStatus: MeetingStatus = {
        hasSummary,
        hasCleanedTranscript,
        taskCount: tasksCreated,
        recommendationCount: recommendationsCreated,
        isComplete,
        progressPercentage: Math.round(progressPercentage),
        currentStep,
      };

      console.log('[MeetingStatus] Status updated:', newStatus);
      setStatus(newStatus);

      return newStatus;
    } catch (error) {
      console.error('[MeetingStatus] Error checking status:', error);
    }
  };

  const startPolling = () => {
    if (!meetingId || isPolling) return;
    
    console.log('[MeetingStatus] Starting polling for meeting:', meetingId);
    setIsPolling(true);

    // Initial check
    checkMeetingStatus();

    // Set up polling every 3 seconds
    intervalRef.current = setInterval(async () => {
      const currentStatus = await checkMeetingStatus();
      
      // Stop polling if complete
      if (currentStatus?.isComplete) {
        stopPolling();
      }
    }, 3000);

    // Set up timeout after 5 minutes
    timeoutRef.current = setTimeout(() => {
      console.log('[MeetingStatus] Polling timeout reached');
      stopPolling();
    }, 5 * 60 * 1000);
  };

  const stopPolling = () => {
    console.log('[MeetingStatus] Stopping polling');
    setIsPolling(false);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  return {
    status,
    isPolling,
    startPolling,
    stopPolling,
    checkStatus: checkMeetingStatus,
  };
};
