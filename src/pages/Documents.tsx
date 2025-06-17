
import { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import { DocumentSearch } from "@/components/documents/DocumentSearch";
import { CompactDocumentItem } from "@/components/documents/CompactDocumentItem";
import { DocumentSearchAssistant } from "@/components/documents/DocumentSearchAssistant";
import { KeywordsDisplay } from "@/components/documents/KeywordsDisplay";
import { useUnifiedDocuments } from "@/hooks/useUnifiedDocuments";
import { UnifiedDocumentItem } from "@/types/unified-document";

interface SearchFilters {
  query: string;
  category?: string;
  documentType?: string;
  dateRange?: string;
  keywords?: string[];
}

const Documents = () => {
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({ query: "" });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Utiliser le nouveau hook pour les données unifiées
  const { documents, isLoading, refetch } = useUnifiedDocuments();

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileId = crypto.randomUUID();
      
      // Nettoyer le nom de fichier pour éviter les caractères spéciaux
      const cleanFileName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
        .replace(/[^a-zA-Z0-9.-]/g, '_') // Remplacer les caractères spéciaux par _
        .replace(/_{2,}/g, '_') // Éviter les underscores multiples
        .toLowerCase();
      
      const filePath = `${fileId}-${cleanFileName}`;
      
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
      if ([
        'application/pdf', 
        'text/plain', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ].includes(file.type)) {
        await supabase.functions.invoke('process-document', {
          body: { documentId: document.id }
        });
      }

      return document;
    },
    onSuccess: () => {
      refetch();
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
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    }
  });

  // Écouter les mises à jour en temps réel pour les deux tables
  useEffect(() => {
    console.log('Setting up real-time subscription for unified documents...');
    
    const documentsChannel = supabase
      .channel('documents-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'uploaded_documents'
        },
        (payload) => {
          console.log('Document updated via real-time:', payload);
          refetch();
          
          // Show toast when a document is processed
          if (payload.eventType === 'UPDATE' && payload.new.processed && !payload.old?.processed) {
            toast({
              title: "Document traité",
              description: `${payload.new.ai_generated_name || payload.new.original_name} a été traité avec succès`,
            });
          }
        }
      )
      .subscribe();

    const meetingsChannel = supabase
      .channel('meetings-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meetings'
        },
        (payload) => {
          console.log('Meeting updated via real-time:', payload);
          refetch();
          
          // Show toast when a meeting is processed
          if (payload.eventType === 'UPDATE' && payload.new.transcript && !payload.old?.transcript) {
            toast({
              title: "Meeting traité",
              description: `${payload.new.title} a été traité avec succès`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up real-time subscriptions...');
      supabase.removeChannel(documentsChannel);
      supabase.removeChannel(meetingsChannel);
    };
  }, [refetch, toast]);

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
          doc.extracted_text,
          doc.participants?.map(p => p.name).join(' ')
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchableText.includes(query)) return false;
      }
      
      // Filtre par catégorie sélectionnée
      if (selectedCategory && doc.taxonomy?.category !== selectedCategory) {
        return false;
      }
      
      // Filtre par catégorie des filtres de recherche
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
  }, [documents, searchFilters, selectedCategory]);

  // Delete mutation - seulement pour les documents
  const deleteMutation = useMutation({
    mutationFn: async (document: UnifiedDocumentItem) => {
      if (document.type === 'meeting') {
        throw new Error('Impossible de supprimer un meeting depuis cette page');
      }

      // Delete from storage
      if (document.file_path) {
        await supabase.storage
          .from('documents')
          .remove([document.file_path]);
      }

      // Delete from database
      const { error } = await supabase
        .from('uploaded_documents')
        .delete()
        .eq('id', document.id);

      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Document supprimé",
        description: "Le document a été supprimé avec succès.",
      });
    }
  });

  const handleDownload = async (document: UnifiedDocumentItem) => {
    if (document.type === 'meeting') {
      // Rediriger vers la page du meeting
      navigate(`/meetings/${document.meeting_id}`);
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.file_path!);

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

  const handleDocumentUpdate = () => {
    refetch();
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Gestion des Documents & Meetings</h1>
        <p className="text-muted-foreground">
          Gérez vos documents uploadés et consultez vos meetings transcrits dans une vue unifiée.
        </p>
      </div>

      {/* Upload Section - Plus compact et en haut */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-4 w-4" />
            Télécharger des Documents
          </CardTitle>
          <CardDescription className="text-sm">
            Glissez-déposez vos fichiers (PDF, TXT, DOC, DOCX, PPT, PPTX, XLS, XLSX) pour un traitement automatique.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
              ${uploadMutation.isPending ? 'pointer-events-none opacity-50' : ''}
            `}
          >
            <input {...getInputProps()} />
            <div className="flex items-center justify-center mb-2">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            {isDragActive ? (
              <p className="text-sm">Déposez les fichiers ici...</p>
            ) : (
              <div>
                <p className="font-medium mb-1">
                  Glissez-déposez vos documents ici
                </p>
                <p className="text-sm text-muted-foreground">
                  ou cliquez pour sélectionner des fichiers
                </p>
              </div>
            )}
          </div>
          {uploadMutation.isPending && (
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Upload en cours...</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assistant de recherche */}
      <DocumentSearchAssistant />

      {/* Search Section */}
      {documents && documents.length > 0 && (
        <DocumentSearch 
          onSearch={setSearchFilters}
          documents={documents}
        />
      )}

      {/* Filtre par catégories */}
      {documents && documents.length > 0 && (
        <KeywordsDisplay 
          onCategoryClick={setSelectedCategory}
          selectedCategory={selectedCategory}
        />
      )}

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Documents & Meetings 
            {filteredDocuments.length !== documents?.length && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({filteredDocuments.length} sur {documents?.length} éléments)
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Vue unifiée de vos documents uploadés et meetings transcrits. Cliquez sur un élément pour voir le détail.
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
              Aucun document ou meeting pour le moment
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun élément ne correspond à votre recherche
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {filteredDocuments.map((document) => (
                  <CompactDocumentItem
                    key={`${document.type}-${document.id}`}
                    document={document}
                    onDownload={() => handleDownload(document)}
                    onDelete={() => deleteMutation.mutate(document)}
                    isDeleting={deleteMutation.isPending}
                    onUpdate={handleDocumentUpdate}
                  />
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
