
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, Loader2 } from "lucide-react";
import { MeetingStatus } from "@/hooks/useMeetingStatus";

interface SimpleLoadingScreenProps {
  isComplete: boolean;
  meetingStatus?: MeetingStatus;
  onViewMeeting?: () => void;
}

export const SimpleLoadingScreen = ({ 
  isComplete, 
  meetingStatus,
  onViewMeeting 
}: SimpleLoadingScreenProps) => {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".");
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const getStepStatus = (stepName: string) => {
    if (!meetingStatus) return 'pending';
    
    switch (stepName) {
      case 'summary':
        return meetingStatus.hasSummary ? 'complete' : 'pending';
      case 'transcript':
        return meetingStatus.hasCleanedTranscript ? 'complete' : 'pending';
      case 'tasks':
        return meetingStatus.taskCount > 0 ? 'complete' : 'pending';
      case 'recommendations':
        return meetingStatus.recommendationCount >= meetingStatus.taskCount && meetingStatus.taskCount > 0 ? 'complete' : 'pending';
      default:
        return 'pending';
    }
  };

  const StepIndicator = ({ label, status }: { label: string; status: 'complete' | 'pending' | 'current' }) => (
    <div className="flex items-center space-x-3 py-2">
      {status === 'complete' ? (
        <CheckCircle className="h-5 w-5 text-green-500" />
      ) : status === 'current' ? (
        <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
      ) : (
        <Clock className="h-5 w-5 text-gray-400" />
      )}
      <span className={`text-sm ${
        status === 'complete' ? 'text-green-700' : 
        status === 'current' ? 'text-blue-700' : 
        'text-gray-500'
      }`}>
        {label}
      </span>
    </div>
  );

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="w-full max-w-md p-6 text-center space-y-6">
        <div className="space-y-2">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <h2 className="text-xl font-semibold">
            {isComplete ? "Traitement terminé !" : "Traitement en cours"}
          </h2>
          <p className="text-muted-foreground">
            {meetingStatus?.currentStep || `Traitement de votre réunion${dots}`}
          </p>
        </div>

        {meetingStatus && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progression</span>
                <span>{meetingStatus.progressPercentage}%</span>
              </div>
              <Progress value={meetingStatus.progressPercentage} className="w-full" />
            </div>

            <div className="space-y-1 text-left">
              <StepIndicator 
                label="Analyse et résumé" 
                status={getStepStatus('summary')} 
              />
              <StepIndicator 
                label="Nettoyage du transcript" 
                status={getStepStatus('transcript')} 
              />
              <StepIndicator 
                label={`Création des tâches ${meetingStatus.taskCount > 0 ? `(${meetingStatus.taskCount})` : ''}`}
                status={getStepStatus('tasks')} 
              />
              <StepIndicator 
                label={`Génération des recommandations ${meetingStatus.recommendationCount > 0 ? `(${meetingStatus.recommendationCount}/${meetingStatus.taskCount})` : ''}`}
                status={getStepStatus('recommendations')} 
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          {meetingStatus?.progressPercentage && meetingStatus.progressPercentage > 25 && onViewMeeting && (
            <Button 
              variant="outline" 
              onClick={onViewMeeting}
              className="w-full"
            >
              Voir la réunion (traitement en cours)
            </Button>
          )}
          
          <p className="text-xs text-muted-foreground">
            {isComplete 
              ? "Redirection automatique..." 
              : "Ce processus peut prendre quelques minutes. Vous pouvez fermer cette page en toute sécurité."
            }
          </p>
        </div>
      </Card>
    </div>
  );
};
