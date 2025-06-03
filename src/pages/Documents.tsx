
import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { FileText, Upload, Trash2, Download, Eye, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";

interface UploadedDocument {
  id: string;
  original_name: string;
  ai_generated_name: string | null;
  file_path: string;
  file_size: number | null;
  content_type: string | null;
  taxonomy: any;
  ai_summary: string | null;
  processed: boolean;
  created_at: string;
  created_by: string;
}

const Documents = () => {
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch documents
  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uploaded_documents')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as UploadedDocument[];
    }
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileId = crypto.randomUUID();
      const filePath = `${fileId}-${file.name}`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { data: document, error: dbError } = await supabase
        .from('uploaded_documents')
        .insert({
          original_name: file.name,
          file_path: filePath,
          file_size: file.size,
          content_type: file.type,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Process with AI if it's a PDF
      if (file.type === 'application/pdf') {
        await supabase.functions.invoke('process-document', {
          body: { documentId: document.id }
        });
      }

      return document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({
        title: "Document uploadé",
        description: "Le document a été uploadé et est en cours de traitement.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (document: UploadedDocument) => {
      // Delete from storage
      await supabase.storage
        .from('documents')
        .remove([document.file_path]);

      // Delete from database
      const { error } = await supabase
        .from('uploaded_documents')
        .delete()
        .eq('id', document.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({
        title: "Document supprimé",
        description: "Le document a été supprimé avec succès.",
      });
    }
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      uploadMutation.mutate(file);
    });
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    }
  });

  const downloadDocument = async (document: UploadedDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.ai_generated_name || document.original_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de télécharger le document",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Gestion des Documents</h1>
        <p className="text-muted-foreground">
          Téléchargez et gérez vos documents. Les PDFs sont automatiquement traités par IA.
        </p>
      </div>

      {/* Upload Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Télécharger des Documents
          </CardTitle>
          <CardDescription>
            Glissez-déposez vos fichiers ou cliquez pour sélectionner (PDF, TXT, DOC, DOCX)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
              ${uploadMutation.isPending ? 'pointer-events-none opacity-50' : ''}
            `}
          >
            <input {...getInputProps()} />
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p>Déposez les fichiers ici...</p>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">
                  Glissez-déposez vos documents ici
                </p>
                <p className="text-muted-foreground">
                  ou cliquez pour sélectionner des fichiers
                </p>
              </div>
            )}
          </div>
          {uploadMutation.isPending && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Upload en cours...</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>Documents Uploadés</CardTitle>
          <CardDescription>
            Liste de tous vos documents avec leur statut de traitement
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Chargement...</span>
            </div>
          ) : !documents || documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun document uploadé pour le moment
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {documents.map((document) => (
                  <div
                    key={document.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4" />
                          <h3 className="font-medium">
                            {document.ai_generated_name || document.original_name}
                          </h3>
                          {document.processed ? (
                            <Badge variant="default" className="bg-green-500">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Traité
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              En traitement
                            </Badge>
                          )}
                        </div>
                        
                        {document.original_name !== document.ai_generated_name && (
                          <p className="text-sm text-muted-foreground mb-2">
                            Nom original: {document.original_name}
                          </p>
                        )}
                        
                        {document.ai_summary && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {document.ai_summary}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{formatFileSize(document.file_size)}</span>
                          <span>{new Date(document.created_at).toLocaleDateString('fr-FR')}</span>
                          {document.content_type && <span>{document.content_type}</span>}
                        </div>
                        
                        {document.taxonomy && Object.keys(document.taxonomy).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {document.taxonomy.category && (
                              <Badge variant="outline" className="text-xs">
                                {document.taxonomy.category}
                              </Badge>
                            )}
                            {document.taxonomy.subcategory && (
                              <Badge variant="outline" className="text-xs">
                                {document.taxonomy.subcategory}
                              </Badge>
                            )}
                            {document.taxonomy.keywords?.slice(0, 3).map((keyword: string, index: number) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadDocument(document)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteMutation.mutate(document)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Documents;
