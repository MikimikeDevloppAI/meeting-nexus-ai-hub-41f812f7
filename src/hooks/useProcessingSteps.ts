
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
    setProcessingSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const simulateProcessingFlow = () => {
    console.log('[ProcessingSteps] Starting processing flow simulation');
    
    // Étapes à traiter après la transcription
    const postTranscriptSteps = ['clean', 'document', 'embeddings', 'summary', 'tasks', 'finalize'];
    
    // D'abord, mettre toutes les étapes suivantes en "processing"
    setProcessingSteps(prev => prev.map(step => 
      postTranscriptSteps.includes(step.id) ? { ...step, status: 'processing' } : step
    ));
    
    // Puis les compléter progressivement avec des délais
    postTranscriptSteps.forEach((stepId, index) => {
      setTimeout(() => {
        console.log(`[ProcessingSteps] Completing step: ${stepId}`);
        setProcessingSteps(prev => prev.map(step => 
          step.id === stepId ? { ...step, status: 'completed' } : step
        ));
      }, (index + 1) * 1000); // 1 seconde entre chaque étape
    });
  };

  const resetSteps = () => {
    setProcessingSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));
  };

  return {
    processingSteps,
    updateStepStatus,
    simulateProcessingFlow,
    resetSteps
  };
};
