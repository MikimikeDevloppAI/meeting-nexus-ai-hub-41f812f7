
import { Loader2, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";

interface SimpleLoadingScreenProps {
  isComplete: boolean;
}

export const SimpleLoadingScreen = ({ isComplete }: SimpleLoadingScreenProps) => {
  return (
    <div className="space-y-6 p-8 bg-blue-50 rounded-lg border">
      <div className="flex flex-col items-center space-y-6">
        {isComplete ? (
          <>
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <h3 className="text-xl font-semibold text-green-700">
              Traitement terminé !
            </h3>
            <p className="text-green-600 text-center">
              Redirection vers la page de la réunion...
            </p>
          </>
        ) : (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <h3 className="text-xl font-semibold text-blue-700">
              Traitement de votre réunion en cours...
            </h3>
            <div className="space-y-2 text-center">
              <p className="text-blue-600">Création de la réunion et traitement de l'audio</p>
              <p className="text-sm text-blue-500">Cela peut prendre quelques minutes...</p>
            </div>
          </>
        )}
      </div>

      <Card className="p-4 bg-white">
        <div className="text-sm text-gray-700">
          <p className="font-medium mb-2">🤖 Intelligence Artificielle en action :</p>
          <ul className="space-y-1 text-xs">
            <li>• Transcription automatique avec reconnaissance vocale</li>
            <li>• Nettoyage et amélioration du texte par OpenAI</li>
            <li>• Génération automatique de résumé structuré</li>
            <li>• Extraction intelligente des tâches et attribution</li>
            <li>• Création d'embeddings pour recherche sémantique</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};
