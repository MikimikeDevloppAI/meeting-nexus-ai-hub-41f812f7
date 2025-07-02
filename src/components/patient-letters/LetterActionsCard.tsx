
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleLocalSave = () => {
    if (!patientName.trim() || !letterContent.trim()) {
      toast({
        title: "Données incomplètes",
        description: "Veuillez saisir le nom du patient et le contenu de la lettre",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Créer le contenu de la lettre formaté
      const formattedContent = `LETTRE PATIENT

Patient: ${patientName}
Date: ${new Date().toLocaleDateString('fr-FR')}
Position du texte: X: ${textPosition.x}%, Y: ${textPosition.y}%
Taille de police: ${textPosition.fontSize}px
Couleur: ${textPosition.color}
Template utilisé: ${templateUrl ? 'Oui' : 'Non'}

CONTENU:
${letterContent}`;

      // Créer et télécharger le fichier
      const blob = new Blob([formattedContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `lettre_${patientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Lettre sauvegardée",
        description: "La lettre a été sauvegardée en local avec succès",
      });
    } catch (error) {
      console.error("Error saving letter:", error);
      toast({
        title: "Erreur de sauvegarde",
        description: "Impossible de sauvegarder la lettre",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    if (!patientName.trim() || !letterContent.trim()) {
      toast({
        title: "Données incomplètes",
        description: "Veuillez saisir le nom du patient et le contenu de la lettre",
        variant: "destructive",
      });
      return;
    }

    // Créer une version imprimable simple
    const printContent = `
      <html>
        <head>
          <title>Lettre Patient - ${patientName}</title>
          <style>
            body { font-family: 'Times New Roman', serif; margin: 2cm; line-height: 1.6; }
            .header { font-weight: bold; margin-bottom: 20px; }
            .date { margin-bottom: 20px; }
            .content { white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <div class="header">Patient: ${patientName}</div>
          <div class="date">Date: ${new Date().toLocaleDateString('fr-FR')}</div>
          <div class="content">${letterContent}</div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
        printWindow.close();
      };
    }

    toast({
      title: "Impression lancée",
      description: "La fenêtre d'impression a été ouverte",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          <Button 
            onClick={handleLocalSave} 
            className="flex items-center gap-2"
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Sauvegarder localement
          </Button>
          
          <Button 
            onClick={handlePrint} 
            variant="outline" 
            className="flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Imprimer
          </Button>
          
          <Button onClick={clearForm} variant="outline">
            Nouvelle lettre
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
