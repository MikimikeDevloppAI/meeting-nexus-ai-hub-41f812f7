
import { useState, useRef } from "react";
import { Mic, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

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

interface AudioRecordingSectionProps {
  audioBlob: Blob | null;
  audioFile: File | null;
  audioUrl: string | null;
  isRecording: boolean;
  onAudioBlobChange: (blob: Blob | null) => void;
  onAudioFileChange: (file: File | null) => void;
  onAudioUrlChange: (url: string | null) => void;
  onRecordingChange: (recording: boolean) => void;
}

export const AudioRecordingSection = ({
  audioBlob,
  audioFile,
  audioUrl,
  isRecording,
  onAudioBlobChange,
  onAudioFileChange,
  onAudioUrlChange,
  onRecordingChange
}: AudioRecordingSectionProps) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

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
        onAudioBlobChange(audioBlob);
        onAudioUrlChange(URL.createObjectURL(audioBlob));
        
        // Stop all tracks on the stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      onRecordingChange(true);
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
      onRecordingChange(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      onAudioFileChange(file);
      onAudioUrlChange(URL.createObjectURL(file));
      onAudioBlobChange(null); // Clear recorded audio if file is uploaded
    }
  };

  const removeAudio = () => {
    onAudioBlobChange(null);
    onAudioFileChange(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      onAudioUrlChange(null);
    }
  };

  return (
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
  );
};
