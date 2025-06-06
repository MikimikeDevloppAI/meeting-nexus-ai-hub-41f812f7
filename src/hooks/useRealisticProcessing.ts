
import { useState, useRef } from "react";
import { ProcessingStep } from "@/types/meeting";

export const useRealisticProcessing = () => {
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
    { id: 'create', title: 'Création de la réunion', status: 'pending' },
    { id: 'upload', title: 'Téléchargement de l\'audio', status: 'pending' },
    { id: 'transcribe', title: 'Transcription audio', status: 'pending' },
    { id: 'clean', title: 'Nettoyage du transcript', status: 'pending' },
    { id: 'document', title: 'Sauvegarde du document', status: 'pending' },
    { id: 'embeddings', title: 'Génération des embeddings', status: 'pending' },
    { id: 'summary', title: 'Génération du résumé', status: 'pending' },
    { id: 'tasks', title: 'Extraction des tâches', status: 'pending' },
    { id: 'finalize', title: 'Finalisation', status: 'pending' }
  ]);

  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  const updateStepStatus = (stepId: string, status: ProcessingStep['status']) => {
    console.log(`[RealisticProcessing] Updating step ${stepId} to status: ${status}`);
    setProcessingSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const resetSteps = () => {
    console.log('[RealisticProcessing] Resetting all steps');
    // Clear all existing timeouts
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current = [];
    
    setProcessingSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));
  };

  const startRealisticProcessing = (hasAudio: boolean, onComplete: () => void) => {
    console.log('[RealisticProcessing] Starting realistic processing simulation');
    
    // Clear any existing timeouts
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current = [];

    // Define realistic timing based on actual processing times
    const stepTimings = {
      create: { start: 100, duration: 800 },
      upload: hasAudio ? { start: 1000, duration: 1500 } : { start: 1000, duration: 200 },
      transcribe: hasAudio ? { start: 2600, duration: 8000 } : { start: 1300, duration: 200 },
      clean: hasAudio ? { start: 10800, duration: 12000 } : { start: 1600, duration: 200 },
      document: hasAudio ? { start: 23000, duration: 1500 } : { start: 1900, duration: 200 },
      embeddings: hasAudio ? { start: 24700, duration: 2000 } : { start: 2200, duration: 200 },
      summary: hasAudio ? { start: 27000, duration: 3000 } : { start: 2500, duration: 200 },
      tasks: hasAudio ? { start: 30300, duration: 4000 } : { start: 2800, duration: 200 },
      finalize: hasAudio ? { start: 34500, duration: 1000 } : { start: 3100, duration: 500 }
    };

    // Schedule all step updates
    Object.entries(stepTimings).forEach(([stepId, timing]) => {
      // Start processing
      const startTimeout = setTimeout(() => {
        updateStepStatus(stepId, 'processing');
      }, timing.start);
      timeoutsRef.current.push(startTimeout);

      // Complete processing
      const completeTimeout = setTimeout(() => {
        updateStepStatus(stepId, 'completed');
        
        // If this is the final step, call onComplete
        if (stepId === 'finalize') {
          setTimeout(() => {
            onComplete();
          }, 500);
        }
      }, timing.start + timing.duration);
      timeoutsRef.current.push(completeTimeout);
    });
  };

  const cleanup = () => {
    console.log('[RealisticProcessing] Cleaning up timeouts');
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current = [];
  };

  return {
    processingSteps,
    updateStepStatus,
    resetSteps,
    startRealisticProcessing,
    cleanup
  };
};
