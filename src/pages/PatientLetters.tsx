import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mic, Square, Download, Save, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const PatientLetters = () => {
  const [patientName, setPatientName] = useState("");
  const [letterContent, setLetterContent] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
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

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
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
      formData.append('audio', audioBlob, 'recording.wav');

      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: formData,
      });

      if (error) {
        throw error;
      }

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
    toast({
      title: "Formulaire vidé",
      description: "Une nouvelle lettre peut être créée",
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Création de Lettre Patient</h1>
        <p className="text-muted-foreground">
          Créez des lettres pour vos patients en dictant le contenu ou en le saisissant manuellement
        </p>
      </div>

      <div className="grid gap-6">
        {/* Informations du patient */}
        <Card>
          <CardHeader>
            <CardTitle>Informations du Patient</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="patient-name">Nom du Patient</Label>
              <Input
                id="patient-name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Nom et prénom du patient"
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Enregistrement vocal */}
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

        {/* Contenu de la lettre */}
        <Card>
          <CardHeader>
            <CardTitle>Contenu de la Lettre</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="letter-content">Texte de la lettre</Label>
              <Textarea
                id="letter-content"
                value={letterContent}
                onChange={(e) => setLetterContent(e.target.value)}
                placeholder="Le contenu dicté apparaîtra ici, ou vous pouvez saisir directement..."
                rows={15}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button onClick={saveLetterLocally} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Sauvegarder (JSON)
              </Button>
              <Button onClick={exportAsText} variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Exporter (TXT)
              </Button>
              <Button onClick={clearForm} variant="outline">
                Nouvelle lettre
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PatientLetters;
