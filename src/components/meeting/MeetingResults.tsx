
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock } from "lucide-react";
import { MeetingTodos } from "@/components/MeetingTodos";
import ReactMarkdown from "react-markdown";

interface MeetingResultsProps {
  transcript?: string;
  summary?: string;
  tasks?: any[];
  meetingId?: string;
}

// Fonction pour nettoyer le markdown superflu au début du résumé
const cleanSummaryMarkdown = (summary: string): string => {
  if (!summary) return summary;
  
  // Supprimer les titres markdown au début (# ## ### etc.)
  let cleaned = summary.replace(/^#+\s+.*$/gm, '');
  
  // Supprimer les lignes vides au début
  cleaned = cleaned.replace(/^\s*\n+/, '');
  
  // Supprimer les marqueurs de liste au début s'ils sont isolés
  cleaned = cleaned.replace(/^[-*+]\s*$/gm, '');
  
  // Nettoyer les espaces multiples
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
  
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
          <div className="prose prose-sm max-w-none">
            <div className="bg-blue-50 p-4 rounded-lg">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="text-sm break-words overflow-wrap-anywhere max-w-full mb-2">{children}</p>,
                  h1: ({ children }) => <h1 className="text-lg font-semibold break-words overflow-wrap-anywhere max-w-full mb-2">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-base font-semibold break-words overflow-wrap-anywhere max-w-full mb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-semibold break-words overflow-wrap-anywhere max-w-full mb-2">{children}</h3>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-2 break-words overflow-wrap-anywhere max-w-full">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 break-words overflow-wrap-anywhere max-w-full">{children}</ol>,
                  li: ({ children }) => <li className="break-words overflow-wrap-anywhere max-w-full">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold break-words overflow-wrap-anywhere">{children}</strong>,
                  em: ({ children }) => <em className="italic break-words overflow-wrap-anywhere">{children}</em>,
                }}
              >
                {cleanedSummary}
              </ReactMarkdown>
            </div>
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
