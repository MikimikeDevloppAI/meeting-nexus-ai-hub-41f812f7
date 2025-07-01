import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";

interface SimpleLoadingScreenProps {
  isComplete: boolean;
  meetingStatus?: any;
  onViewMeeting?: () => void;
}

export const SimpleLoadingScreen = ({ 
  isComplete, 
  meetingStatus,
  onViewMeeting 
}: SimpleLoadingScreenProps) => {
  const [dots, setDots] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".");
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressMessage = () => {
    if (elapsedSeconds < 30) {
      return "Création de la réunion et upload de l'audio...";
    } else if (elapsedSeconds < 120) {
      return "Transcription de l'audio en cours...";
    } else if (elapsedSeconds < 300) {
      return "Analyse IA et création des tâches...";
    } else {
      return "Finalisation du traitement...";
    }
  };

  return (
    <Card className="p-8">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">
            Traitement de votre réunion en cours{dots}
          </h3>
          <p className="text-muted-foreground">
            {getProgressMessage()}
          </p>
          <div className="text-sm text-muted-foreground">
            Temps écoulé: {formatTime(elapsedSeconds)}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Réunion créée
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${elapsedSeconds > 30 ? 'bg-green-500' : 'bg-gray-300 animate-pulse'}`}></div>
              Transcription audio
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${elapsedSeconds > 120 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              Analyse IA et création des tâches
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${isComplete ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              Redirection automatique
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Vous serez automatiquement redirigé vers votre réunion dès que les tâches seront créées.
            {elapsedSeconds > 300 && (
              <div className="mt-2 text-amber-600">
                Le traitement prend plus de temps que prévu. Cela peut arriver avec de longs enregistrements.
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
