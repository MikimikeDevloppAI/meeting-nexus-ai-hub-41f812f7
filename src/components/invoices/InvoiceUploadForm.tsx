
import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InvoiceUploadFormProps {
  onUploadSuccess: () => void;
}

export function InvoiceUploadForm({ onUploadSuccess }: InvoiceUploadFormProps) {
  const [files, setFiles] = useState<File[]>([]);
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
    onDrop: (acceptedFiles) => {
      setFiles(acceptedFiles);
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

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Veuillez sélectionner un fichier");
      return;
    }

    const cabinetPercentage = 100 - davidPercentage;

    setUploading(true);
    
    try {
      for (const file of files) {
        // Generate unique filename
        const timestamp = Date.now();
        const fileName = `${timestamp}-${file.name}`;
        
        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('invoices')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Erreur lors de l'upload de ${file.name}`);
          continue;
        }

        // Create invoice record
        const { data: invoice, error: insertError } = await supabase
          .from('invoices')
          .insert({
            original_filename: file.name,
            file_path: uploadData.path,
            file_size: file.size,
            content_type: file.type,
            david_percentage: davidPercentage,
            cabinet_percentage: cabinetPercentage,
            status: 'pending'
          })
          .select()
          .single();

        if (insertError) {
          console.error('Insert error:', insertError);
          toast.error(`Erreur lors de la création de l'enregistrement pour ${file.name}`);
          continue;
        }

        // Process with Mindee API
        const { error: processError } = await supabase.functions.invoke('process-invoice', {
          body: { invoiceId: invoice.id }
        });

        if (processError) {
          console.error('Process error:', processError);
          toast.error(`Erreur lors du traitement de ${file.name}`);
        } else {
          toast.success(`${file.name} uploadé et en cours de traitement`);
        }
      }

      setFiles([]);
      onUploadSuccess();
    } catch (error) {
      console.error('Unexpected error:', error);
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
          <Label className="text-sm font-medium">Fichier</Label>
          <div
            {...getRootProps()}
            className={`mt-2 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'}
            `}
          >
            <input {...getInputProps()} />
            {files.length > 0 ? (
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-center gap-2 text-sm">
                    <FileText className="h-4 w-4" />
                    <span>{file.name}</span>
                    <span className="text-gray-500">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                ))}
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
                  PDF, JPG, PNG (max 10MB)
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Allocation */}
        <div>
          <Label className="text-sm font-medium mb-3 block">Répartition</Label>
          <RadioGroup value={allocation} onValueChange={handleAllocationChange}>
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
          {uploading ? 'Upload en cours...' : 'Uploader et traiter'}
        </Button>
      </CardContent>
    </Card>
  );
}
