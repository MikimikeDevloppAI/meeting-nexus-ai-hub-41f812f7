
import { CheckCircle2, Loader2, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ProcessingStep {
  id: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

interface ProcessingStepsProps {
  isSubmitting: boolean;
  processingSteps: ProcessingStep[];
  progress: number;
}

const stepDescriptions: Record<string, string> = {
  'create': 'Création de la réunion en base de données et ajout des participants',
  'upload': 'Téléchargement du fichier audio vers le stockage sécurisé',
  'transcribe': 'Transcription audio en texte avec AssemblyAI',
  'process': 'Nettoyage et amélioration du transcript avec OpenAI',
  'summary': 'Génération du résumé structuré par catégories',
  'save': 'Extraction des tâches et génération des recommandations IA'
};

export const ProcessingSteps = ({ isSubmitting, processingSteps, progress }: ProcessingStepsProps) => {
  if (!isSubmitting) return null;

  return (
    <div className="space-y-6 p-6 bg-blue-50 rounded-lg border">
      <div className="flex items-center space-x-2">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        <h3 className="font-medium text-blue-900">Traitement de votre réunion en cours...</h3>
      </div>
      
      <Progress value={progress} className="w-full h-2" />
      <div className="text-center text-sm text-blue-700 font-medium">
        {progress}% terminé
      </div>
      
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
          <li>• Extraction intelligente des tâches et attribution aux participants</li>
          <li>• Recommandations personnalisées pour cabinet d'ophtalmologie</li>
        </ul>
      </div>
    </div>
  );
};
