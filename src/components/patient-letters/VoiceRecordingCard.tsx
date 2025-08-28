
import React, { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Square, Upload } from "lucide-react";

interface VoiceRecordingCardProps {
  isRecording: boolean;
  isProcessing: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  onAudioFileUpload: (file: File) => void;
}

export const VoiceRecordingCard = ({ 
  isRecording, 
  isProcessing, 
  startRecording, 
  stopRecording,
  onAudioFileUpload
}: VoiceRecordingCardProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onAudioFileUpload(file);
      // Reset the input so the same file can be selected again
      event.target.value = '';
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Dictée Vocale</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              variant={isRecording ? "destructive" : "default"}
              className="w-full"
            >
              {isRecording ? (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  Arrêter l'enregistrement
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Dicter maintenant
                </>
              )}
            </Button>
            
            <Button
              onClick={triggerFileSelect}
              disabled={isProcessing || isRecording}
              variant="outline"
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              Charger un fichier audio
            </Button>
          </div>
          
          <Input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {isProcessing && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">
                Transcription en cours...
              </p>
            </div>
          )}
          
          <div className="text-xs text-gray-500">
            💡 Vous pouvez dicter directement ou charger un fichier audio (MP3, WAV, M4A, etc.)
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
