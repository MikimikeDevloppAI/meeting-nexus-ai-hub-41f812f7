
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, FileText } from "lucide-react";
import { MeetingTodos } from "@/components/MeetingTodos";
import { EditableContent } from "@/components/EditableContent";
import { ParticipantsSection } from "@/components/meeting/ParticipantsSection";
import { NewParticipantDialog } from "@/components/meeting/NewParticipantDialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface Participant {
  id: string;
  name: string;
  email: string;
}

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const [summary, setSummary] = useState("");
  const [isNewParticipantDialogOpen, setIsNewParticipantDialogOpen] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const { toast } = useToast();

  const { data: meeting, isLoading, error, refetch } = useQuery({
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
      
      // Set current participants
      const currentParticipants = data.meeting_participants?.map(mp => mp.participants) || [];
      setSelectedParticipantIds(currentParticipants.map(p => p.id));
      
      return data;
    },
    enabled: !!id,
  });

  // Fetch all participants for the dropdown
  const { data: allParticipants } = useQuery({
    queryKey: ["participants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as Participant[];
    },
  });

  const handleSummarySave = (newSummary: string) => {
    setSummary(newSummary);
  };

  const handleToggleParticipant = async (participantId: string) => {
    if (!id) return;

    const isCurrentlySelected = selectedParticipantIds.includes(participantId);
    
    try {
      if (isCurrentlySelected) {
        // Remove participant
        const { error } = await supabase
          .from("meeting_participants")
          .delete()
          .eq("meeting_id", id)
          .eq("participant_id", participantId);

        if (error) throw error;

        setSelectedParticipantIds(prev => prev.filter(id => id !== participantId));
        toast({
          title: "Participant retiré",
          description: "Le participant a été retiré de la réunion",
        });
      } else {
        // Add participant
        const { error } = await supabase
          .from("meeting_participants")
          .insert({
            meeting_id: id,
            participant_id: participantId,
          });

        if (error) throw error;

        setSelectedParticipantIds(prev => [...prev, participantId]);
        toast({
          title: "Participant ajouté",
          description: "Le participant a été ajouté à la réunion",
        });
      }
      
      // Refetch meeting data to update the display
      refetch();
    } catch (error: any) {
      console.error("Error updating participant:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de modifier le participant",
        variant: "destructive",
      });
    }
  };

  const handleParticipantAdded = (newParticipant: Participant) => {
    if (allParticipants) {
      // The participant will be added to the global list via refetch
      refetch();
    }
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
              <span>{currentParticipants.length} participant{currentParticipants.length > 1 ? 's' : ''}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Participants Management */}
            <div>
              <h3 className="font-medium mb-2">Gestion des participants</h3>
              <ParticipantsSection
                participants={allParticipants || []}
                selectedParticipantIds={selectedParticipantIds}
                onToggleParticipant={handleToggleParticipant}
                onOpenNewParticipantDialog={() => setIsNewParticipantDialogOpen(true)}
              />
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
      <MeetingTodos meetingId={meeting.id} />

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

      {/* New Participant Dialog */}
      <NewParticipantDialog
        isOpen={isNewParticipantDialogOpen}
        onClose={() => setIsNewParticipantDialogOpen(false)}
        onParticipantAdded={handleParticipantAdded}
      />
    </div>
  );
}
