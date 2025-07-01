
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

export const MeetingResults = ({ transcript, summary, tasks, meetingId }: MeetingResultsProps) => {
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
            <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap text-sm break-words overflow-wrap-anywhere">
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
              <ReactMarkdown className="text-sm break-words overflow-wrap-anywhere max-w-full prose prose-sm prose-blue max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                {summary}
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
