import React, { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { PatientInfoCard } from "@/components/patient-letters/PatientInfoCard";
import { VoiceRecordingCard } from "@/components/patient-letters/VoiceRecordingCard";
import { LetterContentCard } from "@/components/patient-letters/LetterContentCard";



const PatientLetters = () => {
  const [patientName, setPatientName] = useState("");
  const [patientAddress, setPatientAddress] = useState("");
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
    await processAudioWithWhisper(file);
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
        
        // Ajouter le transcript brut d'abord
        setLetterContent(prev => prev + (prev ? "\n\n" : "") + transcription);

        toast({
          title: "Transcription réussie",
          description: "Réécriture avec Llama en cours...",
        });

        // Lancer la réécriture avec Llama
        await rewriteWithLlama(transcription);
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

  const rewriteWithLlama = async (transcript: string) => {
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
        // Remplacer le contenu par la version réécrite
        setLetterContent(data.rewrittenContent);

        toast({
          title: "Réécriture terminée",
          description: "La lettre a été réécrite et corrigée par Llama",
        });
      } else {
        throw new Error(data?.error || "Erreur de réécriture");
      }
    } catch (error) {
      console.error("Error rewriting with Llama:", error);
      toast({
        title: "Erreur de réécriture",
        description: error.message || "Impossible de réécrire avec Llama",
        variant: "destructive",
      });
    } finally {
      setIsRewriting(false);
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
    setPatientAddress("");
    setLetterContent("");
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
          Créez des lettres médicales avec dictée vocale et réécriture intelligente
        </p>
      </div>

      <div className="grid gap-6">
        {/* 1. Informations patient */}
        <PatientInfoCard 
          patientName={patientName} 
          setPatientName={setPatientName}
          patientAddress={patientAddress}
          setPatientAddress={setPatientAddress}
        />
        
        {/* 2. Dictée vocale */}
        <VoiceRecordingCard 
          isRecording={isRecording}
          isProcessing={isProcessing || isRewriting}
          startRecording={startRecording}
          stopRecording={stopRecording}
          onAudioFileUpload={handleAudioFileUpload}
        />
        
        {/* Indicateur de réécriture */}
        {isRewriting && (
          <div className="text-center py-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-blue-700 mt-2">
              Réécriture avec Llama en cours...
            </p>
          </div>
        )}
        
        {/* 3. Contenu de la lettre */}
        <LetterContentCard 
          letterContent={letterContent}
          setLetterContent={setLetterContent}
        />

        {/* 4. Actions simples */}
        <div className="flex gap-3">
          <button 
            onClick={exportAsText}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            disabled={!patientName.trim() || !letterContent.trim()}
          >
            Exporter en TXT
          </button>
          <button 
            onClick={clearForm}
            className="flex-1 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Nouvelle lettre
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatientLetters;
