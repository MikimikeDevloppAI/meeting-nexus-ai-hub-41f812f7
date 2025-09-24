import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Loader2, Download, Image, User, Calculator, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { extractIOLDataFromPdf, type IOLData } from "@/utils/pdfTextExtraction";
import { useIOLData } from "@/hooks/useIOLData";

export default function IOLCalculator() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [biometryFile, setBiometryFile] = useState<File | null>(null);
  const [ms39File, setMs39File] = useState<File | null>(null);
  const [biometryData, setBiometryData] = useState<IOLData | null>(null);
  const [ms39Data, setMs39Data] = useState<IOLData | null>(null);
  const [isAutomating, setIsAutomating] = useState(false);
  const [automationResult, setAutomationResult] = useState<{
    screenshot: string;
    patientData: any;
  } | null>(null);
  const [calculatedImage, setCalculatedImage] = useState<string | null>(null);
  const [apiRequestData, setApiRequestData] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isDataExtracted, setIsDataExtracted] = useState(false);
  
  // IOL Selection states
  const [rightEyeManufacturer, setRightEyeManufacturer] = useState<string>('');
  const [rightEyeIOL, setRightEyeIOL] = useState<string>('');
  const [leftEyeManufacturer, setLeftEyeManufacturer] = useState<string>('');
  const [leftEyeIOL, setLeftEyeIOL] = useState<string>('');

  // Handle manufacturer selection with auto-sync
  const handleRightEyeManufacturerChange = (value: string) => {
    setRightEyeManufacturer(value);
    setRightEyeIOL(''); // Reset IOL selection when manufacturer changes
    
    // Auto-sync to left eye only if left eye manufacturer is empty
    if (!leftEyeManufacturer) {
      setLeftEyeManufacturer(value);
      setLeftEyeIOL(''); // Reset left IOL too
    }
  };

  const handleLeftEyeManufacturerChange = (value: string) => {
    setLeftEyeManufacturer(value);
    setLeftEyeIOL(''); // Reset IOL selection when manufacturer changes
    
    // Auto-sync to right eye only if right eye manufacturer is empty
    if (!rightEyeManufacturer) {
      setRightEyeManufacturer(value);
      setRightEyeIOL(''); // Reset right IOL too
    }
  };

  // Handle IOL selection with auto-sync
  const handleRightEyeIOLChange = (value: string) => {
    setRightEyeIOL(value);
    
    // Auto-sync to left eye only if left eye IOL is empty
    if (!leftEyeIOL) {
      setLeftEyeIOL(value);
    }
  };

  const handleLeftEyeIOLChange = (value: string) => {
    setLeftEyeIOL(value);
    
    // Auto-sync to right eye only if right eye IOL is empty
    if (!rightEyeIOL) {
      setRightEyeIOL(value);
    }
  };

  // Check if form is complete for IOL calculation - need at least one eye with manufacturer and IOL
  const isIOLFormComplete = (rightEyeManufacturer && rightEyeIOL) || (leftEyeManufacturer && leftEyeIOL);

  // Function to reset all data for a new IOL calculation
  const resetAllData = () => {
    setIsProcessing(false);
    setBiometryFile(null);
    setMs39File(null);
    setBiometryData(null);
    setMs39Data(null);
    setIsAutomating(false);
    setAutomationResult(null);
    setCalculatedImage(null);
    setApiRequestData(null);
    setIsCalculating(false);
    setIsDataExtracted(false);
    setRightEyeManufacturer('');
    setRightEyeIOL('');
    setLeftEyeManufacturer('');
    setLeftEyeIOL('');
    
    // Reset HTML file inputs
    const biometryInput = document.getElementById('biometry-upload') as HTMLInputElement;
    const ms39Input = document.getElementById('ms39-upload') as HTMLInputElement;
    if (biometryInput) biometryInput.value = '';
    if (ms39Input) ms39Input.value = '';
  };
  
  const { toast } = useToast();
  const { manufacturers, getIOLsByManufacturer, isLoading: iolDataLoading } = useIOLData();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, fileType: 'biometry' | 'ms39') => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/pdf") {
      if (fileType === 'biometry') {
        setBiometryFile(file);
      } else {
        setMs39File(file);
      }
    } else {
      toast({
        title: "Format de fichier incorrect",
        description: "Veuillez sélectionner un fichier PDF.",
        variant: "destructive",
      });
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, fileType: 'biometry' | 'ms39') => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      if (fileType === 'biometry') {
        setBiometryFile(file);
      } else {
        setMs39File(file);
      }
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

  const handleButtonClick = (fileType: 'biometry' | 'ms39') => {
    document.getElementById(`${fileType}-upload`)?.click();
  };

  const extractIOLData = async () => {
    if (!biometryFile && !ms39File) return;

    setIsProcessing(true);
    setBiometryData(null);
    setMs39Data(null);
    setIsDataExtracted(false);
    setCalculatedImage(null);
    
    try {
      let biometryResult = null;
      let ms39Result = null;

      // Extraire les données du fichier biométrie s'il existe
      if (biometryFile) {
        console.log("Extraction du fichier biométrie:", biometryFile.name);
        biometryResult = await extractIOLDataFromPdf(biometryFile);
        setBiometryData(biometryResult);
      }

      // Extraire les données du fichier MS 39 s'il existe
      if (ms39File) {
        console.log("Extraction du fichier MS 39:", ms39File.name);
        ms39Result = await extractIOLDataFromPdf(ms39File);
        setMs39Data(ms39Result);
      }

      // Déterminer les données générales prioritaires (MS-39 puis biométrie)
      const priorityGeneralData = ms39Result && !ms39Result.error ? ms39Result : 
                                 biometryResult && !biometryResult.error ? biometryResult : null;
      
      // Déterminer quelle donnée utiliser pour l'API (MS 39 en priorité)
      const dataForAPI = ms39Result && !ms39Result.error ? ms39Result : 
                        biometryResult && !biometryResult.error ? biometryResult : null;

      if (dataForAPI) {
        // Format data for calculate-iol edge function
        const calculateIOLData = {
          gender: "Female",
          top_fields: {
            surgeon: "David Tabibian",
            patient_initials: priorityGeneralData?.patientInitials || "JS",
            id: priorityGeneralData?.patientId || Date.now().toString(),
            age: priorityGeneralData?.age?.toString() || "65"
          },
          right_eye: {
            "Manufacturer": rightEyeManufacturer || "HOYA",
            "Select IOL": rightEyeIOL || "XY1-SP",
            AL: dataForAPI.rightEye?.AL || "",
            ACD: dataForAPI.rightEye?.ACD || "",
            LT: dataForAPI.rightEye?.LT || "",
            CCT: dataForAPI.rightEye?.CCT || "",
            "CD (WTW)": dataForAPI.rightEye?.WTW || "",
            K1: dataForAPI.rightEye?.K1 || "",
            K2: dataForAPI.rightEye?.K2 || "",
            "Target Refraction": dataForAPI.rightEye?.targetRefraction || ""
          },
          left_eye: {
            "Manufacturer": leftEyeManufacturer || "HOYA",
            "Select IOL": leftEyeIOL || "XY1-SP",
            AL: dataForAPI.leftEye?.AL || "",
            ACD: dataForAPI.leftEye?.ACD || "",
            LT: dataForAPI.leftEye?.LT || "",
            CCT: dataForAPI.leftEye?.CCT || "",
            "CD (WTW)": dataForAPI.leftEye?.WTW || "",
            K1: dataForAPI.leftEye?.K1 || "",
            K2: dataForAPI.leftEye?.K2 || "",
            "Target Refraction": dataForAPI.leftEye?.targetRefraction || ""
          }
        };

        setApiRequestData(calculateIOLData);
        setIsDataExtracted(true);

        toast({
          title: "Extraction réussie",
          description: `Données extraites${ms39Result && !ms39Result.error ? ' (MS 39 utilisé pour l\'API)' : ''}. Vérifiez et modifiez-les si nécessaire.`,
        });
      } else {
        toast({
          title: "Aucune donnée valide",
          description: "Impossible d'extraire les données des fichiers fournis.",
          variant: "destructive",
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

  const handleApiDataChange = (section: string, field: string, value: string) => {
    if (!apiRequestData) return;
    
    // Convert commas to dots for numeric fields (excluding manufacturer and IOL selection fields)
    const processedValue = value.replace(/,/g, '.');
    
    setApiRequestData((prevData: any) => ({
      ...prevData,
      [section]: {
        ...prevData[section],
        [field]: processedValue
      }
    }));
  };

  // Helper function to get priority general information (MS-39 over biometry)
  const getPriorityGeneralInfo = (field: 'initials' | 'patientId' | 'age' | 'patientName' | 'dateOfBirth'): string => {
    // Prioritize MS-39 over biometry
    let value = '';
    
    // First try MS-39 data
    if (ms39Data) {
      switch (field) {
        case 'initials':
          value = ms39Data.patientInitials || '';
          break;
        case 'patientId':
          value = ms39Data.patientId || '';
          break;
        case 'age':
          value = ms39Data.age?.toString() || '';
          break;
        case 'patientName':
          value = ms39Data.patientName || '';
          break;
        case 'dateOfBirth':
          value = ms39Data.dateOfBirth || '';
          break;
      }
    }
    
    // If no MS-39 value, try biometry data
    if (!value && biometryData) {
      switch (field) {
        case 'initials':
          value = biometryData.patientInitials || '';
          break;
        case 'patientId':
          value = biometryData.patientId || '';
          break;
        case 'age':
          value = biometryData.age?.toString() || '';
          break;
        case 'patientName':
          value = biometryData.patientName || '';
          break;
        case 'dateOfBirth':
          value = biometryData.dateOfBirth || '';
          break;
      }
    }
    
    return value;
  };

  // Helper function to get extracted values from both files
  const getExtractedValues = (field: string, eye: 'right' | 'left') => {
    const eyeKey = eye === 'right' ? 'rightEye' : 'leftEye';
    const values = [];
    
    // Map API field names to extracted field names
    const fieldMapping: { [key: string]: string } = {
      'CD (WTW)': 'WTW',
      'Target Refraction': 'targetRefraction'
    };
    
    const extractedField = fieldMapping[field] || field;
    
    if (biometryData && biometryData[eyeKey]) {
      const eyeData = biometryData[eyeKey] as any;
      const value = eyeData[extractedField];
      if (value) {
        values.push({ source: 'Biométrie', value });
      }
    }
    
    if (ms39Data && ms39Data[eyeKey]) {
      const eyeData = ms39Data[eyeKey] as any;
      const value = eyeData[extractedField];
      if (value) {
        values.push({ source: 'MS-39', value });
      }
    }
    
    return values;
  };

  // Helper function to get the priority value (MS-39 over biometry)
  const getPriorityValue = (field: string, eye: 'right' | 'left'): string => {
    const eyeKey = eye === 'right' ? 'rightEye' : 'leftEye';
    
    // Map API field names to extracted field names
    const fieldMapping: { [key: string]: string } = {
      'CD (WTW)': 'WTW',
      'Target Refraction': 'targetRefraction'
    };
    
    const extractedField = fieldMapping[field] || field;
    
    // Prioritize MS-39 over biometry
    let value = '';
    
    // First try MS-39 data
    if (ms39Data && ms39Data[eyeKey]) {
      const eyeData = ms39Data[eyeKey] as any;
      value = eyeData[extractedField] || '';
    }
    
    // If no MS-39 value, try biometry data
    if (!value && biometryData && biometryData[eyeKey]) {
      const eyeData = biometryData[eyeKey] as any;
      value = eyeData[extractedField] || '';
    }
    
    console.log(`getPriorityValue: field=${field}, eye=${eye}, extractedField=${extractedField}, value=${value}`);
    return value;
  };

  const submitToIOLAPI = async () => {
    if (!apiRequestData) return;

    setIsCalculating(true);
    
    try {
      // Update the request data with selected manufacturers and IOLs
      const updatedApiData = {
        ...apiRequestData,
        right_eye: {
          ...apiRequestData.right_eye,
          "Manufacturer": rightEyeManufacturer || apiRequestData.right_eye["Manufacturer"] || "HOYA",
          "Select IOL": rightEyeIOL || apiRequestData.right_eye["Select IOL"] || "XY1-SP"
        },
        left_eye: {
          ...apiRequestData.left_eye,
          "Manufacturer": leftEyeManufacturer || apiRequestData.left_eye["Manufacturer"] || "HOYA",
          "Select IOL": leftEyeIOL || apiRequestData.left_eye["Select IOL"] || "XY1-SP"
        }
      };

      console.log("Envoi des données à l'API IOL Calculator:", updatedApiData);

      const response = await fetch('https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/calculate-iol', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk`
        },
        body: JSON.stringify(updatedApiData)
      });

      console.log("Calculate-IOL response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Edge function error: ${response.status} - ${errorText}`);
      }

      // Check if response is an image
      const contentType = response.headers.get('content-type');
      if (contentType?.startsWith('image/')) {
        const imageBlob = await response.blob();
        const imageUrl = URL.createObjectURL(imageBlob);
        setCalculatedImage(imageUrl);
        console.log("Image received and set");
        
        toast({
          title: "Calcul IOL réussi",
          description: "L'image de calcul IOL a été générée avec succès.",
        });
      } else {
        const result = await response.json();
        console.log("JSON result received:", result);
        
        toast({
          title: "Calcul IOL réussi", 
          description: "Les calculs IOL ont été effectués avec succès.",
        });
      }
      
    } catch (error: any) {
      console.error("Erreur lors du calcul IOL:", error);
      
      toast({
        title: "Erreur de calcul",
        description: `Impossible de calculer l'IOL: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const exportForSelenium = () => {
    const dataToExport = ms39Data && !ms39Data.error ? ms39Data : 
                        biometryData && !biometryData.error ? biometryData : null;
    if (!dataToExport) return;

    const exportData = {
      surgeon: "Tabibian",
      gender: "Female",
      patientInitials: "ME",
      patientId: Date.now().toString(),
      age: "45",
      iolData: dataToExport
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
    const dataToUse = ms39Data && !ms39Data.error ? ms39Data : 
                     biometryData && !biometryData.error ? biometryData : null;
    if (!dataToUse) return;
    
    setIsAutomating(true);
    try {
      const response = await fetch('https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/iol-selenium-automation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ iolData: dataToUse }),
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
    <div className="space-y-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">IOL Calculator</h1>
          <p className="text-muted-foreground">Calculateur de lentilles intraoculaires</p>
        </div>
      </header>

      <Card className="shadow-md hover:shadow-lg transition-shadow bg-white">
        <CardHeader>
          <CardTitle className="text-lg font-semibold tracking-tight flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Extraction de texte depuis PDF
            </div>
            <Button
              onClick={resetAllData}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Nouvel IOL
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Zone de dépôt pour fichier Biométrie */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Fichier Biométrie</h3>
            <div 
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onDrop={(e) => handleDrop(e, 'biometry')}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onClick={() => handleButtonClick('biometry')}
            >
              <div className="flex items-center gap-3">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">Glissez-déposez un fichier Biométrie ou cliquez <span className="text-sm text-muted-foreground font-normal">(Format PDF accepté)</span></p>
                </div>
                <Button variant="outline" type="button" size="sm">
                  Choisir un fichier
                </Button>
              </div>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileSelect(e, 'biometry')}
                className="hidden"
                id="biometry-upload"
              />
            </div>
            
            {biometryFile && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium text-sm">{biometryFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(biometryFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Zone de dépôt pour fichier MS 39 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Fichier MS 39</h3>
            <div 
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onDrop={(e) => handleDrop(e, 'ms39')}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onClick={() => handleButtonClick('ms39')}
            >
              <div className="flex items-center gap-3">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">Glissez-déposez un fichier MS 39 ou cliquez <span className="text-sm text-muted-foreground font-normal">(Format PDF accepté)</span></p>
                </div>
                <Button variant="outline" type="button" size="sm">
                  Choisir un fichier
                </Button>
              </div>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileSelect(e, 'ms39')}
                className="hidden"
                id="ms39-upload"
              />
            </div>
            
            {ms39File && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium text-sm">{ms39File.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(ms39File.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Bouton d'extraction */}
          {(biometryFile || ms39File) && (
            <div className="flex justify-center pt-4">
              <Button onClick={extractIOLData} disabled={isProcessing} size="lg">
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Extraction en cours...
                  </>
                ) : (
                  "Extraire les données des fichiers"
                )}
              </Button>
            </div>
          )}

          {/* Affichage des données extraites pour chaque fichier */}
          {(biometryData || ms39Data) && (
            <div className="space-y-6">


              {/* Formulaire API IOL Calculator */}
              {isDataExtracted && apiRequestData && (
                <Card className={`relative transition-all duration-300 shadow-md hover:shadow-lg transition-shadow bg-white ${isCalculating ? 'opacity-80' : ''}`}>
                  <CardContent className="space-y-6">
                    {/* Animation de loading superposée */}
                    {isCalculating && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg z-10">
                        <div className="flex items-center gap-3 bg-background border rounded-lg p-4 shadow-lg animate-scale-in">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <span className="font-medium">Calcul IOL en cours...</span>
                        </div>
                      </div>
                    )}
                    

                    {/* Informations du header */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-foreground mt-4">Informations générales</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="text-sm font-medium">Chirurgien</label>
                          <input
                            type="text"
                            value={apiRequestData.top_fields?.surgeon || ''}
                            onChange={(e) => handleApiDataChange('top_fields', 'surgeon', e.target.value)}
                            className="w-full mt-1 p-3 border-2 border-input rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 hover:border-primary/50 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Initiales patient</label>
                          <input
                            type="text"
                            value={apiRequestData.top_fields?.patient_initials ?? ''}
                            onChange={(e) => handleApiDataChange('top_fields', 'patient_initials', e.target.value)}
                            className="w-full mt-1 p-3 border-2 border-input rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 hover:border-primary/50 bg-white"
                            placeholder={getPriorityGeneralInfo('initials') ? `Extrait: ${getPriorityGeneralInfo('initials')}` : 'Ex: DT'}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">ID Patient</label>
                          <input
                            type="text"
                            value={apiRequestData.top_fields?.id ?? ''}
                            onChange={(e) => handleApiDataChange('top_fields', 'id', e.target.value)}
                            className="w-full mt-1 p-3 border-2 border-input rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 hover:border-primary/50 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Âge</label>
                          <input
                            type="text"
                            value={apiRequestData.top_fields?.age ?? ''}
                            onChange={(e) => handleApiDataChange('top_fields', 'age', e.target.value)}
                            className="w-full mt-1 p-3 border-2 border-input rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 hover:border-primary/50 bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Données des yeux */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Œil droit */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-foreground">Œil Droit (OD)</h4>
                        <div className="space-y-3">
                          {Object.entries(apiRequestData.right_eye)
                            .filter(([key]) => key !== 'Manufacturer' && key !== 'Select IOL')
                            .map(([key, value]) => (
                            <div key={key}>
                              <label className="text-sm font-medium">
                                {key}
                                {getExtractedValues(key, 'right').map((item, index) => (
                                  <span key={index} className="ml-2 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                    {item.source}: {item.value}
                                  </span>
                                ))}
                              </label>
                              <input
                                type="text"
                                value={(value as string) ?? ''}
                                onChange={(e) => handleApiDataChange('right_eye', key, e.target.value)}
                                className="w-full mt-1 p-3 border-2 border-input rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 hover:border-primary/50 bg-white"
                                placeholder={`Valeur pour ${key}`}
                              />
                            </div>
                          ))}
                          
                          {/* IOL Selection for Right Eye */}
                          <div className="space-y-3 pt-4 border-t border-border">
                            <h5 className="text-sm font-medium text-foreground">Sélection IOL - Œil Droit</h5>
                            <div className="grid grid-cols-1 gap-3">
                              <div>
                                <label className="text-sm font-medium">Manufacturier</label>
                                <Select
                                  value={rightEyeManufacturer}
                                  onValueChange={handleRightEyeManufacturerChange}
                                  disabled={iolDataLoading}
                                >
                                  <SelectTrigger className="w-full mt-1">
                                    <SelectValue placeholder="Sélectionner un manufacturier" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {manufacturers.map((manufacturer) => (
                                      <SelectItem key={manufacturer.manufacturer} value={manufacturer.manufacturer}>
                                        {manufacturer.manufacturer}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div>
                                <label className="text-sm font-medium">IOL</label>
                                <Select
                                  value={rightEyeIOL}
                                  onValueChange={handleRightEyeIOLChange}
                                  disabled={!rightEyeManufacturer || iolDataLoading}
                                >
                                  <SelectTrigger className="w-full mt-1">
                                    <SelectValue placeholder={rightEyeManufacturer ? "Sélectionner un IOL" : "Sélectionner d'abord un manufacturier"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {rightEyeManufacturer && getIOLsByManufacturer(rightEyeManufacturer).map((iol) => (
                                      <SelectItem key={iol.id} value={iol.iol}>
                                        {iol.iol}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Œil gauche */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-foreground">Œil Gauche (OS)</h4>
                        <div className="space-y-3">
                          {Object.entries(apiRequestData.left_eye)
                            .filter(([key]) => key !== 'Manufacturer' && key !== 'Select IOL')
                            .map(([key, value]) => (
                            <div key={key}>
                              <label className="text-sm font-medium">
                                {key}
                                {getExtractedValues(key, 'left').map((item, index) => (
                                  <span key={index} className="ml-2 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                    {item.source}: {item.value}
                                  </span>
                                ))}
                              </label>
                              <input
                                type="text"
                                value={(value as string) ?? ''}
                                onChange={(e) => handleApiDataChange('left_eye', key, e.target.value)}
                                className="w-full mt-1 p-3 border-2 border-input rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 hover:border-primary/50 bg-white"
                                placeholder={`Valeur pour ${key}`}
                              />
                            </div>
                          ))}
                          
                          {/* IOL Selection for Left Eye */}
                          <div className="space-y-3 pt-4 border-t border-border">
                            <h5 className="text-sm font-medium text-foreground">Sélection IOL - Œil Gauche</h5>
                            <div className="grid grid-cols-1 gap-3">
                              <div>
                                <label className="text-sm font-medium">Manufacturier</label>
                                <Select
                                  value={leftEyeManufacturer}
                                  onValueChange={handleLeftEyeManufacturerChange}
                                  disabled={iolDataLoading}
                                >
                                  <SelectTrigger className="w-full mt-1">
                                    <SelectValue placeholder="Sélectionner un manufacturier" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {manufacturers.map((manufacturer) => (
                                      <SelectItem key={manufacturer.manufacturer} value={manufacturer.manufacturer}>
                                        {manufacturer.manufacturer}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div>
                                <label className="text-sm font-medium">IOL</label>
                                <Select
                                  value={leftEyeIOL}
                                  onValueChange={handleLeftEyeIOLChange}
                                  disabled={!leftEyeManufacturer || iolDataLoading}
                                >
                                  <SelectTrigger className="w-full mt-1">
                                    <SelectValue placeholder={leftEyeManufacturer ? "Sélectionner un IOL" : "Sélectionner d'abord un manufacturier"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {leftEyeManufacturer && getIOLsByManufacturer(leftEyeManufacturer).map((iol) => (
                                      <SelectItem key={iol.id} value={iol.iol}>
                                        {iol.iol}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bouton de soumission */}
                    <div className="flex justify-center pt-4">
                      <Button 
                        onClick={submitToIOLAPI}
                        disabled={isCalculating || !isIOLFormComplete}
                        size="lg"
                        className={`${isIOLFormComplete 
                          ? 'bg-primary hover:bg-primary/90 text-primary-foreground' 
                          : 'bg-muted text-muted-foreground cursor-not-allowed'
                        }`}
                      >
                        {isCalculating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Calcul en cours...
                          </>
                        ) : (
                          "Soumettre à IOL Calculator"
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {calculatedImage && (
                <>
                  <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-blue-600" />
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
                          const dataForFileName = ms39Data && !ms39Data.error ? ms39Data : 
                                                 biometryData && !biometryData.error ? biometryData : null;
                          const initials = dataForFileName?.patientInitials || 'Patient';
                          const dateOfBirth = dataForFileName?.dateOfBirth || '';
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
                </>
              )}
            </div>
          )}

          {automationResult && (
            <Card className="mt-6 shadow-md hover:shadow-lg transition-shadow bg-white">
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