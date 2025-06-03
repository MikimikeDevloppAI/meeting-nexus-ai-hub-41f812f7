import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Upload, Trash2, Download, Eye, Loader2, CheckCircle, FileSearch, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { DocumentSearch } from "@/components/documents/DocumentSearch";
import { ProcessingResults } from "@/components/documents/ProcessingResults";
import { DocumentChat } from "@/components/documents/DocumentChat";

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
  extracted_text: string | null;
}

interface SearchFilters {
  query: string;
  category?: string;
  documentType?: string;
  dateRange?: string;
  keywords?: string[];
}

const Documents = () => {
  const [selectedDocument, setSelectedDocument] = useState<UploadedDocument | null>(null);
  const [chatDocument, setChatDocument] = useState<UploadedDocument | null>(null);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({ query: "" });
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

  // Filtrer les documents selon les critères de recherche
  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    
    return documents.filter(doc => {
      // Filtre par texte de recherche
      if (searchFilters.query) {
        const query = searchFilters.query.toLowerCase();
        const searchableText = [
          doc.original_name,
          doc.ai_generated_name,
          doc.ai_summary,
          doc.extracted_text
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchableText.includes(query)) return false;
      }
      
      // Filtre par catégorie
      if (searchFilters.category && doc.taxonomy?.category !== searchFilters.category) {
        return false;
      }
      
      // Filtre par type de document
      if (searchFilters.documentType && doc.taxonomy?.documentType !== searchFilters.documentType) {
        return false;
      }

      // Filtre par mots-clés
      if (searchFilters.keywords && searchFilters.keywords.length > 0) {
        const docKeywords = doc.taxonomy?.keywords || [];
        const hasMatchingKeyword = searchFilters.keywords.some(keyword => 
          docKeywords.includes(keyword)
        );
        if (!hasMatchingKeyword) return false;
      }
      
      // Filtre par date
      if (searchFilters.dateRange) {
        const docDate = new Date(doc.created_at);
        const now = new Date();
        
        switch (searchFilters.dateRange) {
          case 'today':
            if (docDate.toDateString() !== now.toDateString()) return false;
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (docDate < weekAgo) return false;
            break;
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            if (docDate < monthAgo) return false;
            break;
        }
      }
      
      return true;
    });
  }, [documents, searchFilters]);

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

      // Process with AI if it's a supported file type
      if (['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
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
        description: "Le traitement du document a démarré.",
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
      const a = window.document.createElement('a');
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

  const formatTextLength = (text: string | null) => {
    if (!text) return 'N/A';
    return `${text.length.toLocaleString()} caractères`;
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Gestion des Documents</h1>
        <p className="text-muted-foreground">
          Téléchargez et gérez vos documents avec traitement automatique par IA et extraction de texte.
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
            Glissez-déposez vos fichiers (PDF, TXT, DOC, DOCX) pour un traitement automatique avec extraction de texte complète.
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
            <div className="flex items-center justify-center mb-4">
              <FileText className="h-12 w-12 text-muted-foreground" />
            </div>
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

      {/* Search Section */}
      {documents && documents.length > 0 && (
        <DocumentSearch 
          onSearch={setSearchFilters}
          documents={documents}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Documents List */}
        <Card>
          <CardHeader>
            <CardTitle>
              Documents Uploadés 
              {filteredDocuments.length !== documents?.length && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({filteredDocuments.length} sur {documents?.length} documents)
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Liste de vos documents avec traitement automatique par IA et texte extrait.
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
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun document ne correspond à votre recherche
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {filteredDocuments.map((document) => (
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
                              <Badge variant="secondary" className="bg-blue-500 text-white">
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                En traitement...
                              </Badge>
                            )}
                            {document.extracted_text && (
                              <Badge variant="outline" className="bg-purple-50">
                                <FileSearch className="h-3 w-3 mr-1" />
                                Texte extrait
                              </Badge>
                            )}
                          </div>
                          
                          {document.ai_generated_name && document.original_name !== document.ai_generated_name && (
                            <p className="text-sm text-muted-foreground mb-2">
                              Nom original: {document.original_name}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{formatFileSize(document.file_size)}</span>
                            <span>{new Date(document.created_at).toLocaleDateString('fr-FR')}</span>
                            {document.content_type && <span>{document.content_type}</span>}
                            {document.extracted_text && <span>{formatTextLength(document.extracted_text)}</span>}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {document.processed && document.extracted_text && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setChatDocument(document)}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          )}
                          {document.extracted_text && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedDocument(document)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
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
                      
                      <ProcessingResults document={document} />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Document Chat */}
        {chatDocument && (
          <div className="lg:col-span-1">
            <DocumentChat 
              document={chatDocument}
              onClose={() => setChatDocument(null)}
            />
          </div>
        )}
      </div>

      {/* Text Preview Dialog */}
      {selectedDocument && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Texte extrait - {selectedDocument.ai_generated_name || selectedDocument.original_name}</span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedDocument(null)}
                >
                  Fermer
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[60vh]">
                <div className="whitespace-pre-wrap text-sm font-mono bg-gray-50 p-4 rounded">
                  {selectedDocument.extracted_text || 'Aucun texte extrait disponible'}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Documents;
