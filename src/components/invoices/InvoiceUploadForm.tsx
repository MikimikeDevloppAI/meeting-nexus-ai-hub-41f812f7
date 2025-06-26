
import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload, FileText, AlertTriangle, X, Users, User, Receipt, FileImage } from "lucide-react";
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

interface FileGroup {
  id: string;
  files: FileWithValidation[];
  compte: 'David Tabibian' | 'Commun';
  documentType: 'invoice' | 'receipt';
  groupTogether: boolean;
}

export function InvoiceUploadForm({ onUploadSuccess }: InvoiceUploadFormProps) {
  const [fileGroups, setFileGroups] = useState<FileGroup[]>([]);
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
      
      // Créer un nouveau groupe pour les fichiers ajoutés
      const newGroup: FileGroup = {
        id: Date.now().toString(),
        files: filesWithValidation,
        compte: 'Commun',
        documentType: 'invoice',
        groupTogether: false
      };
      
      setFileGroups(prev => [...prev, newGroup]);
      
      // Afficher un avertissement si des fichiers ont des problèmes
      const filesWithIssues = filesWithValidation.filter(f => f.hasIssues);
      if (filesWithIssues.length > 0) {
        toast.warning(`${filesWithIssues.length} fichier(s) ont des noms qui seront automatiquement nettoyés`);
      }
    }
  });

  const updateGroupProperty = (groupId: string, property: keyof FileGroup, value: any) => {
    setFileGroups(prev => 
      prev.map(group => 
        group.id === groupId ? { ...group, [property]: value } : group
      )
    );
  };

  const removeFileFromGroup = (groupId: string, fileIndex: number) => {
    setFileGroups(prev => 
      prev.map(group => 
        group.id === groupId 
          ? { ...group, files: group.files.filter((_, i) => i !== fileIndex) }
          : group
      ).filter(group => group.files.length > 0)
    );
  };

  const removeGroup = (groupId: string) => {
    setFileGroups(prev => prev.filter(group => group.id !== groupId));
  };

  const handleUpload = async () => {
    if (fileGroups.length === 0) {
      toast.error("Veuillez sélectionner au moins un fichier");
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const errorDetails: string[] = [];

    setUploading(true);
    
    try {
      for (const group of fileGroups) {
        try {
          if (group.groupTogether && group.files.length > 1) {
            // Traitement groupé : tous les fichiers ensemble
            await processGroupedFiles(group);
            successCount++;
          } else {
            // Traitement individuel : chaque fichier séparément
            for (const fileData of group.files) {
              try {
                await processSingleFile(fileData, group.compte, group.documentType);
                successCount++;
              } catch (error) {
                console.error(`Error processing file ${fileData.file.name}:`, error);
                errorDetails.push(`Erreur: ${fileData.file.name}`);
                errorCount++;
              }
            }
          }
        } catch (groupError) {
          console.error(`Error processing group ${group.id}:`, groupError);
          errorDetails.push(`Erreur groupe: ${group.files.map(f => f.file.name).join(', ')}`);
          errorCount++;
        }
      }

      // Afficher le résumé
      if (successCount > 0) {
        toast.success(`${successCount} fichier(s)/groupe(s) uploadé(s) et en cours de traitement`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} fichier(s)/groupe(s) ont échoué`);
        console.log('Détails des erreurs:', errorDetails);
      }

      // Reset si au moins un succès
      if (successCount > 0) {
        setFileGroups([]);
        onUploadSuccess();
      }
    } catch (error) {
      console.error('Unexpected error during upload process:', error);
      toast.error("Une erreur inattendue s'est produite");
    } finally {
      setUploading(false);
    }
  };

  const processSingleFile = async (
    fileData: FileWithValidation, 
    compte: string, 
    documentType: string
  ) => {
    // Utiliser le nom nettoyé avec timestamp
    const timestamp = Date.now();
    const cleanedFileName = `${timestamp}-${fileData.cleanedName}`;
    
    console.log(`Uploading file: ${fileData.file.name} as ${cleanedFileName}`);
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(cleanedFileName, fileData.file);

    if (uploadError) {
      throw new Error(`Upload error: ${uploadError.message}`);
    }

    // Create invoice record
    const { data: invoice, error: insertError } = await supabase
      .from('invoices')
      .insert({
        original_filename: fileData.file.name,
        file_path: uploadData.path,
        file_size: fileData.file.size,
        content_type: fileData.file.type,
        compte: compte,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Database error: ${insertError.message}`);
    }

    // Process with Mindee API
    const { error: processError } = await supabase.functions.invoke('process-invoice', {
      body: { 
        invoiceId: invoice.id,
        documentType: documentType,
        isGrouped: false
      }
    });

    if (processError) {
      throw new Error(`Processing error: ${processError.message}`);
    }
  };

  const processGroupedFiles = async (group: FileGroup) => {
    const invoiceIds: string[] = [];
    
    // Upload tous les fichiers du groupe
    for (const fileData of group.files) {
      const timestamp = Date.now();
      const cleanedFileName = `${timestamp}-${fileData.cleanedName}`;
      
      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(cleanedFileName, fileData.file);

      if (uploadError) {
        throw new Error(`Upload error for ${fileData.file.name}: ${uploadError.message}`);
      }

      // Create invoice record
      const { data: invoice, error: insertError } = await supabase
        .from('invoices')
        .insert({
          original_filename: fileData.file.name,
          file_path: uploadData.path,
          file_size: fileData.file.size,
          content_type: fileData.file.type,
          compte: group.compte,
          status: 'pending'
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Database error for ${fileData.file.name}: ${insertError.message}`);
      }

      invoiceIds.push(invoice.id);
    }

    // Process grouped files with Mindee API
    const { error: processError } = await supabase.functions.invoke('process-invoice', {
      body: { 
        invoiceIds: invoiceIds,
        documentType: group.documentType,
        isGrouped: true
      }
    });

    if (processError) {
      throw new Error(`Group processing error: ${processError.message}`);
    }
  };

  const getTotalFiles = () => {
    return fileGroups.reduce((total, group) => total + group.files.length, 0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Nouvelle facture/reçu
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
          </div>
        </div>

        {/* File Groups */}
        {fileGroups.map((group, groupIndex) => (
          <Card key={group.id} className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  Groupe {groupIndex + 1} - {group.files.length} fichier(s)
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeGroup(group.id)}
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Files in group */}
              <div className="space-y-2">
                {group.files.map((fileData, fileIndex) => (
                  <div key={fileIndex} className={`flex items-center justify-between p-2 rounded ${
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
                      onClick={() => removeFileFromGroup(group.id, fileIndex)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Group settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                {/* Compte selection */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Compte</Label>
                  <RadioGroup 
                    value={group.compte} 
                    onValueChange={(value) => updateGroupProperty(group.id, 'compte', value)}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="David Tabibian" id={`david-${group.id}`} />
                      <Label htmlFor={`david-${group.id}`} className="flex items-center gap-1 cursor-pointer">
                        <User className="h-4 w-4" />
                        David
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Commun" id={`commun-${group.id}`} />
                      <Label htmlFor={`commun-${group.id}`} className="flex items-center gap-1 cursor-pointer">
                        <Users className="h-4 w-4" />
                        Commun
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Document type selection */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Type de document</Label>
                  <RadioGroup 
                    value={group.documentType} 
                    onValueChange={(value) => updateGroupProperty(group.id, 'documentType', value)}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="invoice" id={`invoice-${group.id}`} />
                      <Label htmlFor={`invoice-${group.id}`} className="flex items-center gap-1 cursor-pointer">
                        <FileText className="h-4 w-4" />
                        Facture
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="receipt" id={`receipt-${group.id}`} />
                      <Label htmlFor={`receipt-${group.id}`} className="flex items-center gap-1 cursor-pointer">
                        <Receipt className="h-4 w-4" />
                        Reçu
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Group together option */}
                {group.files.length > 1 && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Traitement</Label>
                    <RadioGroup 
                      value={group.groupTogether ? 'together' : 'separate'} 
                      onValueChange={(value) => updateGroupProperty(group.id, 'groupTogether', value === 'together')}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="separate" id={`separate-${group.id}`} />
                        <Label htmlFor={`separate-${group.id}`} className="text-sm cursor-pointer">
                          Séparer
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="together" id={`together-${group.id}`} />
                        <Label htmlFor={`together-${group.id}`} className="text-sm cursor-pointer">
                          Ensemble
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        <Button 
          onClick={handleUpload} 
          disabled={uploading || getTotalFiles() === 0}
          className="w-full"
        >
          {uploading ? 'Upload en cours...' : `Uploader et traiter ${getTotalFiles() > 0 ? `(${getTotalFiles()} fichier${getTotalFiles() > 1 ? 's' : ''})` : ''}`}
        </Button>
      </CardContent>
    </Card>
  );
}
