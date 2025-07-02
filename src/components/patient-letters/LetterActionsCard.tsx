
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateLetterPDF, downloadPDF, printPDF } from "@/utils/pdfUtils";

interface TextPosition {
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

interface LetterActionsCardProps {
  patientName: string;
  letterContent: string;
  templateUrl?: string;
  textPosition: TextPosition;
  saveLetterLocally: () => void;
  exportAsText: () => void;
  clearForm: () => void;
}

export const LetterActionsCard = ({ 
  patientName, 
  letterContent, 
  templateUrl,
  textPosition,
  clearForm,
  saveLetterLocally 
}: LetterActionsCardProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleSavePDF = async () => {
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
      const pdfBytes = await generateLetterPDF({
        patientName,
        letterContent,
        templateUrl,
        textPosition
      });

      const filename = `lettre_${patientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Utiliser le téléchargement direct qui fonctionne partout
      downloadPDF(pdfBytes, filename);
      
      toast({
        title: "PDF téléchargé",
        description: "La lettre a été téléchargée en PDF dans votre dossier de téléchargements",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Erreur PDF",
        description: "Impossible de générer le PDF. Vérifiez le contenu de la lettre.",
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
      const pdfBytes = await generateLetterPDF({
        patientName,
        letterContent,
        templateUrl,
        textPosition
      });

      printPDF(pdfBytes);

      toast({
        title: "Impression lancée",
        description: "Le PDF a été envoyé à l'imprimante",
      });
    } catch (error) {
      console.error("Error printing PDF:", error);
      toast({
        title: "Erreur d'impression",
        description: "Impossible d'imprimer le PDF",
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
            onClick={handleSavePDF} 
            className="flex items-center gap-2"
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Sauvegarder PDF
          </Button>
          
          <Button 
            onClick={handlePrint} 
            variant="outline" 
            className="flex items-center gap-2"
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            Imprimer PDF
          </Button>
          
          <Button onClick={clearForm} variant="outline">
            Nouvelle lettre
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
