import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface ModernFileUploadProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
  uploadProgress?: number;
  accept?: Record<string, string[]>;
  maxSize?: number;
  className?: string;
}

export const ModernFileUpload = ({
  onFileSelect,
  isUploading,
  uploadProgress = 0,
  accept = { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
  maxSize = 10 * 1024 * 1024, // 10MB
  className = ''
}: ModernFileUploadProps) => {
  const [dragActive, setDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
    disabled: isUploading,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false)
  });

  const hasError = fileRejections.length > 0;
  const errorMessage = fileRejections[0]?.errors[0]?.message;

  return (
    <div className={`relative ${className}`}>
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer
          ${isDragActive || dragActive 
            ? 'border-primary bg-primary/5 scale-[1.02]' 
            : 'border-border hover:border-primary/60 hover:bg-accent/50'
          }
          ${isUploading ? 'pointer-events-none opacity-75' : ''}
          ${hasError ? 'border-destructive bg-destructive/5' : ''}
          relative overflow-hidden
        `}
      >
        <input {...getInputProps()} />
        
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
        </div>

        <div className="relative z-10">
          {isUploading ? (
            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Conversion en cours...
                </p>
                <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
                <p className="text-xs text-muted-foreground">
                  {uploadProgress}% complété
                </p>
              </div>
            </div>
          ) : hasError ? (
            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                <X className="h-8 w-8 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium text-destructive mb-1">
                  Erreur de fichier
                </p>
                <p className="text-xs text-muted-foreground">
                  {errorMessage}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`
                mx-auto w-16 h-16 rounded-full flex items-center justify-center transition-colors
                ${isDragActive || dragActive 
                  ? 'bg-primary text-primary-foreground scale-110' 
                  : 'bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground'
                }
              `}>
                <Upload className="h-8 w-8" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">
                  {isDragActive ? 'Déposez votre fichier' : 'Uploadez votre papier à en-tête'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Glissez-déposez votre fichier Word ici, ou cliquez pour sélectionner
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                <span className="bg-accent px-2 py-1 rounded-md">
                  <FileText className="h-3 w-3 inline mr-1" />
                  Word uniquement
                </span>
                <span className="bg-accent px-2 py-1 rounded-md">
                  Max 10 MB
                </span>
              </div>

              <Button 
                variant="outline" 
                size="sm"
                className="mt-4"
                type="button"
              >
                Sélectionner un fichier
              </Button>
            </div>
          )}
        </div>

        {/* Success overlay */}
        {uploadProgress === 100 && !isUploading && (
          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
            <div className="bg-white rounded-full p-3 shadow-lg">
              <Check className="h-6 w-6 text-primary" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};