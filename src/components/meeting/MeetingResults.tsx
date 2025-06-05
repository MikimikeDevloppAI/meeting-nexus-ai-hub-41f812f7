
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, User } from "lucide-react";

interface Task {
  description: string;
  assignedTo?: string;
  recommendation?: string;
}

interface MeetingResultsProps {
  transcript?: string;
  summary?: string;
  tasks?: Task[];
}

export const MeetingResults = ({ transcript, summary, tasks }: MeetingResultsProps) => {
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
            <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap text-sm">
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
              <div className="text-sm whitespace-pre-wrap">{summary}</div>
            </div>
          </div>
        ) : (
          <div className="text-gray-500 italic">
            En attente de la génération du résumé...
          </div>
        )}
      </Card>

      {/* Tasks Section */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          {tasks ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <Clock className="h-5 w-5 text-gray-400" />
          )}
          <h3 className="text-lg font-semibold">Tâches extraites</h3>
          {tasks && (
            <Badge variant="outline" className="text-green-700">
              {tasks.length} tâche(s)
            </Badge>
          )}
        </div>
        {tasks ? (
          tasks.length > 0 ? (
            <div className="space-y-4">
              {tasks.map((task, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{task.description}</p>
                      {task.assignedTo && (
                        <div className="flex items-center gap-1 mt-2">
                          <User className="h-3 w-3 text-gray-500" />
                          <span className="text-xs text-gray-600">
                            Assigné à: {task.assignedTo}
                          </span>
                        </div>
                      )}
                      {task.recommendation && task.recommendation !== "AUCUNE_RECOMMANDATION" && (
                        <div className="mt-3 bg-yellow-50 border-l-4 border-yellow-400 p-3">
                          <div className="flex items-start gap-2">
                            <span className="text-lg">💡</span>
                            <div>
                              <p className="text-sm font-medium text-yellow-800">
                                Conseil IA OphtaCare
                              </p>
                              <p className="text-xs text-yellow-700 mt-1">
                                {task.recommendation}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 italic">
              Aucune tâche extraite de cette réunion.
            </div>
          )
        ) : (
          <div className="text-gray-500 italic">
            En attente de l'extraction des tâches...
          </div>
        )}
      </Card>
    </div>
  );
};
