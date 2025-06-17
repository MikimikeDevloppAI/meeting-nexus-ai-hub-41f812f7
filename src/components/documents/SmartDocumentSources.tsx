
import { useState } from "react";
import { FileText } from "lucide-react";
import { DocumentViewer } from "./DocumentViewer";
import { CompactDocumentItem } from "./CompactDocumentItem";
import { UnifiedDocumentItem } from "@/types/unified-document";

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

  // Filtrer pour garder uniquement les documents vraiment pertinents
  // Seuil de similarité plus élevé pour éviter d'afficher tous les documents récupérés
  const relevantSources = sources.filter(source => source.maxSimilarity > 0.3);
  
  // Si aucun document n'atteint le seuil, prendre le meilleur
  const displaySources = relevantSources.length > 0 ? relevantSources : sources.slice(0, 1);

  // Créer un objet UnifiedDocumentItem simulé pour le viewer
  const createDocumentFromSource = (source: DocumentSource): UnifiedDocumentItem => ({
    id: source.documentId,
    original_name: source.documentName,
    ai_generated_name: source.documentName,
    type: source.documentType === 'meeting' ? 'meeting' : 'document',
    file_path: `/api/documents/${source.documentId}/download`,
    file_size: null,
    content_type: 'application/pdf',
    extracted_text: source.relevantChunks?.join('\n\n') || '',
    ai_summary: '',
    taxonomy: {},
    processed: true,
    created_at: new Date().toISOString(),
    created_by: '',
    participants: source.documentType === 'meeting' ? [] : undefined,
    audio_url: source.documentType === 'meeting' ? `/api/meetings/${source.documentId}/audio` : undefined
  });

  const handleViewDocument = (source: DocumentSource) => {
    const documentData = createDocumentFromSource(source);
    setSelectedDocument(documentData);
    setIsViewerOpen(true);
  };

  const handleDownloadDocument = (source: DocumentSource) => {
    const downloadUrl = `/api/documents/${source.documentId}/download`;
    window.open(downloadUrl, '_blank');
  };

  // Fonction vide pour les actions non supportées
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
        
        <div className="space-y-2">
          {displaySources.map((source, index) => {
            const documentData = createDocumentFromSource(source);
            
            return (
              <div key={`${source.documentId}-${index}`} className="relative">
                <CompactDocumentItem
                  document={documentData}
                  onDownload={() => handleDownloadDocument(source)}
                  onDelete={handleDelete}
                  isDeleting={false}
                  onUpdate={handleUpdate}
                />
                
                {/* Overlay pour montrer les informations de pertinence */}
                <div className="absolute top-2 right-16 flex gap-1">
                  <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                    {(source.maxSimilarity * 100).toFixed(1)}% pertinent
                  </div>
                  <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                    {source.chunksCount} section{source.chunksCount > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            );
          })}
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
