
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateLetterFromTemplate, downloadWord, printWord } from "@/utils/wordTemplateUtils";

interface TextPosition {
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

interface LetterActionsCardProps {
  patientName: string;
  patientAddress: string;
  letterContent: string;
  templateUrl?: string;
  textPosition: TextPosition;
  saveLetterLocally: () => void;
  exportAsText: () => void;
  clearForm: () => void;
}

export const LetterActionsCard = ({ 
  patientName,
  patientAddress,
  letterContent, 
  templateUrl,
  textPosition,
  clearForm,
  saveLetterLocally 
}: LetterActionsCardProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleSaveWord = async () => {
    if (!patientName.trim() || !letterContent.trim()) {
      toast({
        title: "Données incomplètes",
        description: "Veuillez saisir le nom du patient et le contenu de la lettre",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const wordBytes = await generateLetterFromTemplate({
        patientName,
        patientAddress,
        letterContent,
        templateUrl,
        textPosition
      });

      const filename = `lettre_${patientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`;
      
      downloadWord(wordBytes, filename);
      
      toast({
        title: "Document Word téléchargé",
        description: "La lettre a été téléchargée en format Word dans votre dossier de téléchargements",
      });
    } catch (error) {
      console.error("Error generating Word:", error);
      toast({
        title: "Erreur Word",
        description: "Impossible de générer le document Word. Vérifiez le contenu de la lettre.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = async () => {
    if (!patientName.trim() || !letterContent.trim()) {
      toast({
        title: "Données incomplètes",
        description: "Veuillez saisir le nom du patient et le contenu de la lettre",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const wordBytes = await generateLetterFromTemplate({
        patientName,
        patientAddress,
        letterContent,
        templateUrl,
        textPosition
      });

      await printWord(wordBytes);

      toast({
        title: "Impression lancée",
        description: "Le document a été converti en PDF et l'impression a été lancée.",
      });
    } catch (error) {
      console.error("Error printing Word:", error);
      toast({
        title: "Erreur d'impression",
        description: "Impossible d'imprimer le document Word",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          <Button 
            onClick={handleSaveWord} 
            className="flex items-center gap-2"
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Sauvegarder Word
          </Button>
          
          
          <Button onClick={clearForm} variant="outline">
            Nouvelle lettre
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
