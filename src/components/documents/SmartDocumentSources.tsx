
import { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import { DocumentViewer } from "./DocumentViewer";
import { CompactDocumentItem } from "./CompactDocumentItem";
import { UnifiedDocumentItem } from "@/types/unified-document";
import { supabase } from "@/integrations/supabase/client";

interface DocumentSource {
  documentId: string;
  documentName: string;
  maxSimilarity: number;
  chunksCount: number;
  documentType?: string;
  relevantChunks?: string[];
}

interface SmartDocumentSourcesProps {
  sources: DocumentSource[];
  title?: string;
}

export const SmartDocumentSources = ({ sources, title = "Documents sources utilisés" }: SmartDocumentSourcesProps) => {
  const [selectedDocument, setSelectedDocument] = useState<UnifiedDocumentItem | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [realDocuments, setRealDocuments] = useState<UnifiedDocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  if (!sources || sources.length === 0) {
    return null;
  }

  // Filtrer pour garder uniquement les documents vraiment pertinents
  const relevantSources = sources.filter(source => source.maxSimilarity > 0.3);
  const displaySources = relevantSources.length > 0 ? relevantSources : sources.slice(0, 1);

  // Fonction pour récupérer les détails complets des documents depuis Supabase
  const fetchDocumentDetails = async (sources: DocumentSource[]): Promise<UnifiedDocumentItem[]> => {
    const documents: UnifiedDocumentItem[] = [];

    for (const source of sources) {
      try {
        // Essayer d'abord comme meeting
        if (source.documentType === 'meeting') {
          const { data: meeting, error: meetingError } = await supabase
            .from('meetings')
            .select(`
              *,
              meeting_participants (
                participants (
                  name,
                  email
                )
              )
            `)
            .eq('id', source.documentId)
            .maybeSingle();

          if (!meetingError && meeting) {
            documents.push({
              id: meeting.id,
              type: 'meeting' as const,
              original_name: meeting.title,
              ai_generated_name: meeting.title,
              file_path: undefined,
              file_size: null,
              content_type: 'audio/meeting',
              taxonomy: {
                category: "Meeting",
                subcategory: "Réunion transcrite",
                keywords: ["meeting", "réunion", "transcript"],
                documentType: "Réunion transcrite"
              },
              ai_summary: meeting.summary,
              processed: !!meeting.transcript,
              created_at: meeting.created_at,
              created_by: meeting.created_by,
              extracted_text: meeting.transcript,
              meeting_id: meeting.id,
              audio_url: meeting.audio_url,
              transcript: meeting.transcript,
              summary: meeting.summary,
              participants: meeting.meeting_participants?.map((mp: any) => mp.participants) || []
            });
            continue;
          }
        }

        // Essayer comme document uploadé
        const { data: document, error: docError } = await supabase
          .from('uploaded_documents')
          .select('*')
          .eq('id', source.documentId)
          .maybeSingle();

        if (!docError && document) {
          documents.push({
            id: document.id,
            type: 'document' as const,
            original_name: document.original_name,
            ai_generated_name: document.ai_generated_name,
            file_path: document.file_path,
            file_size: document.file_size,
            content_type: document.content_type,
            taxonomy: document.taxonomy || {},
            ai_summary: document.ai_summary,
            processed: document.processed,
            created_at: document.created_at,
            created_by: document.created_by,
            extracted_text: document.extracted_text,
            participants: undefined
          });
          continue;
        }

        // Si on n'a trouvé ni meeting ni document, créer un document fallback
        console.warn(`Document avec ID ${source.documentId} non trouvé, utilisation des données de base`);
        documents.push({
          id: source.documentId,
          type: 'document' as const,
          original_name: source.documentName,
          ai_generated_name: source.documentName,
          file_path: undefined,
          file_size: null,
          content_type: 'application/octet-stream',
          taxonomy: {
            category: "Document",
            subcategory: "Source de recherche",
            keywords: ["recherche", "source"],
            documentType: source.documentType || "Document"
          },
          ai_summary: `Document trouvé lors de la recherche avec ${source.chunksCount} chunk(s) pertinent(s).`,
          processed: true,
          created_at: new Date().toISOString(),
          created_by: '',
          extracted_text: source.relevantChunks?.join('\n\n') || null,
          participants: undefined
        });

      } catch (error) {
        console.error(`Erreur lors de la récupération du document ${source.documentId}:`, error);
        
        // Créer un document fallback en cas d'erreur
        documents.push({
          id: source.documentId,
          type: 'document' as const,
          original_name: source.documentName,
          ai_generated_name: source.documentName,
          file_path: undefined,
          file_size: null,
          content_type: 'application/octet-stream',
          taxonomy: {
            category: "Document",
            subcategory: "Source de recherche",
            keywords: ["recherche", "source"],
            documentType: source.documentType || "Document"
          },
          ai_summary: `Document trouvé lors de la recherche avec ${source.chunksCount} chunk(s) pertinent(s).`,
          processed: true,
          created_at: new Date().toISOString(),
          created_by: '',
          extracted_text: source.relevantChunks?.join('\n\n') || null,
          participants: undefined
        });
      }
    }

    return documents;
  };

  // Récupérer les détails des documents au chargement
  useEffect(() => {
    const loadDocuments = async () => {
      setIsLoading(true);
      try {
        const documents = await fetchDocumentDetails(displaySources);
        setRealDocuments(documents);
      } catch (error) {
        console.error('Erreur générale lors du chargement des documents:', error);
        
        // En cas d'erreur générale, créer des documents fallback
        const fallbackDocuments: UnifiedDocumentItem[] = displaySources.map(source => ({
          id: source.documentId,
          type: 'document' as const,
          original_name: source.documentName,
          ai_generated_name: source.documentName,
          file_path: undefined,
          file_size: null,
          content_type: 'application/octet-stream',
          taxonomy: {
            category: "Document",
            subcategory: "Source de recherche",
            keywords: ["recherche", "source"],
            documentType: source.documentType || "Document"
          },
          ai_summary: `Document trouvé lors de la recherche avec ${source.chunksCount} chunk(s) pertinent(s).`,
          processed: true,
          created_at: new Date().toISOString(),
          created_by: '',
          extracted_text: source.relevantChunks?.join('\n\n') || null,
          participants: undefined
        }));
        
        setRealDocuments(fallbackDocuments);
      } finally {
        setIsLoading(false);
      }
    };

    if (displaySources.length > 0) {
      loadDocuments();
    }
  }, [JSON.stringify(displaySources)]);

  const handleDownloadDocument = (document: UnifiedDocumentItem) => {
    if (document.type === 'meeting') {
      // Rediriger vers la page du meeting
      window.open(`/meetings/${document.meeting_id}`, '_blank');
    } else {
      // Pour les vrais documents, télécharger
      if (document.file_path) {
        const downloadUrl = `/api/documents/${document.id}/download`;
        window.open(downloadUrl, '_blank');
      } else {
        // Pour les documents fallback, afficher les détails
        setSelectedDocument(document);
        setIsViewerOpen(true);
      }
    }
  };

  // Fonction vide pour les actions non supportées dans le contexte des sources
  const handleDelete = () => {
    // Action non supportée pour les sources
  };

  const handleUpdate = () => {
    // Action non supportée pour les sources  
  };

  return (
    <>
      <div className="mt-4 space-y-3">
        <div className="text-sm text-muted-foreground font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {title} ({displaySources.length} document{displaySources.length > 1 ? 's' : ''}) :
        </div>
        
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">
              Chargement des détails des documents...
            </div>
          ) : realDocuments.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Aucun document trouvé
            </div>
          ) : (
            realDocuments.map((document, index) => (
              <CompactDocumentItem
                key={`${document.type}-${document.id}-${index}`}
                document={document}
                onDownload={() => handleDownloadDocument(document)}
                onDelete={handleDelete}
                isDeleting={false}
                onUpdate={handleUpdate}
              />
            ))
          )}
        </div>
      </div>

      {selectedDocument && (
        <DocumentViewer
          document={selectedDocument}
          isOpen={isViewerOpen}
          onClose={() => {
            setIsViewerOpen(false);
            setSelectedDocument(null);
          }}
        />
      )}
    </>
  );
};
