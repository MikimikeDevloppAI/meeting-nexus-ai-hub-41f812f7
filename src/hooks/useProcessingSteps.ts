
import { useState } from "react";
import { ProcessingStep } from "@/types/meeting";

export const useProcessingSteps = () => {
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

  const updateStepStatus = (stepId: string, status: ProcessingStep['status']) => {
    console.log(`[ProcessingSteps] Updating step ${stepId} to status: ${status}`);
    setProcessingSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const resetSteps = () => {
    console.log('[ProcessingSteps] Resetting all steps to pending');
    setProcessingSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));
  };

  return {
    processingSteps,
    updateStepStatus,
    resetSteps
  };
};
