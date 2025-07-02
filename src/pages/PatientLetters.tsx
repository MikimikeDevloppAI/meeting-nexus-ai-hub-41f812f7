import React, { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { PatientInfoCard } from "@/components/patient-letters/PatientInfoCard";
import { VoiceRecordingCard } from "@/components/patient-letters/VoiceRecordingCard";
import { LetterContentCard } from "@/components/patient-letters/LetterContentCard";
import { LetterActionsCard } from "@/components/patient-letters/LetterActionsCard";
import { LetterTemplateUpload } from "@/components/patient-letters/LetterTemplateUpload";
import { LetterDesigner } from "@/components/patient-letters/LetterDesigner";

interface TextPosition {
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

const PatientLetters = () => {
  const [patientName, setPatientName] = useState("");
  const [letterContent, setLetterContent] = useState("");
  const [templateUrl, setTemplateUrl] = useState("");
  const [textPosition, setTextPosition] = useState<TextPosition>({
    x: 10,
    y: 20,
    fontSize: 12,
    color: "#000000"
  });
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
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
        await processAudioWithWhisper(audioBlob);
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

  const processAudioWithWhisper = async (audioBlob: Blob) => {
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
        setLetterContent(prev => prev + (prev ? "\n\n" : "") + transcription);

        toast({
          title: "Transcription réussie",
          description: "Le texte a été ajouté à votre lettre",
        });
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

  const saveLetterLocally = () => {
    if (!patientName.trim()) {
      toast({
        title: "Nom du patient requis",
        description: "Veuillez saisir le nom du patient",
        variant: "destructive",
      });
      return;
    }

    if (!letterContent.trim()) {
      toast({
        title: "Contenu requis",
        description: "Veuillez saisir ou dicter le contenu de la lettre",
        variant: "destructive",
      });
      return;
    }

    const letterData = {
      patientName,
      letterContent,
      templateUrl,
      textPosition,
      createdAt: new Date().toISOString(),
    };

    const dataStr = JSON.stringify(letterData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `lettre_${patientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Sauvegarde réussie",
      description: "La lettre a été sauvegardée localement",
    });
  };

  const exportAsText = () => {
    if (!patientName.trim() || !letterContent.trim()) {
      toast({
        title: "Données incomplètes",
        description: "Veuillez saisir le nom du patient et le contenu de la lettre",
        variant: "destructive",
      });
      return;
    }

    const fullLetter = `LETTRE PATIENT\n\nPatient: ${patientName}\nDate: ${new Date().toLocaleDateString('fr-FR')}\n\n${letterContent}`;
    
    const dataBlob = new Blob([fullLetter], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `lettre_${patientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export réussi",
      description: "La lettre a été exportée au format texte",
    });
  };

  const clearForm = () => {
    setPatientName("");
    setLetterContent("");
    setTemplateUrl("");
    setTextPosition({ x: 10, y: 20, fontSize: 12, color: "#000000" });
    toast({
      title: "Formulaire vidé",
      description: "Une nouvelle lettre peut être créée",
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Création de Lettre Patient</h1>
        <p className="text-muted-foreground">
          Créez des lettres professionnelles avec papier à en-tête, dictée vocale et export PDF
        </p>
      </div>

      <div className="grid gap-6">
        <PatientInfoCard 
          patientName={patientName} 
          setPatientName={setPatientName} 
        />
        
        <LetterTemplateUpload 
          onTemplateUploaded={setTemplateUrl}
          currentTemplate={templateUrl}
        />
        
        <VoiceRecordingCard 
          isRecording={isRecording}
          isProcessing={isProcessing}
          startRecording={startRecording}
          stopRecording={stopRecording}
        />
        
        <LetterContentCard 
          letterContent={letterContent}
          setLetterContent={setLetterContent}
        />

        <LetterDesigner
          templateUrl={templateUrl}
          letterContent={letterContent}
          patientName={patientName}
          onPositionChange={setTextPosition}
          textPosition={textPosition}
        />
        
        <LetterActionsCard 
          patientName={patientName}
          letterContent={letterContent}
          templateUrl={templateUrl}
          textPosition={textPosition}
          saveLetterLocally={saveLetterLocally}
          exportAsText={exportAsText}
          clearForm={clearForm}
        />
      </div>
    </div>
  );
};

export default PatientLetters;
