
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
  if (!summary) return summary;
  
  let cleaned = summary.trim();
  
  // Supprimer la première ligne si elle contient des backticks ou "markdown"
  const lines = cleaned.split('\n');
  if (lines.length > 0 && (lines[0].includes('`') || lines[0].toLowerCase().includes('markdown'))) {
    lines.shift(); // Enlever la première ligne
    cleaned = lines.join('\n');
  }
  
  // Supprimer les balises de fermeture à la fin
  cleaned = cleaned.replace(/\s*`{3,4}\s*$/i, '');
  
  return cleaned.trim();
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
              content={cleanedSummary.split('\n').slice(1).join('\n')} 
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
