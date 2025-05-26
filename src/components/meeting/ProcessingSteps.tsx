
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

export const ProcessingSteps = ({ isSubmitting, processingSteps, progress }: ProcessingStepsProps) => {
  if (!isSubmitting) return null;

  return (
    <div className="space-y-4 p-4 bg-blue-50 rounded-lg border">
      <div className="flex items-center space-x-2">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        <h3 className="font-medium text-blue-900">Traitement en cours...</h3>
      </div>
      
      <Progress value={progress} className="w-full" />
      
      <div className="space-y-2">
        {processingSteps.map((step) => (
          <div key={step.id} className="flex items-center space-x-3">
            {step.status === 'completed' ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : step.status === 'processing' ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            ) : step.status === 'error' ? (
              <X className="h-4 w-4 text-red-600" />
            ) : (
              <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
            )}
            <span className={`text-sm ${
              step.status === 'completed' ? 'text-green-700' :
              step.status === 'processing' ? 'text-blue-700' :
              step.status === 'error' ? 'text-red-700' :
              'text-gray-500'
            }`}>
              {step.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
