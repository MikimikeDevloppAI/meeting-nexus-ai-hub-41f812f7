import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { extractIOLDataFromPdf, type IOLData } from "@/utils/pdfTextExtraction";

export default function IOLCalculator() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [iolData, setIolData] = useState<IOLData | null>(null);
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
    if (!pdfFile) return;

    setIsProcessing(true);
    setIolData(null);
    
    try {
      console.log("Extraction directe du PDF:", pdfFile.name, "Taille:", pdfFile.size);
      
      const data = await extractIOLDataFromPdf(pdfFile);
      
      console.log("Données IOL extraites:", data);
      setIolData(data);

      if (data.hasError) {
        toast({
          title: "Document scanné détecté",
          description: data.errorMessage || "Le PDF semble être une image scannée.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Extraction réussie",
          description: "Le texte a été extrait avec succès du PDF.",
        });
      }
      
    } catch (error: any) {
      console.error("Erreur lors de l'extraction IOL:", error);
      
      toast({
        title: "Erreur d'extraction",
        description: `Impossible d'extraire le texte: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
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
            Téléchargez un fichier PDF de biométrie oculaire pour extraire automatiquement les mesures IOL.
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
                Formats acceptés: PDF de biométrie IOL
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
              <Button onClick={extractIOLData} disabled={isProcessing}>
                {isProcessing ? (
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
                  <Eye className="h-5 w-5" />
                  Données IOL extraites
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {iolData.hasError ? (
                  <div className="text-sm text-muted-foreground bg-yellow-50 p-3 rounded-lg">
                    <p className="font-medium text-yellow-800">Document scanné détecté</p>
                    <p className="text-yellow-700">{iolData.errorMessage}</p>
                  </div>
                ) : (
                  <>
                    {/* Informations patient */}
                    <div className="border rounded-lg p-4">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Informations patient
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="font-medium text-muted-foreground">Nom du test</p>
                          <p className="text-lg">{iolData.patientInfo.name || "Non spécifié"}</p>
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground">Date</p>
                          <p className="text-lg">{iolData.patientInfo.dateOfBirth || "Non spécifiée"}</p>
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground">ID de calcul (CID)</p>
                          <p className="text-lg">{iolData.patientInfo.patientId || "Non spécifié"}</p>
                        </div>
                      </div>
                    </div>

                    {/* Mesures œil droit */}
                    <div className="border rounded-lg p-4">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Œil droit (OD)
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {iolData.measurements.rightEye.axialLength && (
                          <div>
                            <p className="font-medium text-muted-foreground">AL (mm)</p>
                            <p className="text-lg">{iolData.measurements.rightEye.axialLength}</p>
                          </div>
                        )}
                        {iolData.measurements.rightEye.cct && (
                          <div>
                            <p className="font-medium text-muted-foreground">CCT (μm)</p>
                            <p className="text-lg">{iolData.measurements.rightEye.cct}</p>
                          </div>
                        )}
                        {iolData.measurements.rightEye.acd && (
                          <div>
                            <p className="font-medium text-muted-foreground">ACD (mm)</p>
                            <p className="text-lg">{iolData.measurements.rightEye.acd}</p>
                          </div>
                        )}
                        {iolData.measurements.rightEye.lt && (
                          <div>
                            <p className="font-medium text-muted-foreground">LT (mm)</p>
                            <p className="text-lg">{iolData.measurements.rightEye.lt}</p>
                          </div>
                        )}
                      </div>
                      
                      {/* Kératométrie */}
                      {(iolData.measurements.rightEye.k1 || iolData.measurements.rightEye.k2) && (
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="font-medium mb-2">Kératométrie</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            {iolData.measurements.rightEye.k1 && (
                              <div>
                                <p className="font-medium text-muted-foreground">K1</p>
                                <p>{iolData.measurements.rightEye.k1}D / {iolData.measurements.rightEye.k1_radius}mm @ {iolData.measurements.rightEye.k1_axis}°</p>
                              </div>
                            )}
                            {iolData.measurements.rightEye.k2 && (
                              <div>
                                <p className="font-medium text-muted-foreground">K2</p>
                                <p>{iolData.measurements.rightEye.k2}D / {iolData.measurements.rightEye.k2_radius}mm @ {iolData.measurements.rightEye.k2_axis}°</p>
                              </div>
                            )}
                            {iolData.measurements.rightEye.k_mean && (
                              <div>
                                <p className="font-medium text-muted-foreground">K moyen</p>
                                <p>{iolData.measurements.rightEye.k_mean}D / {iolData.measurements.rightEye.k_mean_radius}mm</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Astigmatisme et WTW */}
                      <div className="mt-4 pt-4 border-t">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {iolData.measurements.rightEye.astigmatism && (
                            <div>
                              <p className="font-medium text-muted-foreground">Astigmatisme</p>
                              <p>{iolData.measurements.rightEye.astigmatism}D @ {iolData.measurements.rightEye.astigmatism_axis}°</p>
                            </div>
                          )}
                          {iolData.measurements.rightEye.wtw && (
                            <div>
                              <p className="font-medium text-muted-foreground">WTW (mm)</p>
                              <p>{iolData.measurements.rightEye.wtw}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mesures œil gauche si présentes */}
                    {iolData.measurements.leftEye.axialLength && (
                      <div className="border rounded-lg p-4">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          Œil gauche (OS)
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          {/* Afficher les mesures de l'œil gauche de la même manière */}
                          {iolData.measurements.leftEye.axialLength && (
                            <div>
                              <p className="font-medium text-muted-foreground">AL (mm)</p>
                              <p className="text-lg">{iolData.measurements.leftEye.axialLength}</p>
                            </div>
                          )}
                          {/* ... autres mesures ... */}
                        </div>
                      </div>
                    )}
                  </>
                )}
                
                {iolData.recommendations && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Recommandations</h3>
                    <p className="text-sm text-muted-foreground">{iolData.recommendations}</p>
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