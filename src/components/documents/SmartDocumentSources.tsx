
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

  // Créer un objet UnifiedDocumentItem simulé pour le viewer avec catégorisation complète
  const createDocumentFromSource = (source: DocumentSource): UnifiedDocumentItem => ({
    id: source.documentId,
    original_name: source.documentName,
    ai_generated_name: source.documentName,
    type: source.documentType === 'meeting' ? 'meeting' : 'document',
    file_path: source.documentType !== 'meeting' ? `/api/documents/${source.documentId}/download` : undefined,
    file_size: null,
    content_type: source.documentType === 'meeting' ? 'audio/meeting' : 'application/pdf',
    extracted_text: source.relevantChunks?.join('\n\n') || '',
    ai_summary: '',
    taxonomy: source.documentType === 'meeting' ? {
      category: "Meeting",
      subcategory: "Réunion transcrite", 
      keywords: ["meeting", "réunion", "transcript"],
      documentType: "Réunion transcrite"
    } : {
      category: "Document",
      subcategory: "Document source",
      keywords: ["document", "source"],
      documentType: "Document recherché"
    },
    processed: true,
    created_at: new Date().toISOString(),
    created_by: '',
    participants: source.documentType === 'meeting' ? [] : undefined,
    audio_url: source.documentType === 'meeting' ? `/api/meetings/${source.documentId}/audio` : undefined,
    meeting_id: source.documentType === 'meeting' ? source.documentId : undefined,
    transcript: source.documentType === 'meeting' ? source.relevantChunks?.join('\n\n') : undefined,
    summary: source.documentType === 'meeting' ? 'Résumé de la réunion' : undefined
  });

  const handleDownloadDocument = (source: DocumentSource) => {
    if (source.documentType === 'meeting') {
      // Rediriger vers la page du meeting
      window.open(`/meetings/${source.documentId}`, '_blank');
    } else {
      // Télécharger le document
      const downloadUrl = `/api/documents/${source.documentId}/download`;
      window.open(downloadUrl, '_blank');
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
          {displaySources.map((source, index) => {
            const documentData = createDocumentFromSource(source);
            
            return (
              <CompactDocumentItem
                key={`${source.documentId}-${index}`}
                document={documentData}
                onDownload={() => handleDownloadDocument(source)}
                onDelete={handleDelete}
                isDeleting={false}
                onUpdate={handleUpdate}
              />
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
