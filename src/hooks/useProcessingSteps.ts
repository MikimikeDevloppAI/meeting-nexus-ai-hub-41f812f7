
import { useState } from "react";
import { ProcessingStep } from "@/types/meeting";

export const useProcessingSteps = () => {
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
    { id: 'create', title: 'Création de la réunion', status: 'pending' },
    { id: 'upload', title: 'Téléchargement de l\'audio', status: 'pending' },
    { id: 'transcribe', title: 'Transcription en cours', status: 'pending' },
    { id: 'process', title: 'Nettoyage du transcript', status: 'pending' },
    { id: 'summary', title: 'Génération du résumé', status: 'pending' },
    { id: 'save', title: 'Finalisation', status: 'pending' }
  ]);

  const updateStepStatus = (stepId: string, status: ProcessingStep['status']) => {
    setProcessingSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const resetSteps = () => {
    setProcessingSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));
  };

  return {
    processingSteps,
    updateStepStatus,
    resetSteps
  };
};
