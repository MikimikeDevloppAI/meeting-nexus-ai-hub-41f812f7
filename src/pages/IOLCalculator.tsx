
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileText, Loader2, Download, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { extractIOLDataFromPdf, type IOLData } from "@/utils/pdfTextExtraction";

export default function IOLCalculator() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [iolData, setIolData] = useState<IOLData | null>(null);
  const [isAutomating, setIsAutomating] = useState(false);
  const [automationResult, setAutomationResult] = useState<{
    screenshot: string;
    patientData: any;
  } | null>(null);
  const [calculatedImage, setCalculatedImage] = useState<string | null>(null);
  const [apiRequestData, setApiRequestData] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);
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

      if (data.error) {
        setIolData(data);
        toast({
          title: "Document scanné détecté",
          description: data.message || "Le PDF semble être une image scannée.",
          variant: "destructive",
        });
      } else {
        // Format data for calculate-iol edge function
        const calculateIOLData = {
          gender: "Female", // Default - could be extracted from PDF later
          top_fields: {
            surgeon: "David Tabibian",
            patient_initials: data.patientInitials || "JS",
            id: Date.now().toString(),
            age: data.age?.toString() || "65"
          },
          right_eye: {
            AL: data.rightEye?.AL || "",
            ACD: data.rightEye?.ACD || "",
            LT: data.rightEye?.LT || "",
            CCT: data.rightEye?.CCT || "",
            "CD (WTW)": data.rightEye?.WTW || "",
            K1: data.rightEye?.K1 || "",
            K2: data.rightEye?.K2 || "",
            "Target Refraction": data.rightEye?.targetRefraction || ""
          },
          left_eye: {
            AL: data.leftEye?.AL || "",
            ACD: data.leftEye?.ACD || "",
            LT: data.leftEye?.LT || "",
            CCT: data.leftEye?.CCT || "",
            "CD (WTW)": data.leftEye?.WTW || "",
            K1: data.leftEye?.K1 || "",
            K2: data.leftEye?.K2 || "",
            "Target Refraction": data.leftEye?.targetRefraction || ""
          }
        };

        // Stocker les données formatées pour affichage
        data.extractedDataForAPI = calculateIOLData;
        setApiRequestData(calculateIOLData);
        setIsCalculating(true);

        console.log("Calling calculate-iol edge function with data:", calculateIOLData);

        // Call the calculate-iol edge function directly with fetch to handle image response
        const response = await fetch('https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/calculate-iol', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk`
          },
          body: JSON.stringify(calculateIOLData)
        });

        console.log("Calculate-IOL response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Edge function error: ${response.status} - ${errorText}`);
        }

        // Check if response is an image
        const contentType = response.headers.get('content-type');
        if (contentType?.startsWith('image/')) {
          // Handle image response
          const imageBlob = await response.blob();
          const imageUrl = URL.createObjectURL(imageBlob);
          setCalculatedImage(imageUrl);
          console.log("Image received and set");
        } else {
          // Handle JSON response (fallback)
          const result = await response.json();
          console.log("JSON result received:", result);
        }

        setIolData(data);
        setIsCalculating(false);

        toast({
          title: "Extraction et calcul réussis",
          description: calculatedImage 
            ? "Le texte a été extrait et l'image de calcul IOL a été générée."
            : "Le texte a été extrait et les calculs IOL ont été effectués.",
        });
      }
      
    } catch (error: any) {
      console.error("Erreur lors de l'extraction IOL:", error);
      setIsCalculating(false);
      
      toast({
        title: "Erreur d'extraction",
        description: `Impossible d'extraire le texte: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const exportForSelenium = () => {
    if (!iolData) return;

    const exportData = {
      surgeon: "Tabibian",
      gender: "Female",
      patientInitials: "ME",
      patientId: Date.now().toString(),
      age: "45",
      iolData: iolData
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = "exported_iol_data.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export réussi",
      description: "Les données IOL ont été exportées pour Selenium.",
    });
  };

  const automateOnESCRS = async () => {
    if (!iolData) return;
    
    setIsAutomating(true);
    try {
      const response = await fetch('https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/iol-selenium-automation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ iolData }),
      });

      const result = await response.json();
      
      if (result.success) {
        setAutomationResult(result);
        toast({
          title: "Automatisation réussie",
          description: "Le calcul IOL a été effectué sur ESCRS",
        });
      } else {
        throw new Error(result.message || 'Erreur lors de l\'automatisation');
      }
    } catch (error) {
      console.error('Automation error:', error);
      toast({
        title: "Erreur d'automatisation",
        description: "Impossible de lancer l'automatisation sur ESCRS",
        variant: "destructive",
      });
    } finally {
      setIsAutomating(false);
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
          <CardTitle>Extraction de texte depuis PDF</CardTitle>
          <CardDescription>
            Téléchargez un fichier PDF pour extraire automatiquement tout le texte avec OCR intégré.
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
              <Button onClick={extractIOLData} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Extraction en cours...
                  </>
                ) : (
                  "Extraire le texte du PDF"
                )}
              </Button>
            </div>
          )}

          {/* API Request Status */}
          {isCalculating && apiRequestData && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-800">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Envoi des données à l'API IOL Calculator...
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-orange-700 text-sm">
                    Requête en cours d'envoi vers le serveur de calcul IOL
                  </p>
                  <div className="bg-white p-3 rounded-lg border">
                    <h4 className="font-medium text-sm mb-2">Données envoyées:</h4>
                    <pre className="text-xs overflow-auto max-h-40 text-gray-600">
                      {JSON.stringify(apiRequestData, null, 2)}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {iolData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Données IOL extraites
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {iolData.error ? (
                  <div className="text-sm text-muted-foreground bg-yellow-50 p-3 rounded-lg">
                    <p className="font-medium text-yellow-800">Document scanné détecté</p>
                    <p className="text-yellow-700">{iolData.message}</p>
                  </div>
                ) : (
                  <>


                    {/* Informations personnelles du patient */}
                    {(iolData.patientName || iolData.dateOfBirth || iolData.age) && (
                      <div className="space-y-3">
                        <h3 className="font-semibold text-lg">Informations patient</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          {iolData.patientName && (
                            <div>
                              <p className="font-medium">Nom du patient</p>
                              <p className="text-muted-foreground">{iolData.patientName}</p>
                            </div>
                          )}
                          {iolData.patientInitials && (
                            <div>
                              <p className="font-medium">Initiales</p>
                              <p className="text-muted-foreground">{iolData.patientInitials}</p>
                            </div>
                          )}
                          {iolData.dateOfBirth && (
                            <div>
                              <p className="font-medium">Date de naissance</p>
                              <p className="text-muted-foreground">{iolData.dateOfBirth}</p>
                            </div>
                          )}
                          {iolData.age && (
                            <div>
                              <p className="font-medium">Âge</p>
                              <p className="text-muted-foreground">{iolData.age} ans</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {(iolData.surgeryType || iolData.measurementDate) && (
                      <div className="space-y-3">
                        <h3 className="font-semibold text-lg">Informations générales</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {iolData.surgeryType && (
                            <div>
                              <p className="font-medium">Type de chirurgie</p>
                              <p className="text-muted-foreground">{iolData.surgeryType}</p>
                            </div>
                          )}
                          {iolData.measurementDate && (
                            <div>
                              <p className="font-medium">Date de mesure</p>
                              <p className="text-muted-foreground">{iolData.measurementDate}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tableau des données IOL */}
                    {(iolData.rightEye || iolData.leftEye) && (
                      <div className="space-y-3">
                        <h3 className="font-semibold text-lg">Données biométriques</h3>
                        <div className="border rounded-lg">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="font-semibold">Paramètre</TableHead>
                                <TableHead className="font-semibold text-center">Œil Droit (OD)</TableHead>
                                <TableHead className="font-semibold text-center">Œil Gauche (OS)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell className="font-medium">AL [mm]</TableCell>
                                <TableCell className="text-center">{iolData.rightEye?.AL || '-'}</TableCell>
                                <TableCell className="text-center">{iolData.leftEye?.AL || '-'}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">CCT [μm]</TableCell>
                                <TableCell className="text-center">{iolData.rightEye?.CCT || '-'}</TableCell>
                                <TableCell className="text-center">{iolData.leftEye?.CCT || '-'}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">AD [mm]</TableCell>
                                <TableCell className="text-center">{iolData.rightEye?.AD || '-'}</TableCell>
                                <TableCell className="text-center">{iolData.leftEye?.AD || '-'}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">ACD [mm]</TableCell>
                                <TableCell className="text-center">{iolData.rightEye?.ACD || '-'}</TableCell>
                                <TableCell className="text-center">{iolData.leftEye?.ACD || '-'}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">LT [mm]</TableCell>
                                <TableCell className="text-center">{iolData.rightEye?.LT || '-'}</TableCell>
                                <TableCell className="text-center">{iolData.leftEye?.LT || '-'}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">K1 [D/mm/°]</TableCell>
                                <TableCell className="text-center">{iolData.rightEye?.K1 || '-'}</TableCell>
                                <TableCell className="text-center">{iolData.leftEye?.K1 || '-'}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">K2 [D/mm/°]</TableCell>
                                <TableCell className="text-center">{iolData.rightEye?.K2 || '-'}</TableCell>
                                <TableCell className="text-center">{iolData.leftEye?.K2 || '-'}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">K [D/mm]</TableCell>
                                <TableCell className="text-center">{iolData.rightEye?.K || '-'}</TableCell>
                                <TableCell className="text-center">{iolData.leftEye?.K || '-'}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">Astigmatisme (AST) [D/°]</TableCell>
                                <TableCell className="text-center">{iolData.rightEye?.AST || '-'}</TableCell>
                                <TableCell className="text-center">{iolData.leftEye?.AST || '-'}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">Distance blanc à blanc (WTW) [mm]</TableCell>
                                <TableCell className="text-center">{iolData.rightEye?.WTW || '-'}</TableCell>
                                <TableCell className="text-center">{iolData.leftEye?.WTW || '-'}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">Réfraction cible</TableCell>
                                <TableCell className="text-center">{iolData.rightEye?.targetRefraction || '-'}</TableCell>
                                <TableCell className="text-center">{iolData.leftEye?.targetRefraction || '-'}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* Image du calcul IOL */}
                    {calculatedImage && (
                      <div className="space-y-3">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <Image className="h-5 w-5" />
                          Résultat du calcul IOL
                        </h3>
                        <div className="border border-border rounded-lg p-4 bg-card">
                          <img 
                            src={calculatedImage} 
                            alt="Résultat du calcul IOL"
                            className="max-w-full h-auto rounded border"
                          />
                          <div className="flex gap-2 mt-4">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                // Créer un nom de fichier avec les initiales et date de naissance
                                const initials = iolData?.patientInitials || 'Patient';
                                const dateOfBirth = iolData?.dateOfBirth || '';
                                // Nettoyer la date pour enlever les caractères spéciaux
                                const cleanDate = dateOfBirth.replace(/[^0-9]/g, '');
                                const fileName = `${initials}${cleanDate}.png`;
                                
                                const link = document.createElement('a');
                                link.href = calculatedImage;
                                link.download = fileName;
                                link.click();
                              }}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Télécharger l'image
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                   </>
                 )}
                
                {/* Boutons d'export et d'automatisation */}
                <div className="flex gap-3 pt-4 flex-wrap">
                </div>
              </CardContent>
            </Card>
          )}

          {automationResult && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🤖 Résultat de l'automatisation ESCRS
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Patient:</p>
                    <p className="text-muted-foreground">{automationResult.patientData.name}</p>
                  </div>
                  <div>
                    <p className="font-medium">ID Patient:</p>
                    <p className="text-muted-foreground">{automationResult.patientData.id}</p>
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden bg-white">
                  <img 
                    src={automationResult.screenshot} 
                    alt="Résultat ESCRS Calculator" 
                    className="w-full h-auto"
                  />
                </div>
                <Button 
                  className="flex items-center gap-2"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = automationResult.screenshot;
                    link.download = `escrs_result_${automationResult.patientData.id}.png`;
                    link.click();
                  }}
                >
                  <Download className="h-4 w-4" />
                  Télécharger le screenshot
                </Button>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
