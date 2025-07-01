
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";

interface VoiceRecordingCardProps {
  isRecording: boolean;
  isProcessing: boolean;
  startRecording: () => void;
  stopRecording: () => void;
}

export const VoiceRecordingCard = ({ 
  isRecording, 
  isProcessing, 
  startRecording, 
  stopRecording 
}: VoiceRecordingCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dictée Vocale</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-3">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              variant={isRecording ? "destructive" : "default"}
              className="flex-1"
            >
              {isRecording ? (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  Arrêter l'enregistrement
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Commencer la dictée
                </>
              )}
            </Button>
          </div>
          
          {isProcessing && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">
                Transcription en cours...
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
