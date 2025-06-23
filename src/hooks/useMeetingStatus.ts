
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

  const checkMeetingStatus = async (): Promise<MeetingStatus | null> => {
    if (!meetingId) return null;

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
        return null;
      }

      // Count tasks
      const { count: taskCount, error: taskError } = await supabase
        .from('todos')
        .select('*', { count: 'exact', head: true })
        .eq('meeting_id', meetingId);

      if (taskError) {
        console.error('[MeetingStatus] Error counting tasks:', taskError);
        return null;
      }

      // First get todos for this meeting, then count recommendations
      const { data: todoIds, error: todoError } = await supabase
        .from('todos')
        .select('id')
        .eq('meeting_id', meetingId);

      if (todoError) {
        console.error('[MeetingStatus] Error fetching todo IDs:', todoError);
        return null;
      }

      let recommendationCount = 0;
      if (todoIds && todoIds.length > 0) {
        const todoIdList = todoIds.map(todo => todo.id);
        
        const { count: recCount, error: recError } = await supabase
          .from('todo_ai_recommendations')
          .select('*', { count: 'exact', head: true })
          .in('todo_id', todoIdList);

        if (recError) {
          console.error('[MeetingStatus] Error counting recommendations:', recError);
          return null;
        }

        recommendationCount = recCount || 0;
      }

      const hasSummary = !!meetingData?.summary;
      const hasCleanedTranscript = !!meetingData?.transcript;
      const tasksCreated = taskCount || 0;
      const recommendationsCreated = recommendationCount;

      // Calculate progress and determine completion
      let progressPercentage = 0;
      let currentStep = "Initialisation...";
      let isComplete = false;

      if (hasSummary && hasCleanedTranscript) {
        progressPercentage = 25;
        currentStep = "Analyse terminée, création des tâches...";
        
        if (tasksCreated > 0) {
          progressPercentage = 50;
          currentStep = `${tasksCreated} tâches créées, génération des recommandations...`;
          
          if (recommendationsCreated > 0) {
            progressPercentage = 75 + (recommendationsCreated / tasksCreated) * 25;
            currentStep = `Génération des recommandations (${recommendationsCreated}/${tasksCreated})...`;
            
            // Complete when ALL tasks have recommendations
            if (recommendationsCreated >= tasksCreated) {
              progressPercentage = 100;
              currentStep = "Traitement terminé !";
              isComplete = true;
            }
          }
        }
      } else {
        currentStep = "Transcription et analyse en cours...";
      }

      const newStatus: MeetingStatus = {
        hasSummary,
        hasCleanedTranscript,
        taskCount: tasksCreated,
        recommendationCount: recommendationsCreated,
        isComplete,
        progressPercentage: Math.round(progressPercentage),
        currentStep,
      };

      console.log('[MeetingStatus] Status calculated:', {
        ...newStatus,
        completionCheck: `${recommendationsCreated} >= ${tasksCreated} = ${isComplete}`
      });
      
      setStatus(newStatus);
      return newStatus;
    } catch (error) {
      console.error('[MeetingStatus] Error checking status:', error);
      return null;
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
      
      // Continue polling until complete (don't stop early)
      if (currentStatus?.isComplete) {
        console.log('[MeetingStatus] ✅ Processing fully complete, will stop polling after next check');
        // Don't stop immediately, let the useEffect in the creation hook handle the redirection
      }
    }, 3000);

    // Set up timeout after 15 minutes (increased from 5)
    timeoutRef.current = setTimeout(() => {
      console.log('[MeetingStatus] ⏰ Polling timeout reached (15 minutes)');
      stopPolling();
    }, 15 * 60 * 1000);
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
