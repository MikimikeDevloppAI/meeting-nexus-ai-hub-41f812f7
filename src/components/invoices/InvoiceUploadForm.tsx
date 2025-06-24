
import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Upload, FileText, AlertCircle, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cleanFileName, validateFileName } from "@/utils/fileUtils";

interface InvoiceUploadFormProps {
  onUploadSuccess: () => void;
}

interface FileWithValidation {
  file: File;
  cleanedName: string;
  hasIssues: boolean;
  issues: string[];
}

export function InvoiceUploadForm({ onUploadSuccess }: InvoiceUploadFormProps) {
  const [files, setFiles] = useState<FileWithValidation[]>([]);
  const [allocation, setAllocation] = useState<'david' | 'cabinet' | 'split'>('david');
  const [davidPercentage, setDavidPercentage] = useState(100);
  const [uploading, setUploading] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true,
    onDrop: (acceptedFiles) => {
      const filesWithValidation = acceptedFiles.map(file => {
        const validation = validateFileName(file.name);
        const cleanedName = cleanFileName(file.name);
        
        return {
          file,
          cleanedName,
          hasIssues: !validation.isValid,
          issues: validation.issues
        };
      });
      
      setFiles(prev => [...prev, ...filesWithValidation]);
      
      // Afficher un avertissement si des fichiers ont des problèmes
      const filesWithIssues = filesWithValidation.filter(f => f.hasIssues);
      if (filesWithIssues.length > 0) {
        toast.warning(`${filesWithIssues.length} fichier(s) ont des noms qui seront automatiquement nettoyés`);
      }
    }
  });

  const handleAllocationChange = (value: string) => {
    setAllocation(value as 'david' | 'cabinet' | 'split');
    if (value === 'david') {
      setDavidPercentage(100);
    } else if (value === 'cabinet') {
      setDavidPercentage(0);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Veuillez sélectionner au moins un fichier");
      return;
    }

    const cabinetPercentage = 100 - davidPercentage;
    let successCount = 0;
    let errorCount = 0;
    const errorDetails: string[] = [];

    setUploading(true);
    
    try {
      for (const fileData of files) {
        try {
          // Utiliser le nom nettoyé avec timestamp
          const timestamp = Date.now();
          const cleanedFileName = `${timestamp}-${fileData.cleanedName}`;
          
          console.log(`Uploading file: ${fileData.file.name} as ${cleanedFileName}`);
          
          // Upload to storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('invoices')
            .upload(cleanedFileName, fileData.file);

          if (uploadError) {
            console.error('Upload error for file:', fileData.file.name, uploadError);
            
            // Messages d'erreur plus spécifiques
            let errorMessage = `Erreur lors de l'upload de "${fileData.file.name}"`;
            if (uploadError.message.includes('Invalid key')) {
              errorMessage += ' (nom de fichier invalide)';
            } else if (uploadError.message.includes('File size')) {
              errorMessage += ' (fichier trop volumineux)';
            } else {
              errorMessage += ` (${uploadError.message})`;
            }
            
            toast.error(errorMessage);
            errorDetails.push(errorMessage);
            errorCount++;
            continue;
          }

          // Create invoice record
          const { data: invoice, error: insertError } = await supabase
            .from('invoices')
            .insert({
              original_filename: fileData.file.name, // Garder le nom original pour l'affichage
              file_path: uploadData.path,
              file_size: fileData.file.size,
              content_type: fileData.file.type,
              david_percentage: davidPercentage,
              cabinet_percentage: cabinetPercentage,
              status: 'pending'
            })
            .select()
            .single();

          if (insertError) {
            console.error('Insert error for file:', fileData.file.name, insertError);
            toast.error(`Erreur lors de la création de l'enregistrement pour "${fileData.file.name}"`);
            errorDetails.push(`Erreur base de données: ${fileData.file.name}`);
            errorCount++;
            continue;
          }

          // Process with Mindee API
          const { error: processError } = await supabase.functions.invoke('process-invoice', {
            body: { invoiceId: invoice.id }
          });

          if (processError) {
            console.error('Process error for file:', fileData.file.name, processError);
            toast.error(`Erreur lors du traitement de "${fileData.file.name}"`);
            errorDetails.push(`Erreur traitement: ${fileData.file.name}`);
            errorCount++;
          } else {
            successCount++;
            console.log(`Successfully processed: ${fileData.file.name}`);
          }
        } catch (fileError) {
          console.error(`Unexpected error processing file ${fileData.file.name}:`, fileError);
          toast.error(`Erreur inattendue lors du traitement de "${fileData.file.name}"`);
          errorDetails.push(`Erreur inattendue: ${fileData.file.name}`);
          errorCount++;
        }
      }

      // Show detailed summary
      if (successCount > 0) {
        toast.success(`${successCount} fichier(s) uploadé(s) et en cours de traitement`);
      }
      if (errorCount > 0) {
        const errorSummary = `${errorCount} fichier(s) ont échoué`;
        toast.error(errorSummary);
        console.log('Détails des erreurs:', errorDetails);
      }

      // Reset only if at least one file succeeded
      if (successCount > 0) {
        setFiles([]);
        onUploadSuccess();
      }
    } catch (error) {
      console.error('Unexpected error during upload process:', error);
      toast.error("Une erreur inattendue s'est produite");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Nouvelle facture
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Upload */}
        <div>
          <Label className="text-sm font-medium">Fichiers</Label>
          <div
            {...getRootProps()}
            className={`mt-2 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'}
            `}
          >
            <input {...getInputProps()} />
            {files.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm text-gray-600 mb-3">
                  {files.length} fichier(s) sélectionné(s)
                </div>
                <div className="max-h-32 overflow-y-auto space-y-2">
                  {files.map((fileData, index) => (
                    <div key={index} className={`flex items-center justify-between p-2 rounded ${
                      fileData.hasIssues ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
                    }`}>
                      <div className="flex items-center gap-2 text-sm flex-1">
                        <FileText className="h-4 w-4" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span>{fileData.file.name}</span>
                            {fileData.hasIssues && (
                              <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            )}
                          </div>
                          {fileData.hasIssues && (
                            <div className="text-xs text-yellow-700 mt-1">
                              Sera renommé: {fileData.cleanedName}
                            </div>
                          )}
                          <span className="text-gray-500">({(fileData.file.size / 1024 / 1024).toFixed(2)} MB)</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 mx-auto text-gray-400" />
                <div className="text-sm text-gray-600">
                  {isDragActive ? (
                    "Déposez les fichiers ici..."
                  ) : (
                    "Glissez-déposez vos fichiers ici ou cliquez pour sélectionner"
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  PDF, JPG, PNG (max 10MB par fichier) - Sélection multiple possible
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Allocation */}
        <div>
          <Label className="text-sm font-medium mb-3 block">Répartition</Label>
          <RadioGroup value={allocation} onValueChange={handleAllocationChange} className="flex flex-row gap-6">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="david" id="david" />
              <Label htmlFor="david">David (100%)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="cabinet" id="cabinet" />
              <Label htmlFor="cabinet">Cabinet (100%)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="split" id="split" />
              <Label htmlFor="split">Répartition personnalisée</Label>
            </div>
          </RadioGroup>

          {allocation === 'split' && (
            <div className="mt-4 space-y-2">
              <Label htmlFor="david-percentage" className="text-sm">
                Pourcentage David
              </Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="david-percentage"
                  type="number"
                  min="0"
                  max="100"
                  value={davidPercentage}
                  onChange={(e) => setDavidPercentage(Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-sm text-gray-500">%</span>
                <span className="text-sm text-gray-500">
                  (Cabinet: {100 - davidPercentage}%)
                </span>
              </div>
              {davidPercentage < 0 || davidPercentage > 100 && (
                <div className="flex items-center gap-1 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  Le pourcentage doit être entre 0 et 100
                </div>
              )}
            </div>
          )}
        </div>

        <Button 
          onClick={handleUpload} 
          disabled={uploading || files.length === 0 || davidPercentage < 0 || davidPercentage > 100}
          className="w-full"
        >
          {uploading ? 'Upload en cours...' : `Uploader et traiter ${files.length > 0 ? `(${files.length} fichier${files.length > 1 ? 's' : ''})` : ''}`}
        </Button>
      </CardContent>
    </Card>
  );
}
