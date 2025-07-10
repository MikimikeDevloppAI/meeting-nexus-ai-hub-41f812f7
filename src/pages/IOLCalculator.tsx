import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2 } from "lucide-react";
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
  rawText?: string; // Ajout pour afficher le texte brut extrait
  [key: string]: any; // Permettre d'autres propriétés dynamiques
}

export default function IOLCalculator() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [extractedData, setExtractedData] = useState<IOLData | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      setExtractedData(null);
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
      setExtractedData(null);
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

  const handleUploadAndExtract = async () => {
    if (!pdfFile) return;

    setIsUploading(true);
    try {
      // Clean the filename to avoid issues with special characters
      const cleanFileName = pdfFile.name
        .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
        .replace(/_{2,}/g, '_'); // Replace multiple underscores with single one
      
      // Upload the PDF to Supabase storage
      const fileName = `iol-${Date.now()}-${cleanFileName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, pdfFile);

      if (uploadError) throw uploadError;

      // Call the edge function to extract IOL data
      const { data: extractionData, error: extractionError } = await supabase.functions.invoke(
        "extract-iol-data",
        {
          body: { filePath: uploadData.path }
        }
      );

      if (extractionError) throw extractionError;

      setExtractedData(extractionData);
      console.log("Données extraites:", extractionData);
      toast({
        title: "Extraction réussie",
        description: "Les données IOL ont été extraites avec succès.",
      });

      // Clean up the uploaded file
      await supabase.storage.from("documents").remove([uploadData.path]);
    } catch (error) {
      console.error("Erreur lors de l'extraction:", error);
      toast({
        title: "Erreur d'extraction",
        description: "Impossible d'extraire les données du PDF.",
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
            <CardTitle>Extraction des données IOL depuis un PDF</CardTitle>
            <CardDescription>
              Téléchargez un fichier PDF contenant des mesures biométriques pour extraire automatiquement les données IOL.
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
                <Button onClick={handleUploadAndExtract} disabled={isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Extraction en cours...
                    </>
                  ) : (
                    "Extraire les données"
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {extractedData && (
          <Card>
            <CardHeader>
              <CardTitle>Données extraites</CardTitle>
              <CardDescription>
                Informations IOL extraites du document PDF
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Gestion des erreurs de PDF scanné */}
                {extractedData.error ? (
                  <div className="col-span-full">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                        📄 Document scanné détecté
                      </h3>
                      <div className="text-sm text-yellow-700 whitespace-pre-line">
                        {extractedData.message}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {extractedData.patientName && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Nom du patient</label>
                        <p className="text-lg">{extractedData.patientName}</p>
                      </div>
                    )}
                    {extractedData.patientAge && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Âge</label>
                        <p className="text-lg">{extractedData.patientAge}</p>
                      </div>
                    )}
                    {extractedData.axialLength && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Longueur axiale</label>
                        <p className="text-lg">{extractedData.axialLength}</p>
                      </div>
                    )}
                    {extractedData.keratometry && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Kératométrie</label>
                        <p className="text-lg">{extractedData.keratometry}</p>
                      </div>
                    )}
                    {extractedData.anteriorChamberDepth && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Profondeur chambre antérieure</label>
                        <p className="text-lg">{extractedData.anteriorChamberDepth}</p>
                      </div>
                    )}
                    {extractedData.lensThickness && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Épaisseur cristallin</label>
                        <p className="text-lg">{extractedData.lensThickness}</p>
                      </div>
                    )}
                    
                    {/* Afficher toutes les autres données trouvées */}
                    {Object.entries(extractedData)
                      .filter(([key, value]) => 
                        !['patientName', 'patientAge', 'axialLength', 'keratometry', 'anteriorChamberDepth', 'lensThickness', 'recommendations', 'rawText', 'error', 'message'].includes(key) 
                        && value
                      )
                      .map(([key, value]) => (
                        <div key={key}>
                          <label className="text-sm font-medium text-muted-foreground">
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </label>
                          <p className="text-lg">{String(value)}</p>
                        </div>
                      ))
                    }
                  </>
                )}
              </div>
              
              {extractedData.recommendations && extractedData.recommendations.length > 0 && (
                <div className="mt-6">
                  <label className="text-sm font-medium text-muted-foreground">Recommandations IOL</label>
                  <ul className="mt-2 space-y-1">
                    {extractedData.recommendations.map((rec, index) => (
                      <li key={index} className="text-sm bg-muted p-2 rounded">
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Afficher le texte brut extrait pour debug seulement si pas d'erreur */}
              {extractedData.rawText && !extractedData.error && (
                <div className="mt-6">
                  <label className="text-sm font-medium text-muted-foreground">Texte brut extrait (debug)</label>
                  <div className="mt-2 max-h-40 overflow-y-auto bg-muted p-3 rounded text-xs">
                    <pre className="whitespace-pre-wrap">{extractedData.rawText}</pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
  );
}