
import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface InvoiceUploadFormProps {
  onUploadSuccess: () => void;
}

interface FileWithMetadata {
  file: File;
  documentType: 'invoice' | 'receipt';
  compte: 'David Tabibian' | 'Commun';
}

export function InvoiceUploadForm({ onUploadSuccess }: InvoiceUploadFormProps) {
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [uploading, setUploading] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: true,
    onDrop: (acceptedFiles) => {
      const newFiles = acceptedFiles.map(file => ({
        file,
        documentType: 'invoice' as const,
        compte: 'Commun' as const
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const updateFileType = (index: number, documentType: 'invoice' | 'receipt') => {
    setFiles(prev => prev.map((item, i) => 
      i === index ? { ...item, documentType } : item
    ));
  };

  const updateFileCompte = (index: number, compte: 'David Tabibian' | 'Commun') => {
    setFiles(prev => prev.map((item, i) => 
      i === index ? { ...item, compte } : item
    ));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Veuillez sélectionner au moins un fichier");
      return;
    }

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const { file, documentType, compte } of files) {
        try {
          console.log(`Processing file: ${file.name} as ${documentType} for ${compte}`);
          
          // Generate unique filename
          const timestamp = Date.now();
          const cleanFileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          
          // Upload to storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('invoices')
            .upload(cleanFileName, file);

          if (uploadError) {
            throw new Error(`Upload error: ${uploadError.message}`);
          }

          // Create invoice record
          const { data: invoice, error: insertError } = await supabase
            .from('invoices')
            .insert({
              original_filename: file.name,
              file_path: uploadData.path,
              file_size: file.size,
              content_type: file.type,
              compte: compte,
              status: 'pending'
            })
            .select()
            .single();

          if (insertError) {
            throw new Error(`Database error: ${insertError.message}`);
          }

          // Process with appropriate API based on document type
          const { error: processError } = await supabase.functions.invoke('process-invoice', {
            body: { 
              invoiceId: invoice.id,
              documentType: documentType
            }
          });

          if (processError) {
            throw new Error(`Processing error: ${processError.message}`);
          }

          successCount++;
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
          errorCount++;
        }
      }

      // Show results
      if (successCount > 0) {
        toast.success(`${successCount} fichier(s) uploadé(s) et en cours de traitement`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} fichier(s) ont échoué`);
      }

      // Reset if at least one success
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
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
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
                PDF, JPG, PNG (max 5MB par fichier) - Sélection multiple possible
              </div>
            </div>
          </div>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Fichiers sélectionnés ({files.length})</h4>
            {files.map((item, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm flex-1">
                    <FileText className="h-4 w-4" />
                    <span className="flex-1">{item.file.name}</span>
                    <span className="text-gray-500">({(item.file.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Document Type */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700">Type de document</Label>
                    <RadioGroup 
                      value={item.documentType} 
                      onValueChange={(value: 'invoice' | 'receipt') => updateFileType(index, value)}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="invoice" id={`invoice-${index}`} />
                        <Label htmlFor={`invoice-${index}`} className="text-sm">Facture</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="receipt" id={`receipt-${index}`} />
                        <Label htmlFor={`receipt-${index}`} className="text-sm">Reçu</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Account */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700">Compte</Label>
                    <RadioGroup 
                      value={item.compte} 
                      onValueChange={(value: 'David Tabibian' | 'Commun') => updateFileCompte(index, value)}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Commun" id={`commun-${index}`} />
                        <Label htmlFor={`commun-${index}`} className="text-sm">Commun</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="David Tabibian" id={`david-${index}`} />
                        <Label htmlFor={`david-${index}`} className="text-sm">David Tabibian</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button 
          onClick={handleUpload} 
          disabled={uploading || files.length === 0}
          className="w-full"
        >
          {uploading ? 'Upload en cours...' : `Uploader et traiter ${files.length > 0 ? `(${files.length} fichier${files.length > 1 ? 's' : ''})` : ''}`}
        </Button>
      </CardContent>
    </Card>
  );
}
