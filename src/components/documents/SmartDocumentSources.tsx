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

  // Extract all document IDs from sources - these are now the IDs from the documents table
  const documentIds = displaySources.map(source => source.documentId);
  
  console.log('[SmartDocumentSources] Searching for document IDs from documents table:', documentIds);

  // Use the corrected hook to fetch real document data via the documents bridge table
  const { documents: realDocuments, isLoading, error } = useDocumentsByIds({
    documentIds,
    documentTypes: {} // We let the hook handle the bridge logic
  });

  console.log('[SmartDocumentSources] Real documents found via bridge:', realDocuments.length);

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
        // Show document details in viewer
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
          ) : realDocuments.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Aucun document trouvé dans les tables sources
            </div>
          ) : (
            realDocuments.map((document, index) => {
              // Find corresponding source info for similarity display
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
                  {sourceInfo && (
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
