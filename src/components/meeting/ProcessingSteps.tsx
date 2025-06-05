
import { CheckCircle2, Loader2, X, ArrowRight } from "lucide-react";

interface ProcessingStep {
  id: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

interface ProcessingStepsProps {
  isSubmitting: boolean;
  processingSteps: ProcessingStep[];
}

const stepDescriptions: Record<string, string> = {
  'create': 'Création de la réunion en base de données et ajout des participants',
  'upload': 'Téléchargement du fichier audio vers le stockage sécurisé',
  'transcribe': 'Transcription audio en texte avec AssemblyAI',
  'clean': 'Nettoyage et amélioration du transcript avec OpenAI',
  'document': 'Sauvegarde du transcript dans la base documentaire',
  'embeddings': 'Génération des embeddings vectoriels pour la recherche',
  'summary': 'Génération du résumé structuré par catégories',
  'tasks': 'Extraction des tâches et génération des recommandations IA',
  'finalize': 'Finalisation et préparation de la redirection'
};

export const ProcessingSteps = ({ isSubmitting, processingSteps }: ProcessingStepsProps) => {
  console.log('[ProcessingSteps] Rendering with:', { isSubmitting, stepsCount: processingSteps.length });

  // Check if all steps are completed
  const allCompleted = processingSteps.every(step => step.status === 'completed');
  const hasErrors = processingSteps.some(step => step.status === 'error');

  return (
    <div className="space-y-6 p-6 bg-blue-50 rounded-lg border">
      <div className="flex items-center space-x-2">
        {allCompleted ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : hasErrors ? (
          <X className="h-5 w-5 text-red-600" />
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        )}
        <h3 className="font-medium text-blue-900">
          {allCompleted ? "Traitement terminé !" : hasErrors ? "Traitement partiellement terminé" : "Traitement de votre réunion en cours..."}
        </h3>
      </div>

      {allCompleted && (
        <div className="flex items-center justify-center space-x-2 p-4 bg-green-50 rounded-lg border border-green-200">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <span className="text-green-700 font-medium">Redirection vers la page de la réunion...</span>
          <ArrowRight className="h-4 w-4 text-green-600" />
        </div>
      )}
      
      <div className="space-y-4">
        {processingSteps.map((step) => (
          <div key={step.id} className="space-y-2">
            <div className="flex items-center space-x-3">
              {step.status === 'completed' ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : step.status === 'processing' ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              ) : step.status === 'error' ? (
                <X className="h-5 w-5 text-red-600" />
              ) : (
                <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
              )}
              <span className={`font-medium ${
                step.status === 'completed' ? 'text-green-700' :
                step.status === 'processing' ? 'text-blue-700' :
                step.status === 'error' ? 'text-red-700' :
                'text-gray-500'
              }`}>
                {step.title}
              </span>
            </div>
            <div className={`ml-8 text-sm ${
              step.status === 'processing' ? 'text-blue-600' : 'text-gray-600'
            }`}>
              {stepDescriptions[step.id] || ''}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-4 bg-white rounded border text-sm text-gray-700">
        <p className="font-medium mb-2">🤖 Intelligence Artificielle en action :</p>
        <ul className="space-y-1 text-xs">
          <li>• Transcription automatique avec reconnaissance vocale avancée</li>
          <li>• Nettoyage et amélioration du texte par OpenAI GPT-4</li>
          <li>• Génération automatique de résumé structuré</li>
          <li>• Création d'embeddings vectoriels pour recherche sémantique</li>
          <li>• Extraction intelligente des tâches et attribution aux participants</li>
          <li>• Recommandations personnalisées pour cabinet d'ophtalmologie</li>
        </ul>
      </div>
    </div>
  );
};
