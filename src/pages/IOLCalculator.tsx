import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2, Eye, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface IOLData {
  patientName?: string;
  patientAge?: string;
  axialLength?: string;
  keratometry?: string;
  anteriorChamberDepth?: string;
  lensThickness?: string;
  recommendations?: string[];
  rawText?: string;
  error?: boolean;
  message?: string;
}

export default function IOLCalculator() {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [iolData, setIolData] = useState<IOLData | null>(null);
  const [showRawText, setShowRawText] = useState(false);
  const { toast } = useToast();

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

  const extractIOLData = async () => {
    if (!pdfFile || !user) return;

    setIsUploading(true);
    setIolData(null);
    
    try {
      console.log("Téléchargement du PDF:", pdfFile.name, "Taille:", pdfFile.size);
      
      // Upload PDF to Supabase storage
      const fileName = `iol-documents/${Date.now()}-${pdfFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, pdfFile);

      if (uploadError) {
        throw new Error(`Erreur de téléchargement: ${uploadError.message}`);
      }

      console.log("PDF téléchargé avec succès:", uploadData.path);

      // Call the extract-iol-data edge function
      const { data, error } = await supabase.functions.invoke('extract-iol-data', {
        body: { filePath: uploadData.path }
      });

      if (error) {
        throw new Error(`Erreur d'extraction: ${error.message}`);
      }

      console.log("Données IOL extraites:", data);
      setIolData(data);

      toast({
        title: "Extraction réussie",
        description: "Les données IOL ont été extraites avec succès du PDF.",
      });

      // Clean up uploaded file from storage
      await supabase.storage.from('documents').remove([uploadData.path]);
      
    } catch (error: any) {
      console.error("Erreur lors de l'extraction IOL:", error);
      
      toast({
        title: "Erreur d'extraction",
        description: `Impossible d'extraire les données IOL: ${error.message}`,
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
          <CardTitle>Extraction de données IOL depuis PDF</CardTitle>
          <CardDescription>
            Téléchargez un fichier PDF pour extraire automatiquement les données IOL avec OCR intégré.
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
              <Button onClick={extractIOLData} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Extraction en cours...
                  </>
                ) : (
                  "Extraire les données IOL"
                )}
              </Button>
            </div>
          )}
          
          {iolData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Données IOL extraites
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {iolData.error ? (
                  <div className="text-sm text-muted-foreground bg-yellow-50 p-3 rounded-lg">
                    <p className="font-medium text-yellow-800">Document scanné détecté</p>
                    <p className="text-yellow-700">{iolData.message}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {iolData.patientName && (
                      <div>
                        <p className="font-medium">Nom du patient</p>
                        <p className="text-muted-foreground">{iolData.patientName}</p>
                      </div>
                    )}
                    {iolData.patientAge && (
                      <div>
                        <p className="font-medium">Âge</p>
                        <p className="text-muted-foreground">{iolData.patientAge}</p>
                      </div>
                    )}
                    {iolData.axialLength && (
                      <div>
                        <p className="font-medium">Longueur axiale</p>
                        <p className="text-muted-foreground">{iolData.axialLength}</p>
                      </div>
                    )}
                    {iolData.keratometry && (
                      <div>
                        <p className="font-medium">Kératométrie</p>
                        <p className="text-muted-foreground">{iolData.keratometry}</p>
                      </div>
                    )}
                    {iolData.anteriorChamberDepth && (
                      <div>
                        <p className="font-medium">Profondeur chambre antérieure</p>
                        <p className="text-muted-foreground">{iolData.anteriorChamberDepth}</p>
                      </div>
                    )}
                    {iolData.lensThickness && (
                      <div>
                        <p className="font-medium">Épaisseur du cristallin</p>
                        <p className="text-muted-foreground">{iolData.lensThickness}</p>
                      </div>
                    )}
                  </div>
                )}
                
                {iolData.recommendations && (
                  <div>
                    <p className="font-medium mb-2">Recommandations</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {iolData.recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {iolData.rawText && (
                  <div className="border-t pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRawText(!showRawText)}
                      className="mb-2"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      {showRawText ? "Masquer" : "Afficher"} le texte brut
                    </Button>
                    {showRawText && (
                      <div className="bg-muted p-3 rounded-lg max-h-64 overflow-y-auto">
                        <pre className="text-xs whitespace-pre-wrap">{iolData.rawText}</pre>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}