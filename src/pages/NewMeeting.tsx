
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
          .order("name");

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

      if (data && data[0]) {
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

  const createMeeting = async () => {
    if (!title) {
      toast({
        title: "Missing information",
        description: "Please enter a meeting title",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication error",
        description: "You must be logged in to create a meeting",
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

      // Create meeting record
      const { data: meetingData, error: meetingError } = await supabase
        .from("meetings")
        .insert([
          {
            title,
            audio_url: audioFileUrl,
            created_by: user.id,
          },
        ])
        .select();

      if (meetingError) throw meetingError;

      if (!meetingData || meetingData.length === 0) {
        throw new Error("Failed to create meeting");
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

      // Create empty meeting results record
      const { error: resultsError } = await supabase
        .from("meeting_results")
        .insert([
          {
            meeting_id: meetingId,
            transcript: null,
            summary: null,
          },
        ]);

      if (resultsError) throw resultsError;

      // If audio exists, process it with the webhook (simulated here)
      if (audioFileUrl) {
        // In a real implementation, call your webhook here
        console.log("Would send to webhook:", {
          meetingId,
          audioUrl: audioFileUrl,
          title,
          participants: selectedParticipantIds.map(id => 
            participants.find(p => p.id === id)
          ),
        });
        
        // For demo purposes, simulate a webhook response after a delay
        setTimeout(async () => {
          const { error } = await supabase
            .from("meeting_results")
            .update({
              transcript: "This is a simulated transcript that would be returned by the webhook.",
              summary: "This is a simulated summary that would be returned by the webhook.",
            })
            .eq("meeting_id", meetingId);
          
          if (error) {
            console.error("Error updating meeting results:", error);
          }
        }, 3000);
      }

      toast({
        title: "Meeting created",
        description: "Your meeting has been successfully created",
      });

      // Navigate to the meeting details page
      navigate(`/meetings/${meetingId}`);
    } catch (error: any) {
      console.error("Error creating meeting:", error);
      toast({
        title: "Error creating meeting",
        description: error.message || "Please try again",
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
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Meetings
        </Button>
        <h1 className="text-2xl font-bold">Create New Meeting</h1>
        <p className="text-muted-foreground">
          Fill in the meeting details and add participants
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Meeting Title</Label>
                <Input
                  id="title"
                  placeholder="Enter meeting title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Audio Recording or File</Label>
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
                              {audioFile ? audioFile.name : "Recording"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {audioFile
                                ? `${(audioFile.size / 1024 / 1024).toFixed(2)} MB`
                                : "Audio recording"}
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
                            Stop Recording
                          </>
                        ) : (
                          <>
                            <Mic className="mr-2 h-5 w-5" />
                            Start Recording
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
                          Upload Audio
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
          </Card>
        </div>

        <div>
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Participants</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openNewParticipantDialog}
                  className="text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" /> Add New
                </Button>
              </div>

              {participants.length > 0 ? (
                <div className="border rounded-md divide-y max-h-[300px] overflow-y-auto">
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
                <div className="text-center py-6 text-muted-foreground">
                  <p>No participants available</p>
                  <Button
                    variant="link"
                    onClick={openNewParticipantDialog}
                    className="mt-2"
                  >
                    Add your first participant
                  </Button>
                </div>
              )}
            </div>
          </Card>

          <div className="mt-6">
            <Button
              onClick={createMeeting}
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? "Creating Meeting..." : "Create Meeting"}
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={isNewParticipantDialogOpen}
        onOpenChange={setIsNewParticipantDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Participant</DialogTitle>
            <DialogDescription>
              Enter the details of the new participant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Participant name"
                value={newParticipantName}
                onChange={(e) => setNewParticipantName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Participant email"
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
              Cancel
            </Button>
            <Button onClick={addNewParticipant}>Add Participant</Button>
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
