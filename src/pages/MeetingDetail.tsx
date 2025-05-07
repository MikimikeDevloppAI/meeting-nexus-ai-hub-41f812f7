
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle, Clock, Download, FileText, ListChecks, Users } from "lucide-react";

interface Participant {
  id: string;
  name: string;
  email: string;
}

interface Todo {
  id: string;
  description: string;
  status: string;
  assigned_to: string;
  participant?: {
    name: string;
  };
}

interface Meeting {
  id: string;
  title: string;
  created_at: string;
  audio_url: string;
}

interface MeetingResults {
  id: string;
  transcript: string;
  summary: string;
}

const MeetingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [results, setResults] = useState<MeetingResults | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMeetingDetails = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        // Fetch meeting details
        const { data: meetingData, error: meetingError } = await supabase
          .from("meetings")
          .select("*")
          .eq("id", id)
          .single();
        
        if (meetingError) throw meetingError;
        setMeeting(meetingData);

        // Fetch meeting results (transcript & summary)
        const { data: resultsData, error: resultsError } = await supabase
          .from("meeting_results")
          .select("*")
          .eq("meeting_id", id)
          .single();
          
        if (!resultsError) {
          setResults(resultsData);
        }

        // Fetch participants
        const { data: participantsData, error: participantsError } = await supabase
          .from("meeting_participants")
          .select(`
            participant_id,
            participants (
              id, name, email
            )
          `)
          .eq("meeting_id", id);
          
        if (participantsError) throw participantsError;
        
        // Extract participant objects from the nested structure
        const formattedParticipants: Participant[] = participantsData.map((item: any) => ({
          id: item.participants.id,
          name: item.participants.name,
          email: item.participants.email
        }));
        
        setParticipants(formattedParticipants);

        // Fetch todos
        const { data: todosData, error: todosError } = await supabase
          .from("todos")
          .select(`
            id, description, status, assigned_to,
            participants (
              name
            )
          `)
          .eq("meeting_id", id);
          
        if (!todosError && todosData) {
          setTodos(todosData);
        }

      } catch (error) {
        console.error("Erreur lors du chargement des détails de la réunion:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMeetingDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Détails de la réunion</h1>
          <p className="text-muted-foreground">Chargement des informations...</p>
        </div>
        <div className="space-y-4">
          <div className="animate-pulse h-12 w-3/4 bg-primary/10 rounded"></div>
          <div className="animate-pulse h-80 bg-primary/5 rounded"></div>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="animate-fade-in">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Réunion introuvable</h1>
          <p className="text-muted-foreground">La réunion demandée n'existe pas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{meeting.title}</h1>
        <p className="text-muted-foreground">
          {meeting.created_at ? format(new Date(meeting.created_at), "PPP", { locale: fr }) : "Date indisponible"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        {/* Stats Cards */}
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="flex items-center text-sm font-medium">
              <Users className="mr-2 h-4 w-4 text-primary" />
              Participants
            </CardTitle>
          </CardHeader>
          <CardContent className="py-1">
            <p className="text-2xl font-bold">{participants.length}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="flex items-center text-sm font-medium">
              <FileText className="mr-2 h-4 w-4 text-primary" />
              Transcription
            </CardTitle>
          </CardHeader>
          <CardContent className="py-1">
            <p className="text-2xl font-bold">{results?.transcript ? "Disponible" : "Indisponible"}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="flex items-center text-sm font-medium">
              <ListChecks className="mr-2 h-4 w-4 text-primary" />
              Tâches
            </CardTitle>
          </CardHeader>
          <CardContent className="py-1">
            <p className="text-2xl font-bold">{todos.length}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="flex items-center text-sm font-medium">
              <Clock className="mr-2 h-4 w-4 text-primary" />
              Statut
            </CardTitle>
          </CardHeader>
          <CardContent className="py-1">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
              <p className="text-sm font-medium">Terminée</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="summary" className="mb-6">
        <TabsList>
          <TabsTrigger value="summary">Résumé</TabsTrigger>
          <TabsTrigger value="transcript">Transcription</TabsTrigger>
          <TabsTrigger value="todos">Tâches</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
        </TabsList>
        
        <TabsContent value="summary" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Résumé de la réunion</CardTitle>
              <CardDescription>
                Résumé automatique des points clés de discussion
              </CardDescription>
            </CardHeader>
            <CardContent>
              {results?.summary ? (
                <p className="whitespace-pre-line">{results.summary}</p>
              ) : (
                <p className="text-muted-foreground">Aucun résumé disponible pour cette réunion.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="transcript" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Transcription</CardTitle>
                <CardDescription>
                  Transcription complète de l'enregistrement
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" className="h-8">
                <Download className="h-4 w-4 mr-2" />
                Exporter
              </Button>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto">
              {results?.transcript ? (
                <p className="whitespace-pre-line">{results.transcript}</p>
              ) : (
                <p className="text-muted-foreground">Aucune transcription disponible pour cette réunion.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="todos" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Tâches à effectuer</CardTitle>
              <CardDescription>
                Tâches assignées lors de cette réunion
              </CardDescription>
            </CardHeader>
            <CardContent>
              {todos.length > 0 ? (
                <div className="space-y-4">
                  {todos.map((todo) => (
                    <div key={todo.id} className="flex items-start space-x-4 p-3 border rounded-md">
                      <div className={`h-5 w-5 rounded-full ${todo.status === 'completed' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                      <div className="flex-1">
                        <p className="font-medium">{todo.description}</p>
                        <p className="text-sm text-muted-foreground">
                          Assigné à: {todo.participant?.name || "Non assigné"}
                        </p>
                      </div>
                      <div className="text-xs text-white px-2 py-1 rounded-full bg-primary">
                        {todo.status === 'completed' ? 'Terminé' : 'En cours'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Aucune tâche n'a été créée pour cette réunion.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="participants" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Participants</CardTitle>
              <CardDescription>
                Personnes présentes à cette réunion
              </CardDescription>
            </CardHeader>
            <CardContent>
              {participants.length > 0 ? (
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div key={participant.id} className="flex items-center justify-between p-3 border rounded-md">
                      <div>
                        <p className="font-medium">{participant.name}</p>
                        <p className="text-sm text-muted-foreground">{participant.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Aucun participant n'a été ajouté à cette réunion.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {meeting.audio_url && (
        <Card>
          <CardHeader>
            <CardTitle>Enregistrement de la réunion</CardTitle>
            <CardDescription>
              Enregistrement audio de cette réunion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <audio controls className="w-full">
              <source src={meeting.audio_url} type="audio/mpeg" />
              Votre navigateur ne prend pas en charge l'élément audio.
            </audio>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MeetingDetail;
