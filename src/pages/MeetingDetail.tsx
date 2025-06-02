
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, FileText } from "lucide-react";
import { MeetingTodos } from "@/components/MeetingTodos";
import { EditableContent } from "@/components/EditableContent";
import { useState } from "react";

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const [summary, setSummary] = useState("");

  const { data: meeting, isLoading, error } = useQuery({
    queryKey: ["meeting", id],
    queryFn: async () => {
      if (!id) throw new Error("Meeting ID is required");
      
      const { data, error } = await supabase
        .from("meetings")
        .select(`
          *,
          meeting_participants(
            participants(id, name, email)
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      
      setSummary(data.summary || "");
      return data;
    },
    enabled: !!id,
  });

  const handleSummarySave = (newSummary: string) => {
    setSummary(newSummary);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Chargement de la réunion...</div>
        </div>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Réunion introuvable</h1>
          <p className="text-gray-600">
            La réunion demandée n'existe pas ou vous n'avez pas les permissions pour la voir.
          </p>
        </div>
      </div>
    );
  }

  const participants = meeting.meeting_participants?.map(mp => mp.participants) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Meeting Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {meeting.title}
          </CardTitle>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>{new Date(meeting.created_at).toLocaleDateString('fr-FR')}</span>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{participants.length} participant{participants.length > 1 ? 's' : ''}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Participants */}
            <div>
              <h3 className="font-medium mb-2">Participants</h3>
              <div className="flex flex-wrap gap-2">
                {participants.map((participant) => (
                  <Badge key={participant.id} variant="secondary">
                    {participant.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Résumé de la réunion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EditableContent
              content={summary}
              onSave={handleSummarySave}
              type="summary"
              id={meeting.id}
            />
          </CardContent>
        </Card>
      )}

      {/* Todos */}
      <Card>
        <CardContent className="p-6">
          <MeetingTodos meetingId={meeting.id} />
        </CardContent>
      </Card>

      {/* Transcript */}
      {meeting.transcript && (
        <Card>
          <CardHeader>
            <CardTitle>Transcript</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-sm text-gray-700 max-h-96 overflow-y-auto p-4 bg-gray-50 rounded">
              {meeting.transcript}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
