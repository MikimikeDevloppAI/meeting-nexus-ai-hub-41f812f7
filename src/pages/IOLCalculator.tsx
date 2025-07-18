import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileText, Loader2, Download } from "lucide-react";
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
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationImage, setCalculationImage] = useState<string | null>(null);
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

  const extractPatientName = (rawText: string) => {
    // Extract patient name from rawText - look for pattern after "SID:" and before comma
    const nameMatch = rawText.match(/SID:\s*\d+\s+([^,]+),/);
    return nameMatch ? nameMatch[1].trim() : "Patient Inconnu";
  };

  const extractBirthDate = (rawText: string) => {
    // Extract birth date - look for pattern like "26.02.1983"
    const birthMatch = rawText.match(/(\d{2}\.\d{2}\.\d{4})/);
    return birthMatch ? birthMatch[1] : null;
  };

  const calculateAge = (birthDateStr: string) => {
    // Parse birth date in format DD.MM.YYYY
    const [day, month, year] = birthDateStr.split('.').map(Number);
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return age - 1;
    }
    return age;
  };

  const extractNumberBeforeSlash = (value: string) => {
    if (!value) return "";
    const beforeSlash = value.split('/')[0].trim();
    return beforeSlash;
  };

  const callIOLCalculationAPI = async (data: IOLData) => {
    setIsCalculating(true);
    try {
      const patientName = extractPatientName(data.rawText || "");
      const birthDateStr = extractBirthDate(data.rawText || "");
      const age = birthDateStr ? calculateAge(birthDateStr) : 45;
      
      // Extract patient initials - first letter of first and last name
      const nameParts = patientName.split(' ');
      const initials = nameParts.length >= 2 
        ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
        : nameParts[0] ? `${nameParts[0][0]}X`.toUpperCase() : "XX";

      const requestData = {
        gender: "Female", // Default value as not specified in extracted data
        top_fields: {
          surgeon: "David Tabibian",
          patient_initials: initials,
          id: Math.floor(Math.random() * 10000).toString(),
          age: age.toString()
        },
        right_eye: {
          AL: data.rightEye?.AL || "",
          ACD: data.rightEye?.ACD || "",
          LT: data.rightEye?.LT || "",
          CCT: data.rightEye?.CCT || "",
          "CD (WTW)": data.rightEye?.WTW || "",
          K1: extractNumberBeforeSlash(data.rightEye?.K1 || ""),
          K2: extractNumberBeforeSlash(data.rightEye?.K2 || ""),
          "Hoffer® pACD": data.rightEye?.ACD || "5.0" // Use ACD value or default
        },
        left_eye: {
          AL: data.leftEye?.AL || "",
          ACD: data.leftEye?.ACD || "",
          LT: data.leftEye?.LT || "",
          CCT: data.leftEye?.CCT || "",
          "CD (WTW)": data.leftEye?.WTW || "",
          K1: extractNumberBeforeSlash(data.leftEye?.K1 || ""),
          K2: extractNumberBeforeSlash(data.leftEye?.K2 || ""),
          "Hoffer® pACD": data.leftEye?.ACD || "5.0" // Use ACD value or default
        }
      };

      console.log("Calling IOL API with data:", requestData);

      // Call our Supabase edge function instead of the external API directly
      const response = await fetch('https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/calculate-iol', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      console.log("Edge function response status:", response.status);
      console.log("Edge function response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Edge function error response:", errorText);
        throw new Error(`Edge function error: ${response.status} - ${errorText}`);
      }

      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      setCalculationImage(imageUrl);

      toast({
        title: "Calcul IOL réussi",
        description: "L'image de calcul IOL a été générée avec succès.",
      });

    } catch (error: any) {
      console.error("Detailed error information:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause
      });
      
      // Provide more specific error messages
      let errorMessage = error.message;
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = "Erreur de connexion: Impossible de contacter le service de calcul IOL";
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = "Impossible de contacter le service de calcul IOL. Vérifiez votre connexion Internet.";
      }
      
      toast({
        title: "Erreur de calcul IOL",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const extractIOLData = async () => {
    if (!pdfFile) return;

    setIsProcessing(true);
    setIolData(null);
    setCalculationImage(null);
    
    try {
      console.log("Extraction directe du PDF:", pdfFile.name, "Taille:", pdfFile.size);
      
      const data = await extractIOLDataFromPdf(pdfFile);
      
      console.log("Données IOL extraites:", data);
      setIolData(data);

      if (data.error) {
        toast({
          title: "Document scanné détecté",
          description: data.message || "Le PDF semble être une image scannée.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Extraction réussie",
          description: "Le texte a été extrait avec succès du PDF.",
        });
        
        // Automatically call the IOL calculation API
        await callIOLCalculationAPI(data);
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
              <Button onClick={extractIOLData} disabled={isProcessing || isCalculating}>
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Extraction en cours...
                  </>
                ) : isCalculating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Calcul IOL en cours...
                  </>
                ) : (
                  "Extraire le texte du PDF"
                )}
              </Button>
            </div>
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
                    {/* Informations générales */}
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
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* Texte brut pour débogage */}
                    {iolData.rawText && (
                      <div className="bg-muted p-4 rounded-lg">
                        <h3 className="font-medium mb-2">Texte complet extrait (pour débogage) :</h3>
                        <div className="max-h-96 overflow-y-auto border bg-background p-3 rounded text-sm">
                          <pre className="whitespace-pre-wrap font-mono">{iolData.rawText}</pre>
                        </div>
                      </div>
                    )}
                   </>
                )}
                
                {/* Boutons d'export et d'automatisation */}
                <div className="flex gap-3 pt-4 flex-wrap">
                  <Button 
                    onClick={exportForSelenium} 
                    variant="secondary"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Exporter vers Selenium
                  </Button>
                  <Button 
                    onClick={automateOnESCRS} 
                    disabled={isAutomating}
                    className="flex items-center gap-2"
                  >
                    {isAutomating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span>🤖</span>
                    )}
                    {isAutomating ? 'Automatisation...' : 'Automatiser sur ESCRS'}
                  </Button>
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

          {calculationImage && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📊 Résultat du calcul IOL
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border rounded-lg overflow-hidden bg-white">
                  <img 
                    src={calculationImage} 
                    alt="Résultat du calcul IOL" 
                    className="w-full h-auto"
                  />
                </div>
                <Button 
                  className="flex items-center gap-2"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = calculationImage;
                    link.download = `iol_calculation_result.png`;
                    link.click();
                  }}
                >
                  <Download className="h-4 w-4" />
                  Télécharger le résultat
                </Button>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}