import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function IOLCalculator() {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const { toast } = useToast();

  const webhookUrl = "https://n8n.srv758474.hstgr.cloud/webhook-test/06ff1a12-9f11-4d2c-9472-3f33a574be43";

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
    } else {
      toast({
        title: "Format de fichier incorrect",
        description: "Veuillez sélectionner un fichier PDF.",
        variant: "destructive",
      });
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
    } else {
      toast({
        title: "Format de fichier incorrect",
        description: "Veuillez déposer un fichier PDF.",
        variant: "destructive",
      });
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleButtonClick = () => {
    document.getElementById('pdf-upload')?.click();
  };

  const sendToWebhook = async () => {
    if (!pdfFile) return;

    setIsUploading(true);
    try {
      console.log("Envoi du PDF au webhook n8n:", webhookUrl);
      
      // Convertir le fichier en base64
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Enlever le préfixe data:application/pdf;base64,
        };
        reader.readAsDataURL(pdfFile);
      });

      const payload = {
        fileName: pdfFile.name,
        fileSize: pdfFile.size,
        mimeType: pdfFile.type,
        fileData: base64Data,
        timestamp: new Date().toISOString(),
        triggered_from: window.location.origin,
        source: "lovable-iol-calculator"
      };

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: "no-cors", // Pour gérer CORS
        body: JSON.stringify(payload),
      });

      console.log("PDF envoyé au webhook n8n avec succès");
      toast({
        title: "PDF envoyé avec succès",
        description: "Le PDF a été envoyé au webhook n8n. Vérifiez les logs de votre workflow pour confirmer.",
      });
      
      // Réinitialiser le fichier après envoi
      setPdfFile(null);
      const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (error) {
      console.error("Erreur lors de l'envoi au webhook:", error);
      toast({
        title: "Erreur webhook",
        description: "Impossible d'envoyer le PDF au webhook n8n.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <FileText className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">IOL Calculator</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Envoi de PDF au webhook n8n</CardTitle>
          <CardDescription>
            Téléchargez un fichier PDF pour l'envoyer automatiquement au workflow n8n.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div 
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onClick={handleButtonClick}
          >
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <div className="space-y-2">
              <p className="text-lg font-medium">Glissez-déposez un fichier PDF ou cliquez pour sélectionner</p>
              <p className="text-sm text-muted-foreground">
                Formats acceptés: PDF uniquement
              </p>
            </div>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
              id="pdf-upload"
            />
            <Button variant="outline" className="mt-4" type="button">
              Choisir un fichier
            </Button>
          </div>

          {pdfFile && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span className="font-medium">{pdfFile.name}</span>
                <span className="text-sm text-muted-foreground">
                  ({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
              <Button onClick={sendToWebhook} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  "Envoyer au webhook"
                )}
              </Button>
            </div>
          )}
          
          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
            <p><strong>Webhook configuré :</strong></p>
            <p className="font-mono text-xs break-all">{webhookUrl}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}