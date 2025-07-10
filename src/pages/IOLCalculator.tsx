import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { extractIOLDataFromPdf, type IOLData } from "@/utils/pdfTextExtraction";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
                  <div className="space-y-4">
                    {/* Informations générales */}
                    <div className="border rounded-lg p-4">
                      <h3 className="font-semibold mb-3">Informations générales</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="font-medium text-muted-foreground">Nom du test</p>
                          <p>{iolData.patientInfo.name || "—"}</p>
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground">Date</p>
                          <p>{iolData.patientInfo.dateOfBirth || "—"}</p>
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground">ID de calcul (CID)</p>
                          <p>{iolData.patientInfo.patientId || "—"}</p>
                        </div>
                      </div>
                    </div>

                    {/* Tableau des mesures */}
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="font-semibold">Paramètre</TableHead>
                            <TableHead className="font-semibold text-center">Œil droit (OD)</TableHead>
                            <TableHead className="font-semibold text-center">Œil gauche (OS)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">Type de chirurgie</TableCell>
                            <TableCell className="text-center">{iolData.measurements.rightEye.surgeryType || "—"}</TableCell>
                            <TableCell className="text-center">{iolData.measurements.leftEye.surgeryType || "—"}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Date de mesure</TableCell>
                            <TableCell className="text-center">{iolData.measurements.rightEye.measurementDate || "—"}</TableCell>
                            <TableCell className="text-center">{iolData.measurements.leftEye.measurementDate || "—"}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">AL [mm]</TableCell>
                            <TableCell className="text-center">{iolData.measurements.rightEye.axialLength || "—"}</TableCell>
                            <TableCell className="text-center">{iolData.measurements.leftEye.axialLength || "—"}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">CCT [μm]</TableCell>
                            <TableCell className="text-center">{iolData.measurements.rightEye.cct || "—"}</TableCell>
                            <TableCell className="text-center">{iolData.measurements.leftEye.cct || "—"}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">AD [mm]</TableCell>
                            <TableCell className="text-center">{iolData.measurements.rightEye.ad || "—"}</TableCell>
                            <TableCell className="text-center">{iolData.measurements.leftEye.ad || "—"}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">ACD [mm]</TableCell>
                            <TableCell className="text-center">{iolData.measurements.rightEye.acd || "—"}</TableCell>
                            <TableCell className="text-center">{iolData.measurements.leftEye.acd || "—"}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">LT [mm]</TableCell>
                            <TableCell className="text-center">{iolData.measurements.rightEye.lt || "—"}</TableCell>
                            <TableCell className="text-center">{iolData.measurements.leftEye.lt || "—"}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">K1 [D/mm/°]</TableCell>
                            <TableCell className="text-center">
                              {iolData.measurements.rightEye.k1 ? 
                                `${iolData.measurements.rightEye.k1} / ${iolData.measurements.rightEye.k1_radius} @ ${iolData.measurements.rightEye.k1_axis}` 
                                : "—"}
                            </TableCell>
                            <TableCell className="text-center">
                              {iolData.measurements.leftEye.k1 ? 
                                `${iolData.measurements.leftEye.k1} / ${iolData.measurements.leftEye.k1_radius} @ ${iolData.measurements.leftEye.k1_axis}` 
                                : "—"}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">K2 [D/mm/°]</TableCell>
                            <TableCell className="text-center">
                              {iolData.measurements.rightEye.k2 ? 
                                `${iolData.measurements.rightEye.k2} / ${iolData.measurements.rightEye.k2_radius} @ ${iolData.measurements.rightEye.k2_axis}` 
                                : "—"}
                            </TableCell>
                            <TableCell className="text-center">
                              {iolData.measurements.leftEye.k2 ? 
                                `${iolData.measurements.leftEye.k2} / ${iolData.measurements.leftEye.k2_radius} @ ${iolData.measurements.leftEye.k2_axis}` 
                                : "—"}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">K [D/mm]</TableCell>
                            <TableCell className="text-center">
                              {iolData.measurements.rightEye.k_mean ? 
                                `${iolData.measurements.rightEye.k_mean} / ${iolData.measurements.rightEye.k_mean_radius}` 
                                : "—"}
                            </TableCell>
                            <TableCell className="text-center">
                              {iolData.measurements.leftEye.k_mean ? 
                                `${iolData.measurements.leftEye.k_mean} / ${iolData.measurements.leftEye.k_mean_radius}` 
                                : "—"}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Astigmatisme (AST) [D/°]</TableCell>
                            <TableCell className="text-center">
                              {iolData.measurements.rightEye.astigmatism ? 
                                `+${iolData.measurements.rightEye.astigmatism} @ ${iolData.measurements.rightEye.astigmatism_axis}` 
                                : "—"}
                            </TableCell>
                            <TableCell className="text-center">
                              {iolData.measurements.leftEye.astigmatism ? 
                                `+${iolData.measurements.leftEye.astigmatism} @ ${iolData.measurements.leftEye.astigmatism_axis}` 
                                : "—"}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Q</TableCell>
                            <TableCell className="text-center">{iolData.measurements.rightEye.q || "—"}</TableCell>
                            <TableCell className="text-center">{iolData.measurements.leftEye.q || "—"}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Distance blanc à blanc (WTW) [mm]</TableCell>
                            <TableCell className="text-center">{iolData.measurements.rightEye.wtw || "—"}</TableCell>
                            <TableCell className="text-center">{iolData.measurements.leftEye.wtw || "—"}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
                
                {iolData.recommendations && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Recommandations</h3>
                    <p className="text-sm text-muted-foreground">{iolData.recommendations}</p>
                  </div>
                )}

                {/* Affichage du texte brut extrait pour debugging */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="font-semibold mb-3">Texte brut extrait (pour debugging)</h3>
                  <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-96 whitespace-pre-wrap">
                    {iolData.rawText || "Texte brut non disponible"}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}