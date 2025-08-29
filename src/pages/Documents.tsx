import { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, Search, FileCheck, Calendar, Filter, Plus, ChevronDown, X, Settings, CheckCircle, Clock, Eye, EyeOff, Folder, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import { DocumentSearch } from "@/components/documents/DocumentSearch";
import { CompactDocumentItem } from "@/components/documents/CompactDocumentItem";
import { DocumentSearchAssistant } from "@/components/documents/DocumentSearchAssistant";
import { KeywordsDisplay } from "@/components/documents/KeywordsDisplay";
import { DocumentCleanupDialog } from "@/components/documents/DocumentCleanupDialog";
import { useUnifiedDocuments } from "@/hooks/useUnifiedDocuments";
import { UnifiedDocumentItem } from "@/types/unified-document";
import { getDocumentDownloadUrl } from "@/lib/utils";
import { ensureDocumentsBucket } from "@/lib/storage";
import { cleanFileName } from "@/utils/fileUtils";

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
  vectorDocumentId?: string;
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

  // NOUVEAU: Fonction pour vérifier si des documents ont déjà été traités
  const checkAlreadyProcessedDocuments = useCallback(async (currentQueue: UploadProgress[]) => {
    if (currentQueue.length === 0) return;
    
    console.log('🔍 Vérification des documents déjà traités...');
    
    const processingDocuments = currentQueue.filter(item => 
      item.status === 'processing' && item.documentId
    );
    
    if (processingDocuments.length === 0) return;
    
    // Récupérer les documents déjà créés dans la table documents
    const documentIds = processingDocuments.map(item => item.documentId).filter(Boolean);
    
    const { data: existingDocs, error } = await supabase
      .from('documents')
      .select('uploaded_document_id')
      .in('uploaded_document_id', documentIds);
    
    if (error) {
      console.error('❌ Erreur vérification documents existants:', error);
      return;
    }
    
    if (existingDocs && existingDocs.length > 0) {
      console.log(`✅ Trouvé ${existingDocs.length} documents déjà traités:`, existingDocs);
      
      // Marquer les documents trouvés comme completed
      const processedIds = existingDocs.map(doc => doc.uploaded_document_id);
      
      setUploadQueue(prev => prev.map(item => {
        if (item.documentId && processedIds.includes(item.documentId)) {
          console.log(`🎉 Marquage du document ${item.documentId} comme traité`);
          return { ...item, status: 'completed' as const, progress: 100 };
        }
        return item;
      }));
      
      // Vérifier si tous sont maintenant terminés
      setTimeout(() => {
        setUploadQueue(currentQueue => {
          const allCompleted = currentQueue.every(item => 
            item.status === 'completed' || item.status === 'error'
          );
          
          if (allCompleted && currentQueue.length > 0) {
            console.log('🎉 Tous les documents traités après vérification initiale!');
            
            setTimeout(() => {
              setUploadQueue([]);
              setIsProcessingQueue(false);
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
    }
  }, [forceRefresh, toast]);

  // NOUVEAU: Polling de récupération pour les documents coincés
  useEffect(() => {
    if (uploadQueue.length === 0) return;
    
    const processingDocs = uploadQueue.filter(item => item.status === 'processing');
    if (processingDocs.length === 0) return;
    
    console.log(`🔄 Démarrage du polling de récupération pour ${processingDocs.length} documents`);
    
    const recoveryInterval = setInterval(async () => {
      console.log('🔍 Vérification de récupération des documents...');
      await checkAlreadyProcessedDocuments(uploadQueue);
    }, 10000); // Vérification toutes les 10 secondes
    
    return () => {
      clearInterval(recoveryInterval);
      console.log('🧹 Arrêt du polling de récupération');
    };
  }, [uploadQueue, checkAlreadyProcessedDocuments]);

  // Fonction pour générer un nom de fichier unique
  const generateUniqueFileName = async (baseName: string, extension: string): Promise<string> => {
    let counter = 0;
    let fileName = `${baseName}.${extension}`;
    
    while (true) {
      // Vérifier si le fichier existe déjà dans le storage
      const { data, error } = await supabase.storage
        .from('documents')
        .list('', { search: fileName });
      
      if (error) {
        console.error('Erreur lors de la vérification du fichier:', error);
        break;
      }
      
      // Si aucun fichier trouvé avec ce nom, on peut l'utiliser
      if (!data || data.length === 0) {
        break;
      }
      
      // Si le fichier existe, ajouter un numéro
      counter++;
      fileName = `${baseName}-${counter}.${extension}`;
    }
    
    return fileName;
  };

  // Fonction pour traiter un seul fichier
  const uploadSingleFile = async (file: File): Promise<string> => {
    const fileId = crypto.randomUUID();
    
    // Utiliser un nom temporaire pendant l'upload initial
    const tempFileName = cleanFileName(file.name);
    const tempFilePath = `temp_${fileId}_${tempFileName}`;
    
    console.log('📤 Upload temporaire du fichier:', tempFilePath);
    
    // Upload to storage avec nom temporaire
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(tempFilePath, file);

    if (uploadError) {
      console.error('❌ Erreur upload storage:', uploadError);
      throw uploadError;
    }

    console.log('✅ Fichier uploadé temporairement, création de l\'enregistrement...');

    // Create document record avec le chemin temporaire
    const { data: document, error: dbError } = await supabase
      .from('uploaded_documents')
      .insert({
        original_name: file.name,
        file_path: tempFilePath,
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
    
    // NOUVEAU: Vérifier immédiatement après l'upload si certains sont déjà traités
    setTimeout(() => {
      setUploadQueue(currentQueue => {
        checkAlreadyProcessedDocuments(currentQueue);
        return currentQueue;
      });
    }, 2000);
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

  // Logique améliorée pour suivre le traitement des documents
  useEffect(() => {
    if (uploadQueue.length === 0) return;

    console.log('🔄 Setting up enhanced document processing listener...');
    
    const processingChannel = supabase
      .channel('document-processing-tracking')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'uploaded_documents'
        },
        async (payload) => {
          const updatedDoc = payload.new;
          console.log('📄 Document uploaded_documents mis à jour:', updatedDoc);
          
          // Si le document a été traité et a un nom AI généré, renommer le fichier
          if (updatedDoc.processed && updatedDoc.ai_generated_name && updatedDoc.file_path?.startsWith('temp_')) {
            console.log('🔄 Renommage du fichier avec le titre AI...');
            
            try {
              // Extraire l'extension du fichier original
              const extension = updatedDoc.original_name.split('.').pop();
              
              // Nettoyer le nom AI généré et générer un nom de fichier unique
              const cleanedAiName = cleanFileName(updatedDoc.ai_generated_name);
              const baseNameWithoutExtension = cleanedAiName.replace(/\.[^/.]+$/, '');
              const uniqueFileName = await generateUniqueFileName(baseNameWithoutExtension, extension);
              
              console.log('🎯 Nom de fichier unique généré:', uniqueFileName);
              
              // Copier le fichier avec le nouveau nom unique
              const { error: copyError } = await supabase.storage
                .from('documents')
                .copy(updatedDoc.file_path, uniqueFileName);
              
              if (!copyError) {
                // Supprimer l'ancien fichier temporaire
                await supabase.storage
                  .from('documents')
                  .remove([updatedDoc.file_path]);
                
                // Mettre à jour le chemin dans la base de données
                await supabase
                  .from('uploaded_documents')
                  .update({ file_path: uniqueFileName })
                  .eq('id', updatedDoc.id);
                
                console.log('✅ Fichier renommé avec nom unique:', uniqueFileName);
              }
            } catch (error) {
              console.error('❌ Erreur lors du renommage:', error);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'documents'
        },
        (payload) => {
          const newVectorDoc = payload.new;
          console.log('🗂️ Nouveau document vectoriel créé:', newVectorDoc);
          
          // Vérifier si ce document correspond à un upload en cours
          if (newVectorDoc.uploaded_document_id) {
            console.log(`🎯 Document vectoriel créé pour uploaded_document_id: ${newVectorDoc.uploaded_document_id}`);
            
            // Chercher dans la queue d'upload
            const queueIndex = uploadQueue.findIndex(item => 
              item.documentId === newVectorDoc.uploaded_document_id
            );
            
            if (queueIndex !== -1) {
              console.log(`✅ Correspondance trouvée dans la queue! Index: ${queueIndex}`);
              
              // Marquer comme traité
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
                    console.log('🎉 Tous les documents traités! Nettoyage et refresh...');
                    
                    // Nettoyer la queue et refresher
                    setTimeout(() => {
                      setUploadQueue([]);
                      setIsProcessingQueue(false);
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
            } else {
              console.log(`⚠️ Aucune correspondance trouvée pour uploaded_document_id: ${newVectorDoc.uploaded_document_id}`);
            }
          } else {
            console.log('⚠️ Document vectoriel créé sans uploaded_document_id (probablement un meeting)');
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🧹 Cleaning up enhanced document processing listener...');
      supabase.removeChannel(processingChannel);
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

  // Delete mutation - améliorer la gestion d'erreur
  const deleteMutation = useMutation({
    mutationFn: async (document: UnifiedDocumentItem) => {
      if (document.type === 'meeting') {
        throw new Error('Impossible de supprimer un meeting depuis cette page');
      }

      console.log(`🗑️ Attempting to delete document: ${document.id}`);
      console.log(`📁 File path: ${document.file_path}`);

      // Vérifier d'abord si le fichier existe dans le storage
      let fileExists = false;
      if (document.file_path) {
        try {
          const { data: fileList } = await supabase.storage
            .from('documents')
            .list('', { search: document.file_path });
          
          fileExists = fileList && fileList.length > 0;
          console.log(`📋 File exists in storage: ${fileExists}`);
        } catch (error) {
          console.warn('⚠️ Could not check file existence:', error);
        }
      }

      // Supprimer le fichier du storage seulement s'il existe
      if (document.file_path && fileExists) {
        console.log('🗑️ Deleting file from storage...');
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([document.file_path]);

        if (storageError) {
          console.error('❌ Storage deletion failed:', storageError);
          // Ne pas échouer si le fichier n'existe pas (404)
          if (!storageError.message.includes('not found') && !storageError.message.includes('404')) {
            throw new Error(`Erreur lors de la suppression du fichier: ${storageError.message}`);
          }
        } else {
          console.log('✅ File deleted from storage');
        }
      } else {
        console.log('⚠️ File not found in storage, skipping storage deletion');
      }

      // Supprimer l'enregistrement de la base de données
      console.log('🗑️ Deleting database record...');
      const { error: dbError } = await supabase
        .from('uploaded_documents')
        .delete()
        .eq('id', document.id);

      if (dbError) {
        console.error('❌ Database deletion failed:', dbError);
        throw new Error(`Erreur lors de la suppression de l'enregistrement: ${dbError.message}`);
      }

      console.log('✅ Document deleted successfully');
    },
    onSuccess: () => {
      forceRefresh();
      toast({
        title: "Document supprimé",
        description: "Le document a été supprimé avec succès.",
      });
    },
    onError: (error: any) => {
      console.error('❌ Delete mutation failed:', error);
      toast({
        title: "Erreur de suppression",
        description: error.message || "Une erreur est survenue lors de la suppression",
        variant: "destructive",
      });
    }
  });

  const handleDownload = async (document: UnifiedDocumentItem) => {
    if (document.type === 'meeting') {
      navigate(`/meetings/${document.meeting_id}`);
      return;
    }

    try {
      console.log('📥 Attempting to download document:', document.file_path);
      
      if (!document.file_path) {
        throw new Error('Chemin du fichier non disponible');
      }

      // Vérifier si le fichier existe avant de tenter le téléchargement
      const { data: fileList, error: listError } = await supabase.storage
        .from('documents')
        .list('', { search: document.file_path });

      if (listError) {
        console.error('❌ Error checking file existence:', listError);
        throw new Error('Erreur lors de la vérification du fichier');
      }

      if (!fileList || fileList.length === 0) {
        console.error('❌ File not found in storage:', document.file_path);
        toast({
          title: "Fichier introuvable",
          description: "Le fichier n'existe plus dans le stockage. Vous pouvez supprimer cet enregistrement.",
          variant: "destructive",
        });
        return;
      }

      console.log('✅ File found, generating download URL...');
      const downloadUrl = getDocumentDownloadUrl(document.file_path);
      
      const a = window.document.createElement('a');
      a.href = downloadUrl;
      a.download = document.ai_generated_name || document.original_name;
      a.click();
      
      console.log('✅ Download initiated successfully');
    } catch (error: any) {
      console.error('❌ Download error:', error);
      toast({
        title: "Erreur de téléchargement",
        description: error.message || "Impossible de télécharger le document",
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
    <div className="space-y-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gestion des Documents & Meetings</h1>
          <p className="text-muted-foreground">
            Gérez vos documents uploadés et consultez vos meetings transcrits dans une vue unifiée.
          </p>
        </div>
      </header>

      {/* Upload Section */}
      <Card className="mb-4 shadow-md hover:shadow-lg transition-shadow bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-600" />
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
        <Card className="mb-4 shadow-md hover:shadow-lg transition-shadow bg-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                  <Folder className="h-5 w-5 text-blue-600" />
                  Documents & Meetings 
                  {filteredDocuments.length !== documents?.length && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({filteredDocuments.length} sur {documents?.length} éléments)
                    </span>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Vue unifiée de vos documents uploadés et meetings transcrits.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <DocumentCleanupDialog 
                  documents={documents}
                  onCleanupComplete={handleDocumentUpdate}
                />
              </div>
            </div>

            <DocumentSearch 
              onSearch={setSearchFilters}
              documents={documents}
            />
            
            <div className="mt-4">
              <KeywordsDisplay 
                onCategoryClick={setSelectedCategory}
                selectedCategory={selectedCategory}
              />
            </div>

            <div className="mt-6">
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
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Documents;
