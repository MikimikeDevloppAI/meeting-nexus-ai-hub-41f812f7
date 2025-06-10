
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, FileText } from "lucide-react";
import { MeetingTodos } from "@/components/MeetingTodos";
import { EditableContent } from "@/components/EditableContent";
import { SummaryChat } from "@/components/meeting/SummaryChat";
import { TodosChat } from "@/components/meeting/TodosChat";
import { useState } from "react";

interface Participant {
  id: string;
  name: string;
  email: string;
}

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const [summary, setSummary] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: meeting, isLoading, error, refetch } = useQuery({
    queryKey: ["meeting", id, refreshKey],
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

  const handleDataUpdate = () => {
    console.log('🔄 Déclenchement mise à jour des données');
    setRefreshKey(prev => prev + 1);
    refetch();
    
    // Ajouter une animation visuelle pour indiquer la mise à jour
    const elements = document.querySelectorAll('[data-updated]');
    elements.forEach(el => {
      el.classList.add('animate-pulse');
      setTimeout(() => {
        el.classList.remove('animate-pulse');
      }, 1000);
    });
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

  const currentParticipants = meeting.meeting_participants?.map(mp => mp.participants) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Meeting Header */}
      <Card data-updated>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {meeting.title}
          </CardTitle>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>{new Date(meeting.created_at).toLocaleDateString('fr-FR')}</span>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{currentParticipants.length} participant{currentParticipants.length > 1 ? 's' : ''}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Participants Display (Read-only) */}
            <div>
              <h3 className="font-medium mb-3">Participants</h3>
              {currentParticipants.length > 0 ? (
                <div className="border rounded-md divide-y">
                  {currentParticipants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center p-4"
                    >
                      <div className="ml-3 flex flex-col flex-1">
                        <span className="text-sm font-medium">
                          {participant.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {participant.email}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <p>Aucun participant</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary with Chat Above */}
      {summary && (
        <div className="space-y-4">
          {/* Chat Résumé au-dessus */}
          <SummaryChat meetingId={meeting.id} onSummaryUpdate={handleDataUpdate} />
          
          {/* Résumé */}
          <Card data-updated>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Résumé de la réunion
                <Badge variant="secondary" className="ml-auto text-xs">
                  Mis à jour automatiquement
                </Badge>
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
        </div>
      )}

      {/* Todos with Chat Above */}
      <div className="space-y-4">
        {/* Chat Todos au-dessus */}
        <TodosChat meetingId={meeting.id} onTodosUpdate={handleDataUpdate} />
        
        {/* Liste des Todos */}
        <div data-updated>
          <MeetingTodos meetingId={meeting.id} />
        </div>
      </div>

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
