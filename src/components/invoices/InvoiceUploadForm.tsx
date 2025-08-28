import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InvoiceUploadFormProps {
  onUploadSuccess: () => void;
}

interface FileWithMetadata {
  file: File;
}

export function InvoiceUploadForm({ onUploadSuccess }: InvoiceUploadFormProps) {
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [uploading, setUploading] = useState(false);

  const onDrop = (acceptedFiles: File[]) => {
    const filesWithMetadata: FileWithMetadata[] = acceptedFiles.map(file => ({
      file
    }));
    setFiles(prev => [...prev, ...filesWithMetadata]);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: true,
    onDrop
  });

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
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
      for (const fileItem of files) {
        try {
          console.log(`Processing file: ${fileItem.file.name}`);
          
          // Generate unique filename
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(2, 8);
          const fileName = `${timestamp}-${randomSuffix}-${fileItem.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          
          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from('invoices')
            .upload(fileName, fileItem.file);

          if (uploadError) {
            throw new Error(`Upload error: ${uploadError.message}`);
          }

          // Create invoice record
          const { data: invoiceData, error: insertError } = await supabase
            .from('invoices')
            .insert({
              original_filename: fileItem.file.name,
              file_path: fileName,
              content_type: fileItem.file.type,
              file_size: fileItem.file.size,
              status: 'pending'
            })
            .select()
            .single();

          if (insertError) {
            throw new Error(`Database error: ${insertError.message}`);
          }

          // Traitement avec OpenAI Vision
          const { error: processError } = await supabase.functions.invoke('process-invoice-openai', {
            body: { 
              invoiceId: invoiceData.id
            }
          });

          if (processError) {
            console.error('Processing error:', processError);
            // Ne pas faire échouer l'upload, juste loguer l'erreur
            toast.warning(`Fichier ${fileItem.file.name} uploadé mais erreur de traitement`);
          } else {
            console.log(`Successfully processed ${fileItem.file.name}`);
          }

          successCount++;
        } catch (error) {
          console.error(`Error processing file ${fileItem.file.name}:`, error);
          errorCount++;
          toast.error(`Erreur avec ${fileItem.file.name}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        }
      }

      // Show results
      if (successCount > 0) {
        toast.success(`${successCount} fichier(s) uploadé(s) et en cours de traitement automatique`);
        setFiles([]);
        onUploadSuccess();
      }
      
      if (errorCount > 0) {
        toast.error(`${errorCount} fichier(s) ont échoué lors de l'upload`);
      }

    } catch (error) {
      console.error('Unexpected error during upload process:', error);
      toast.error("Une erreur inattendue s'est produite");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Nouvelle facture/reçu
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
            {files.map((fileItem, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm flex-1">
                    <FileText className="h-4 w-4" />
                    <span className="flex-1">{fileItem.file.name}</span>
                    <span className="text-gray-500">({(fileItem.file.size / 1024 / 1024).toFixed(2)} MB)</span>
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
                
                <div className="text-sm text-muted-foreground mt-2">
                  L'IA analysera automatiquement le type de document, le fournisseur, et les autres informations.
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
          {uploading ? 'Upload en cours...' : `Uploader et traiter automatiquement ${files.length > 0 ? `(${files.length} fichier${files.length > 1 ? 's' : ''})` : ''}`}
        </Button>
      </CardContent>
    </Card>
  );
}