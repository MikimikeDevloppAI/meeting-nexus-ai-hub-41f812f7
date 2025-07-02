
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, Download, FileText, Printer, Loader2 } from "lucide-react";
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
  saveLetterLocally, 
  exportAsText, 
  clearForm 
}: LetterActionsCardProps) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const { toast } = useToast();

  const handlePDFExport = async () => {
    if (!patientName.trim() || !letterContent.trim()) {
      toast({
        title: "Données incomplètes",
        description: "Veuillez saisir le nom du patient et le contenu de la lettre",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPDF(true);

    try {
      const pdfBytes = await generateLetterPDF({
        patientName,
        letterContent,
        templateUrl,
        textPosition
      });

      const filename = `lettre_${patientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      downloadPDF(pdfBytes, filename);

      toast({
        title: "PDF généré",
        description: "La lettre a été exportée en PDF avec succès",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Erreur PDF",
        description: "Impossible de générer le PDF",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
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

    setIsGeneratingPDF(true);

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
        description: "La lettre a été envoyée à l'imprimante",
      });
    } catch (error) {
      console.error("Error printing PDF:", error);
      toast({
        title: "Erreur d'impression",
        description: "Impossible d'imprimer la lettre",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
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
            onClick={handlePDFExport} 
            className="flex items-center gap-2"
            disabled={isGeneratingPDF}
          >
            {isGeneratingPDF ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            {templateUrl ? "Exporter PDF avec en-tête" : "Exporter PDF"}
          </Button>
          
          <Button 
            onClick={handlePrint} 
            variant="outline" 
            className="flex items-center gap-2"
            disabled={isGeneratingPDF}
          >
            {isGeneratingPDF ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            Imprimer
          </Button>
          
          <Button onClick={saveLetterLocally} variant="outline" className="flex items-center gap-2">
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
  );
};
