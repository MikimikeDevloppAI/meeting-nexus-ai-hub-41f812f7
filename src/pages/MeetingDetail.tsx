
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Calendar, FileAudio, User, Check, Clock } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface Meeting {
  id: string;
  title: string;
  created_at: string;
  audio_url: string | null;
  created_by: string;
}

interface MeetingResults {
  transcript: string | null;
  summary: string | null;
}

interface Participant {
  id: string;
  name: string;
  email: string;
}

interface Todo {
  id: string;
  description: string;
  assigned_to: string;
  status: string;
  created_at: string;
  participant: {
    name: string;
    email: string;
  } | null;
}

const MeetingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [meetingResults, setMeetingResults] = useState<MeetingResults | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchMeetingData = async () => {
      if (!id) return;

      try {
        // Fetch meeting details
        const { data: meetingData, error: meetingError } = await supabase
          .from("meetings")
          .select("*")
          .eq("id", id)
          .single();

        if (meetingError) throw meetingError;
        setMeeting(meetingData);

        // Fetch meeting results
        const { data: resultsData, error: resultsError } = await supabase
          .from("meeting_results")
          .select("transcript, summary")
          .eq("meeting_id", id)
          .single();

        if (resultsError && resultsError.code !== "PGRST116") {
          throw resultsError;
        }
        setMeetingResults(resultsData || { transcript: null, summary: null });

        // Fetch participants - Fixed the type issue here
        const { data: participantsData, error: participantsError } = await supabase
          .from("meeting_participants")
          .select(`
            participant_id,
            participants:participant_id (
              id, name, email
            )
          `)
          .eq("meeting_id", id);

        if (participantsError) throw participantsError;
        
        // Fix: Extract and format the participants data correctly
        const fetchedParticipants: Participant[] = participantsData
          .map(item => item.participants)
          .filter(Boolean) as Participant[];
          
        setParticipants(fetchedParticipants);

        // Fetch todos
        const { data: todosData, error: todosError } = await supabase
          .from("todos")
          .select(`
            *,
            participant:assigned_to (
              name, email
            )
          `)
          .eq("meeting_id", id);

        if (todosError) throw todosError;
        setTodos(todosData);

      } catch (error: any) {
        console.error("Error fetching meeting data:", error);
        toast({
          title: "Error loading meeting",
          description: error.message || "Please try again later",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchMeetingData();
  }, [id, toast]);

  const updateTodoStatus = async (todoId: string, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    
    try {
      const { error } = await supabase
        .from("todos")
        .update({ status: newStatus })
        .eq("id", todoId);
      
      if (error) throw error;
      
      // Update local state
      setTodos(todos.map(todo => 
        todo.id === todoId ? { ...todo, status: newStatus } : todo
      ));
      
      toast({
        title: `Task ${newStatus === "completed" ? "completed" : "reopened"}`,
        description: newStatus === "completed" 
          ? "The task has been marked as completed" 
          : "The task has been reopened",
      });
    } catch (error: any) {
      console.error("Error updating todo status:", error);
      toast({
        title: "Error updating task",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/meetings")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Meetings
          </Button>
          <Skeleton className="h-8 w-1/3 mb-2" />
          <Skeleton className="h-4 w-1/4" />
        </div>
        
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
            <TabsTrigger value="todos">To-dos</TabsTrigger>
            <TabsTrigger value="participants">Participants</TabsTrigger>
          </TabsList>
          
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-1/4 mb-2" />
              <Skeleton className="h-4 w-1/3" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        </Tabs>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-2">Meeting not found</h2>
        <p className="text-muted-foreground mb-4">
          The meeting you're looking for doesn't exist or has been removed.
        </p>
        <Button onClick={() => navigate("/meetings")}>
          Go back to Meetings
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/meetings")}
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Meetings
        </Button>
        <h1 className="text-2xl font-bold">{meeting?.title}</h1>
        <div className="flex items-center text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 mr-1" />
          {meeting && format(new Date(meeting.created_at), "MMMM d, yyyy 'at' h:mm a")}
        </div>
      </div>
      
      {meeting?.audio_url && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center mb-2">
              <FileAudio className="h-5 w-5 mr-2 text-primary" />
              <h3 className="font-medium">Meeting Audio</h3>
            </div>
            <audio controls src={meeting.audio_url} className="w-full" />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="todos">To-dos ({todos.length})</TabsTrigger>
          <TabsTrigger value="participants">Participants ({participants.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle>Meeting Summary</CardTitle>
              <CardDescription>
                Key points and decisions from the meeting
              </CardDescription>
            </CardHeader>
            <CardContent>
              {meetingResults?.summary ? (
                <div className="whitespace-pre-line">{meetingResults.summary}</div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No summary available for this meeting yet.</p>
                  {!meeting?.audio_url && (
                    <p className="mt-2 text-sm">
                      Upload an audio recording to generate a summary.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transcript">
          <Card>
            <CardHeader>
              <CardTitle>Full Transcript</CardTitle>
              <CardDescription>
                Complete transcript of the meeting audio
              </CardDescription>
            </CardHeader>
            <CardContent>
              {meetingResults?.transcript ? (
                <div className="whitespace-pre-line">{meetingResults.transcript}</div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No transcript available for this meeting yet.</p>
                  {!meeting?.audio_url && (
                    <p className="mt-2 text-sm">
                      Upload an audio recording to generate a transcript.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="todos">
          <Card>
            <CardHeader>
              <CardTitle>Action Items</CardTitle>
              <CardDescription>
                Tasks and action items from this meeting
              </CardDescription>
            </CardHeader>
            <CardContent>
              {todos.length > 0 ? (
                <div className="divide-y">
                  {todos.map((todo) => (
                    <div key={todo.id} className="py-4 flex items-start gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        className={`h-6 w-6 rounded-full ${
                          todo.status === "completed" 
                            ? "bg-primary text-primary-foreground" 
                            : "text-muted-foreground"
                        }`}
                        onClick={() => updateTodoStatus(todo.id, todo.status)}
                      >
                        <Check className="h-3 w-3" />
                        <span className="sr-only">
                          {todo.status === "completed" ? "Mark as incomplete" : "Mark as complete"}
                        </span>
                      </Button>
                      <div className="flex-1">
                        <p className={todo.status === "completed" ? "line-through text-muted-foreground" : ""}>
                          {todo.description}
                        </p>
                        <div className="mt-1 flex items-center text-xs text-muted-foreground">
                          <User className="h-3 w-3 mr-1" />
                          <span>
                            {todo.participant?.name || "Unassigned"}
                          </span>
                          <span className="mx-2">•</span>
                          <Clock className="h-3 w-3 mr-1" />
                          <span>
                            {format(new Date(todo.created_at), "MMM d")}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={todo.status === "completed" ? "outline" : "secondary"}
                        className="text-xs"
                      >
                        {todo.status === "completed" ? "Completed" : "Pending"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No action items for this meeting yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="participants">
          <Card>
            <CardHeader>
              <CardTitle>Participants</CardTitle>
              <CardDescription>
                People who attended this meeting
              </CardDescription>
            </CardHeader>
            <CardContent>
              {participants.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center p-3 border rounded-md"
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium">{participant.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {participant.email}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No participants were added to this meeting.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MeetingDetail;
