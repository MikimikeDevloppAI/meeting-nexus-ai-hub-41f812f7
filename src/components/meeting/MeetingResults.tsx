
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock } from "lucide-react";
import { MeetingTodos } from "@/components/MeetingTodos";
import ReactMarkdown from "react-markdown";
import { FormattedText } from '@/utils/textFormatter';

interface MeetingResultsProps {
  transcript?: string;
  summary?: string;
  tasks?: any[];
  meetingId?: string;
}

// Fonction pour nettoyer le markdown superflu au début du résumé
const cleanSummaryMarkdown = (summary: string): string => {
  if (!summary || summary.length <= 14) return summary;
  
  // Solution simple : supprimer les 11 premiers caractères et les 3 derniers
  return summary.slice(11, -3).trim();
};

export const MeetingResults = ({ transcript, summary, tasks, meetingId }: MeetingResultsProps) => {
  const cleanedSummary = summary ? cleanSummaryMarkdown(summary) : summary;
  
  return (
    <div className="space-y-6">
      {/* Transcript Section */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          {transcript ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <Clock className="h-5 w-5 text-gray-400" />
          )}
          <h3 className="text-lg font-semibold">Transcript nettoyé</h3>
          {transcript && <Badge variant="outline" className="text-green-700">Prêt</Badge>}
        </div>
        {transcript ? (
          <div className="prose prose-sm max-w-none">
            <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap text-sm break-words overflow-wrap-anywhere max-w-full">
              {transcript}
            </div>
          </div>
        ) : (
          <div className="text-gray-500 italic">
            En attente de la transcription et du nettoyage...
          </div>
        )}
      </Card>

      {/* Summary Section */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          {summary ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <Clock className="h-5 w-5 text-gray-400" />
          )}
          <h3 className="text-lg font-semibold">Résumé de la réunion</h3>
          {summary && <Badge variant="outline" className="text-green-700">Prêt</Badge>}
        </div>
        {summary ? (
          <div className="bg-blue-50 p-4 rounded-lg w-full overflow-hidden">
            <FormattedText 
              content={(() => {
                const lines = cleanedSummary.split('\n');
                
                // Find first useful line (not markdown artifacts)
                const startIndex = lines.findIndex(line => {
                  const trimmed = line.trim();
                  return trimmed && 
                         !trimmed.includes('```') && 
                         !trimmed.toLowerCase().includes('markdown') &&
                         (trimmed.startsWith('Date') || trimmed.startsWith('**') || trimmed.length > 10);
                });
                
                return startIndex !== -1 ? lines.slice(startIndex).join('\n') : cleanedSummary;
              })()} 
              className="text-gray-700 w-full min-w-0"
            />
          </div>
        ) : (
          <div className="text-gray-500 italic">
            En attente de la génération du résumé...
          </div>
        )}
      </Card>

      {/* Tasks Section - Full functionality like Todos page */}
      {meetingId ? (
        <MeetingTodos meetingId={meetingId} />
      ) : (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-semibold">Tâches extraites</h3>
          </div>
          <div className="text-gray-500 italic">
            En attente de l'extraction des tâches...
          </div>
        </Card>
      )}
    </div>
  );
};
