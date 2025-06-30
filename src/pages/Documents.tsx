import { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Upload, Loader2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
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
import { getDocumentDownloadUrl } from "@/lib/utils";
import { ensureDocumentsBucket } from "@/lib/storage";

interface SearchFilters {
  query: string;
  category?: string;
  documentType?: string;
  dateRange?: string;
  keywords?: string[];
}

interface UploadProgress {
  file: File;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  documentId?: string;
}

const Documents = () => {
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({ query: "" });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [isCheckingStorage, setIsCheckingStorage] = useState(true);
  const [uploadQueue, setUploadQueue] = useState<UploadProgress[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { documents, isLoading, refetch, forceRefresh, refreshKey } = useUnifiedDocuments();

  // Fonction pour traiter un seul fichier
  const uploadSingleFile = async (file: File): Promise<string> => {
    const fileId = crypto.randomUUID();
    
    // Nettoyer le nom de fichier
    const cleanFileName = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
    
    const filePath = `${fileId}-${cleanFileName}`;
    
    console.log('📤 Upload du fichier:', filePath);
    
    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) {
      console.error('❌ Erreur upload storage:', uploadError);
      throw uploadError;
    }

    console.log('✅ Fichier uploadé, création de l\'enregistrement...');

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

    if (dbError) {
      console.error('❌ Erreur création document:', dbError);
      throw dbError;
    }

    console.log('📄 Document créé:', document);

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
      console.log('🤖 Lancement du traitement AI...');
      await supabase.functions.invoke('process-document', {
        body: { documentId: document.id }
      });
    }

    return document.id;
  };

  // Traitement séquentiel de la queue d'upload
  const processUploadQueue = async (files: File[]) => {
    if (isProcessingQueue) return;
    
    setIsProcessingQueue(true);
    const initialQueue = files.map(file => ({
      file,
      status: 'uploading' as const,
      progress: 0
    }));
    
    setUploadQueue(initialQueue);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        // Mettre à jour le statut à "uploading"
        setUploadQueue(prev => prev.map((item, index) => 
          index === i ? { ...item, status: 'uploading', progress: 30 } : item
        ));
        
        const documentId = await uploadSingleFile(file);
        
        // Mettre à jour le statut à "processing" et ajouter l'ID du document
        setUploadQueue(prev => prev.map((item, index) => 
          index === i ? { ...item, status: 'processing', progress: 70, documentId } : item
        ));
        
        console.log(`📋 Document ${documentId} ajouté à la liste d'attente de traitement`);
        
      } catch (error: any) {
        console.error('❌ Erreur upload:', error);
        
        setUploadQueue(prev => prev.map((item, index) => 
          index === i ? { 
            ...item, 
            status: 'error', 
            progress: 0, 
            error: error.message 
          } : item
        ));
        
        toast({
          title: "Erreur",
          description: `Erreur lors de l'upload de ${file.name}: ${error.message}`,
          variant: "destructive",
        });
      }
    }
  };

  // Configuration du dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: useCallback((acceptedFiles: File[]) => {
      if (!storageReady) {
        toast({
          title: "Storage non accessible",
          description: "Le système de stockage n'est pas disponible.",
          variant: "destructive",
        });
        return;
      }
      
      if (acceptedFiles.length > 0) {
        processUploadQueue(acceptedFiles);
      }
    }, [storageReady, toast]),
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    disabled: isProcessingQueue || !storageReady
  });

  // Vérifier le storage au chargement
  useEffect(() => {
    const checkStorage = async () => {
      setIsCheckingStorage(true);
      const ready = await ensureDocumentsBucket();
      setStorageReady(ready);
      setIsCheckingStorage(false);
      
      if (!ready) {
        toast({
          title: "Problème de storage",
          description: "Le système de stockage n'est pas accessible. Vérifiez la console pour plus de détails.",
          variant: "destructive",
        });
      }
    };
    
    checkStorage();
  }, [toast]);

  // Écouter les mises à jour des documents pour détecter la fin de traitement
  useEffect(() => {
    if (uploadQueue.length === 0) return;

    console.log('🔄 Setting up document processing completion listener...');
    
    const documentsChannel = supabase
      .channel('document-processing-completion')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'uploaded_documents'
        },
        (payload) => {
          const updatedDoc = payload.new;
          console.log('📄 Document mis à jour:', updatedDoc);
          
          // Trouver le document dans la queue par ID
          const queueIndex = uploadQueue.findIndex(item => item.documentId === updatedDoc.id);
          
          if (queueIndex !== -1) {
            if (updatedDoc.processed) {
              console.log(`✅ Document ${updatedDoc.id} traité avec succès`);
              
              // Mettre à jour la queue d'upload pour marquer le document comme complété
              setUploadQueue(prev => prev.map((item, index) => 
                index === queueIndex ? { ...item, status: 'completed', progress: 100 } : item
              ));
              
              // Vérifier si tous les documents sont traités
              setTimeout(() => {
                setUploadQueue(currentQueue => {
                  const allCompleted = currentQueue.every(item => 
                    item.status === 'completed' || item.status === 'error'
                  );
                  
                  if (allCompleted) {
                    console.log('🎉 Tous les documents ont été traités! Refresh global...');
                    
                    // Nettoyer la queue après un délai pour permettre de voir le statut "completed"
                    setTimeout(() => {
                      setUploadQueue([]);
                      setIsProcessingQueue(false);
                      
                      // Déclencher le refresh global des documents
                      forceRefresh();
                      
                      toast({
                        title: "Traitement terminé",
                        description: "Tous les documents ont été traités avec succès",
                      });
                    }, 2000);
                  }
                  
                  return currentQueue;
                });
              }, 100);
              
            } else if (updatedDoc.ai_summary?.includes('Erreur de traitement')) {
              console.log(`❌ Erreur de traitement pour le document ${updatedDoc.id}`);
              
              // Marquer comme erreur dans la queue
              setUploadQueue(prev => prev.map((item, index) => 
                index === queueIndex ? { 
                  ...item, 
                  status: 'error', 
                  progress: 0, 
                  error: 'Erreur de traitement AI' 
                } : item
              ));
              
              toast({
                title: "Erreur de traitement",
                description: `Problème lors du traitement de ${updatedDoc.original_name}`,
                variant: "destructive",
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🧹 Cleaning up document processing completion listener...');
      supabase.removeChannel(documentsChannel);
    };
  }, [uploadQueue, forceRefresh, toast]);

  // Filtrer les documents selon les critères de recherche
  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    
    return documents.filter(doc => {
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
      
      if (selectedCategory && doc.taxonomy?.category !== selectedCategory) {
        return false;
      }
      
      if (searchFilters.category && doc.taxonomy?.category !== searchFilters.category) {
        return false;
      }
      
      if (searchFilters.documentType && doc.taxonomy?.documentType !== searchFilters.documentType) {
        return false;
      }

      if (searchFilters.keywords && searchFilters.keywords.length > 0) {
        const docKeywords = doc.taxonomy?.keywords || [];
        const hasMatchingKeyword = searchFilters.keywords.some(keyword => 
          docKeywords.includes(keyword)
        );
        if (!hasMatchingKeyword) return false;
      }
      
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
      forceRefresh();
      toast({
        title: "Document supprimé",
        description: "Le document a été supprimé avec succès.",
      });
    }
  });

  const handleDownload = async (document: UnifiedDocumentItem) => {
    if (document.type === 'meeting') {
      navigate(`/meetings/${document.meeting_id}`);
      return;
    }

    try {
      console.log('Téléchargement du document:', document.file_path);
      const downloadUrl = getDocumentDownloadUrl(document.file_path!);
      
      const a = window.document.createElement('a');
      a.href = downloadUrl;
      a.download = document.ai_generated_name || document.original_name;
      a.click();
    } catch (error: any) {
      console.error('Erreur téléchargement:', error);
      toast({
        title: "Erreur",
        description: "Impossible de télécharger le document",
        variant: "destructive",
      });
    }
  };

  const handleDocumentUpdate = () => {
    forceRefresh();
  };

  const handleManualRefresh = () => {
    forceRefresh();
    toast({
      title: "Actualisation",
      description: "La liste des documents et meetings a été actualisée.",
    });
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Gestion des Documents & Meetings</h1>
        <p className="text-muted-foreground">
          Gérez vos documents uploadés et consultez vos meetings transcrits dans une vue unifiée.
        </p>
      </div>

      {/* Upload Section */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-4 w-4" />
            Télécharger des Documents
          </CardTitle>
          <CardDescription className="text-sm">
            Glissez-déposez vos fichiers (PDF, TXT, DOC, DOCX, PPT, PPTX, XLS, XLSX) - traitement séquentiel automatique.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
              ${isProcessingQueue || !storageReady ? 'pointer-events-none opacity-50' : ''}
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
                {!storageReady && (
                  <p className="text-xs text-red-600 mt-2">
                    ⚠️ Upload désactivé - storage non accessible
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Affichage de la queue d'upload */}
          {uploadQueue.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="font-medium text-sm">Progression des uploads :</h4>
              {uploadQueue.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0">
                    {item.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                    {item.status === 'processing' && <Loader2 className="h-4 w-4 animate-spin text-orange-600" />}
                    {item.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {item.status === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.file.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            item.status === 'error' ? 'bg-red-500' : 
                            item.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">
                        {item.status === 'uploading' && 'Upload...'}
                        {item.status === 'processing' && 'Traitement AI...'}
                        {item.status === 'completed' && 'Terminé'}
                        {item.status === 'error' && 'Erreur'}
                      </span>
                    </div>
                    {item.error && (
                      <p className="text-xs text-red-600 mt-1">{item.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DocumentSearchAssistant />

      {documents && documents.length > 0 && (
        <DocumentSearch 
          onSearch={setSearchFilters}
          documents={documents}
        />
      )}

      {documents && documents.length > 0 && (
        <KeywordsDisplay 
          onCategoryClick={setSelectedCategory}
          selectedCategory={selectedCategory}
        />
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                Documents & Meetings 
                {filteredDocuments.length !== documents?.length && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({filteredDocuments.length} sur {documents?.length} éléments)
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Vue unifiée de vos documents uploadés et meetings transcrits. Traitement séquentiel des uploads multiples.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>
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
                    key={`${document.type}-${document.id}-${refreshKey}-${document.processed ? 'processed' : 'processing'}`}
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
