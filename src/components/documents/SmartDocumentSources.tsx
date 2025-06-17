
import { useState } from "react";
import { FileText } from "lucide-react";
import { DocumentViewer } from "./DocumentViewer";
import { CompactDocumentItem } from "./CompactDocumentItem";
import { UnifiedDocumentItem } from "@/types/unified-document";
import { useDocumentsByIds } from "@/hooks/useDocumentsByIds";

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

  if (!sources || sources.length === 0) {
    return null;
  }

  // Filter to keep only truly relevant documents
  const relevantSources = sources.filter(source => source.maxSimilarity > 0.3);
  const displaySources = relevantSources.length > 0 ? relevantSources : sources.slice(0, 1);

  // Extract all document IDs from sources - we'll try to fetch them as both documents and meetings
  const documentIds = displaySources.map(source => source.documentId);
  
  console.log('[SmartDocumentSources] Searching for document IDs:', documentIds);

  // Use the corrected hook to fetch real document data
  const { documents: realDocuments, isLoading, error } = useDocumentsByIds({
    documentIds,
    documentTypes: {} // We let the hook try both documents and meetings tables
  });

  console.log('[SmartDocumentSources] Real documents found:', realDocuments.length);

  const handleDownloadDocument = (document: UnifiedDocumentItem) => {
    if (document.type === 'meeting') {
      // Redirect to meeting page
      window.open(`/meetings/${document.meeting_id}`, '_blank');
    } else {
      // For real documents, download
      if (document.file_path) {
        const downloadUrl = `/api/documents/${document.id}/download`;
        window.open(downloadUrl, '_blank');
      } else {
        // For fallback documents, show details
        setSelectedDocument(document);
        setIsViewerOpen(true);
      }
    }
  };

  // Empty functions for actions not supported in sources context
  const handleDelete = () => {
    // Action not supported for sources
  };

  const handleUpdate = () => {
    // Action not supported for sources  
  };

  // Create fallback documents only if no real documents were found
  const displayDocuments = realDocuments.length > 0 ? realDocuments : displaySources.map(source => ({
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
    ai_summary: `Document trouvé lors de la recherche avec ${source.chunksCount} chunk(s) pertinent(s) (similarité: ${(source.maxSimilarity * 100).toFixed(1)}%).`,
    processed: true,
    created_at: new Date().toISOString(),
    created_by: '',
    extracted_text: source.relevantChunks?.join('\n\n') || null,
    participants: undefined
  }));

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
          ) : error ? (
            <div className="text-sm text-red-600">
              Erreur lors du chargement des documents: {error}
            </div>
          ) : displayDocuments.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Aucun document trouvé
            </div>
          ) : (
            displayDocuments.map((document, index) => {
              // Show similarity info for fallback documents
              const isRealDocument = realDocuments.some(rd => rd.id === document.id);
              const sourceInfo = displaySources.find(s => s.documentId === document.id);
              
              return (
                <div key={`${document.type}-${document.id}-${index}`}>
                  <CompactDocumentItem
                    document={document}
                    onDownload={() => handleDownloadDocument(document)}
                    onDelete={handleDelete}
                    isDeleting={false}
                    onUpdate={handleUpdate}
                  />
                  {!isRealDocument && sourceInfo && (
                    <div className="ml-4 mt-1 text-xs text-muted-foreground">
                      Similarité: {(sourceInfo.maxSimilarity * 100).toFixed(1)}% • {sourceInfo.chunksCount} chunk{sourceInfo.chunksCount > 1 ? 's' : ''} trouvé{sourceInfo.chunksCount > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              );
            })
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
