import React, { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { VoiceRecordingCard } from "@/components/patient-letters/VoiceRecordingCard";
import { MedicalLetterChat } from "@/components/patient-letters/MedicalLetterChat";
import { Textarea } from "@/components/ui/textarea";



const PatientLetters = () => {
  const [rawTranscript, setRawTranscript] = useState("");
  const [letterContent, setLetterContent] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Essayer différents formats supportés par Infomaniak
      let options = { mimeType: '' };
      
      // Liste des formats supportés par Infomaniak dans l'ordre de préférence
      const supportedFormats = [
        'audio/wav',
        'audio/mp4',
        'audio/mp3',
        'audio/ogg',
        'audio/webm;codecs=opus',
        'audio/webm'
      ];
      
      // Trouver le premier format supporté
      for (const format of supportedFormats) {
        if (MediaRecorder.isTypeSupported(format)) {
          options.mimeType = format;
          console.log('Format sélectionné:', format);
          break;
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Utiliser le type MIME détecté au lieu de forcer audio/wav
        const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      toast({
        title: "Enregistrement démarré",
        description: "Vous pouvez maintenant dicter votre lettre",
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'accéder au microphone",
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

  const handleAudioFileUpload = async (file: File) => {
    if (!file.type.startsWith('audio/')) {
      toast({
        title: "Format non supporté",
        description: "Veuillez sélectionner un fichier audio",
        variant: "destructive",
      });
      return;
    }

    console.log('📁 Audio file selected:', file.name, file.type, file.size);
    await processAudio(file);
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);

    try {
      const formData = new FormData();
      
      // Déterminer l'extension en fonction du type MIME
      let fileName = 'recording.wav';
      if (audioBlob.type.includes('mp4')) fileName = 'recording.mp4';
      else if (audioBlob.type.includes('mp3')) fileName = 'recording.mp3';
      else if (audioBlob.type.includes('ogg')) fileName = 'recording.ogg';
      else if (audioBlob.type.includes('webm')) fileName = 'recording.webm';
      
      console.log('Envoi du fichier:', fileName, 'Type:', audioBlob.type, 'Taille:', audioBlob.size);
      
      formData.append('audio', audioBlob, fileName);

      const response = await fetch('https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/transcribe-audio', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data?.success && data?.text) {
        const transcription = data.text;
        
        // Sauvegarder le transcript brut
        setRawTranscript(prev => prev + (prev ? "\n\n" : "") + transcription);

        toast({
          title: "Transcription réussie",
          description: "Traitement de la lettre en cours...",
        });

        // Lancer la réécriture
        await rewriteWithAI(transcription);
      } else {
        throw new Error(data?.error || "Erreur de transcription");
      }
    } catch (error) {
      console.error("Error processing audio:", error);
      toast({
        title: "Erreur de transcription",
        description: error.message || "Impossible de traiter l'enregistrement audio",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const rewriteWithAI = async (transcript: string) => {
    setIsRewriting(true);

    try {
      const response = await fetch('https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/rewrite-medical-letter', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data?.success && data?.rewrittenContent) {
        // Ajouter le contenu réécrit
        setLetterContent(prev => prev + (prev ? "\n\n" : "") + data.rewrittenContent);

        toast({
          title: "Réécriture terminée",
          description: "La lettre a été réécrite et corrigée",
        });
      } else {
        throw new Error(data?.error || "Erreur de réécriture");
      }
    } catch (error) {
      console.error("Error rewriting with Llama:", error);
      toast({
        title: "Erreur de traitement",
        description: error.message || "Impossible de traiter la lettre",
        variant: "destructive",
      });
    } finally {
      setIsRewriting(false);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copié!",
        description: `${type} copié dans le presse-papiers`,
      });
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      toast({
        title: "Erreur de copie",
        description: "Impossible de copier dans le presse-papiers",
        variant: "destructive",
      });
    }
  };

  const clearForm = () => {
    setRawTranscript("");
    setLetterContent("");
    toast({
      title: "Formulaire vidé",
      description: "Une nouvelle lettre peut être créée",
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Création de Lettre Patient</h1>
          <p className="text-muted-foreground">
            Créez des lettres médicales avec dictée vocale et assistance IA
          </p>
        </div>
      </header>

      <div className="grid gap-6">
        {/* 1. Dictée vocale */}
        <VoiceRecordingCard 
          isRecording={isRecording}
          isProcessing={isProcessing || isRewriting}
          startRecording={startRecording}
          stopRecording={stopRecording}
          onAudioFileUpload={handleAudioFileUpload}
        />
        
        {/* Indicateur de traitement */}
        {isRewriting && (
          <div className="text-center py-4 bg-blue-50 rounded-lg border border-blue-200 shadow-md">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-blue-700 mt-2">
              Traitement de la lettre en cours...
            </p>
          </div>
        )}
        
        {/* 3. Transcript brut éditable */}
        {rawTranscript && (
          <div className="bg-card text-card-foreground rounded-lg border shadow-md">
            <div className="p-6 pb-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Transcript Brut</h3>
                <button 
                  onClick={() => copyToClipboard(rawTranscript, "Transcript brut")}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-3 py-2 rounded-md text-sm font-medium transition-colors shadow-md"
                >
                  Copier
                </button>
              </div>
            </div>
            <div className="p-6 pt-0">
              <Textarea
                value={rawTranscript}
                onChange={(e) => setRawTranscript(e.target.value)}
                className="min-h-[200px] font-mono text-sm shadow-md"
                placeholder="Le transcript de l'audio apparaîtra ici et pourra être modifié..."
              />
            </div>
          </div>
        )}

        {/* 4. Contenu de la lettre médicale éditable */}
        {letterContent && (
          <div className="bg-card text-card-foreground rounded-lg border shadow-md">
            <div className="p-6 pb-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Lettre Médicale</h3>
                <button 
                  onClick={() => copyToClipboard(letterContent, "Lettre médicale")}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-3 py-2 rounded-md text-sm font-medium transition-colors shadow-md"
                >
                  Copier
                </button>
              </div>
            </div>
            <div className="p-6 pt-0">
              <Textarea
                value={letterContent}
                onChange={(e) => setLetterContent(e.target.value)}
                className="min-h-[200px] font-serif text-sm shadow-md"
                placeholder="La lettre médicale apparaîtra ici et pourra être modifiée..."
              />
            </div>
          </div>
        )}

        {/* 5. Chat d'assistance pour modification */}
        {(rawTranscript || letterContent) && (
          <MedicalLetterChat
            rawTranscript={rawTranscript}
            letterContent={letterContent}
            onLetterUpdate={setLetterContent}
          />
        )}

        {/* 6. Action de reset */}
        <div className="flex justify-center">
          <button 
            onClick={clearForm}
            className="border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-6 py-2 rounded-md text-sm font-medium transition-colors shadow-md"
          >
            Nouvelle lettre
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatientLetters;
