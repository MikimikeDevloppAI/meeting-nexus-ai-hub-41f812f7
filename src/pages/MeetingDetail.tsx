
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, FileText, CheckSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MeetingTodos } from "@/components/MeetingTodos";

interface Meeting {
  id: string;
  title: string;
  created_at: string;
  transcript: string | null;
  summary: string | null;
  audio_url: string | null;
  participants: { name: string; email: string }[];
}

export default function MeetingDetail() {
  const { id } = useParams();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      fetchMeeting(id);
    }
  }, [id]);

  const fetchMeeting = async (meetingId: string) => {
    try {
      const { data, error } = await supabase
        .from("meetings")
        .select(`
          id,
          title,
          created_at,
          transcript,
          summary,
          audio_url,
          meeting_participants(
            participants(name, email)
          )
        `)
        .eq("id", meetingId)
        .single();

      if (error) throw error;

      const meetingData = {
        ...data,
        participants: data.meeting_participants?.map((mp: any) => mp.participants) || []
      };

      setMeeting(meetingData);
    } catch (error: any) {
      console.error("Error fetching meeting:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les détails de la réunion",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Chargement...</div>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-500">Réunion non trouvée</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{meeting.title}</h1>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {new Date(meeting.created_at).toLocaleDateString("fr-FR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {meeting.participants.length} participant(s)
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Participants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {meeting.participants.map((participant, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="font-medium">{participant.name}</span>
                  <Badge variant="outline">{participant.email}</Badge>
                </div>
              ))}
              {meeting.participants.length === 0 && (
                <p className="text-gray-500">Aucun participant</p>
              )}
            </div>
          </CardContent>
        </Card>

        {meeting.audio_url && (
          <Card>
            <CardHeader>
              <CardTitle>Enregistrement audio</CardTitle>
            </CardHeader>
            <CardContent>
              <audio controls className="w-full">
                <source src={meeting.audio_url} type="audio/wav" />
                Votre navigateur ne supporte pas l'élément audio.
              </audio>
            </CardContent>
          </Card>
        )}
      </div>

      {meeting.summary && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Résumé de la réunion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: meeting.summary }}
            />
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Tâches extraites
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MeetingTodos meetingId={meeting.id} />
        </CardContent>
      </Card>

      {meeting.transcript && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Transcript de la réunion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
              {meeting.transcript}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
