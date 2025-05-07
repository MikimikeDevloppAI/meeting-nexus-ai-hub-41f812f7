import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mic, Upload, X, Plus, ArrowLeft } from "lucide-react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface Participant {
  id: string;
  name: string;
  email: string;
}

const NewMeeting = () => {
  const [title, setTitle] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [isNewParticipantDialogOpen, setIsNewParticipantDialogOpen] = useState(false);
  const [newParticipantName, setNewParticipantName] = useState("");
  const [newParticipantEmail, setNewParticipantEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        const { data, error } = await supabase
          .from("participants")
          .select("*")
          .order('name', { ascending: true });

        if (error) throw error;
        setParticipants(data || []);
      } catch (error: any) {
        console.error("Error fetching participants:", error);
        toast({
          title: "Error loading participants",
          description: error.message || "Please try again later",
          variant: "destructive",
        });
      }
    };

    fetchParticipants();
  }, [toast]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
        
        // Stop all tracks on the stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Recording Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAudioFile(file);
      setAudioUrl(URL.createObjectURL(file));
      setAudioBlob(null); // Clear recorded audio if file is uploaded
    }
  };

  const removeAudio = () => {
    setAudioBlob(null);
    setAudioFile(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  };

  const toggleParticipantSelection = (id: string) => {
    setSelectedParticipantIds(prev =>
      prev.includes(id)
        ? prev.filter(participantId => participantId !== id)
        : [...prev, id]
    );
  };

  const openNewParticipantDialog = () => {
    setIsNewParticipantDialogOpen(true);
    setNewParticipantName("");
    setNewParticipantEmail("");
  };

  const addNewParticipant = async () => {
    if (!newParticipantName || !newParticipantEmail || !user) return;

    try {
      // Insert new participant
      const { data, error } = await supabase
        .from("participants")
        .insert([
          {
            name: newParticipantName,
            email: newParticipantEmail,
            created_by: user.id,
          },
        ])
        .select();

      if (error) throw error;
      
      if (data && data.length > 0) {
        setParticipants(prev => [...prev, data[0] as Participant]);
        setSelectedParticipantIds(prev => [...prev, data[0].id]);
        toast({
          title: "Participant added",
          description: `${newParticipantName} has been added as a participant.`,
        });
      }

      setIsNewParticipantDialogOpen(false);
    } catch (error: any) {
      console.error("Error adding participant:", error);
      toast({
        title: "Error adding participant",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const uploadAudioToStorage = async (): Promise<string | null> => {
    if (!audioBlob && !audioFile) return null;

    const fileToUpload = audioFile || new File([audioBlob!], "recording.webm", { 
      type: audioBlob?.type || "audio/webm" 
    });
    
    const fileName = `meetings/${Date.now()}-${fileToUpload.name}`;

    try {
      const { data, error } = await supabase.storage
        .from("meeting-audio")
        .upload(fileName, fileToUpload);

      if (error) throw error;
      
      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("meeting-audio")
        .getPublicUrl(fileName);
      
      return publicUrlData.publicUrl;
    } catch (error) {
      console.error("Error uploading audio:", error);
      throw error;
    }
  };

  const sendToWebhook = async (meetingData: {
    meetingId: string;
    title: string;
    audioUrl: string | null;
    participants: Participant[];
  }) => {
    try {
      const webhookUrl = "https://n8n.srv758474.hstgr.cloud/webhook-test/afd97f53-a3c1-42dc-9d9e-a2244700b36c";
      
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(meetingData),
        mode: "no-cors", // This is necessary for cross-origin webhook calls
      });
      
      console.log("Webhook notification sent");
    } catch (error) {
      console.error("Error sending to webhook:", error);
      toast({
        title: "Avertissement",
        description: "La réunion a été créée mais l'envoi des données au webhook a échoué",
        variant: "destructive",
      });
    }
  };

  const createMeeting = async () => {
    if (!title) {
      toast({
        title: "Information manquante",
        description: "Veuillez saisir un titre de réunion",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Erreur d'authentification",
        description: "Vous devez être connecté pour créer une réunion",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let audioFileUrl = null;
      if (audioBlob || audioFile) {
        audioFileUrl = await uploadAudioToStorage();
      }

      // Create meeting record (updated schema)
      const { data: meetingData, error: meetingError } = await supabase
        .from("meetings")
        .insert([
          {
            title,
            audio_url: audioFileUrl,
            created_by: user.id,
            transcript: null,
            summary: null
          },
        ])
        .select();

      if (meetingError) throw meetingError;
      
      if (!meetingData || meetingData.length === 0) {
        throw new Error("Échec de la création de la réunion");
      }

      const meetingId = meetingData[0].id;

      // Add participants
      if (selectedParticipantIds.length > 0) {
        const participantsToAdd = selectedParticipantIds.map(participantId => ({
          meeting_id: meetingId,
          participant_id: participantId,
        }));

        const { error: participantsError } = await supabase
          .from("meeting_participants")
          .insert(participantsToAdd);

        if (participantsError) throw participantsError;
      }

      // Send data to webhook
      const selectedParticipants = participants.filter(
        participant => selectedParticipantIds.includes(participant.id)
      );
      
      await sendToWebhook({
        meetingId,
        title,
        audioUrl: audioFileUrl,
        participants: selectedParticipants
      });

      toast({
        title: "Réunion créée",
        description: "Votre réunion a été créée avec succès",
      });

      // Navigate to the meeting details page
      navigate(`/meetings/${meetingId}`);
    } catch (error: any) {
      console.error("Erreur lors de la création de la réunion:", error);
      toast({
        title: "Erreur de création de la réunion",
        description: error.message || "Veuillez réessayer",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/meetings")}
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour aux Réunions
        </Button>
        <h1 className="text-2xl font-bold">Créer une nouvelle réunion</h1>
        <p className="text-muted-foreground">
          Remplissez les détails de la réunion et ajoutez des participants
        </p>
      </div>

      <div>
        <Card className="p-6 mb-6">
          <div className="space-y-6">
            {/* Meeting Title - First */}
            <div className="space-y-4">
              <Label htmlFor="title">Titre de la réunion</Label>
              <Input
                id="title"
                placeholder="Entrez le titre de la réunion"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Participants Section - Second */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Participants</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openNewParticipantDialog}
                  className="text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" /> Ajouter
                </Button>
              </div>

              {participants.length > 0 ? (
                <div className="border rounded-md divide-y max-h-[200px] overflow-y-auto">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center p-3"
                    >
                      <Checkbox
                        id={`participant-${participant.id}`}
                        checked={selectedParticipantIds.includes(participant.id)}
                        onCheckedChange={() =>
                          toggleParticipantSelection(participant.id)
                        }
                      />
                      <label
                        htmlFor={`participant-${participant.id}`}
                        className="ml-3 flex flex-col cursor-pointer flex-1"
                      >
                        <span className="text-sm font-medium">
                          {participant.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {participant.email}
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <p>Aucun participant disponible</p>
                  <Button
                    variant="link"
                    onClick={openNewParticipantDialog}
                    className="mt-2"
                  >
                    Ajouter votre premier participant
                  </Button>
                </div>
              )}
            </div>

            {/* Audio Recording Section - Third */}
            <div className="space-y-4">
              <Label>Enregistrement audio ou fichier</Label>
              <div className="mt-2 space-y-4">
                {audioUrl ? (
                  <div className="rounded-md border p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <FileAudio className="h-5 w-5 text-primary" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium">
                            {audioFile ? audioFile.name : "Enregistrement"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {audioFile
                              ? `${(audioFile.size / 1024 / 1024).toFixed(2)} MB`
                              : "Enregistrement audio"}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={removeAudio}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3">
                      <audio controls src={audioUrl} className="w-full" />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="h-24"
                      onClick={isRecording ? stopRecording : startRecording}
                    >
                      {isRecording ? (
                        <>
                          <div className="animate-pulse mr-2 h-2 w-2 rounded-full bg-red-500"></div>
                          Arrêter l'enregistrement
                        </>
                      ) : (
                        <>
                          <Mic className="mr-2 h-5 w-5" />
                          Commencer l'enregistrement
                        </>
                      )}
                    </Button>
                    <div className="relative h-24">
                      <Button
                        variant="outline"
                        className="h-full w-full flex flex-col"
                        onClick={() => document.getElementById("audio-upload")?.click()}
                      >
                        <Upload className="h-5 w-5 mb-1" />
                        Télécharger l'audio
                      </Button>
                      <input
                        id="audio-upload"
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Submit Button */}
          <div className="mt-6">
            <Button
              onClick={createMeeting}
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? "Création en cours..." : "Soumettre la réunion"}
            </Button>
          </div>
        </Card>
      </div>

      <Dialog
        open={isNewParticipantDialogOpen}
        onOpenChange={setIsNewParticipantDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un nouveau participant</DialogTitle>
            <DialogDescription>
              Entrez les informations du nouveau participant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom</Label>
              <Input
                id="name"
                placeholder="Nom du participant"
                value={newParticipantName}
                onChange={(e) => setNewParticipantName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Email du participant"
                value={newParticipantEmail}
                onChange={(e) => setNewParticipantEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsNewParticipantDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button onClick={addNewParticipant}>Ajouter le participant</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const FileAudio = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M17.5 22h.5c.5 0 1-.2 1.4-.6.4-.4.6-.9.6-1.4V7.5L14.5 2H6c-.5 0-1 .2-1.4.6C4.2 3 4 3.5 4 4v3" />
    <path d="M14 2v6h6" />
    <path d="M10 20v-1a2 2 0 1 1 4 0v1a2 2 0 1 1-4 0Z" />
    <path d="M6 20v-1a2 2 0 1 0-4 0v1a2 2 0 1 0 4 0Z" />
    <path d="M2 19v-3a6 6 0 0 1 12 0v3" />
  </svg>
);

export default NewMeeting;
