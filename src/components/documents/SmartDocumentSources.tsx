
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Eye, Download, Users, Mic } from "lucide-react";
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

export const SmartDocumentSources = ({ sources, title = "Document source utilisé" }: SmartDocumentSourcesProps) => {
  const [selectedDocument, setSelectedDocument] = useState<UnifiedDocumentItem | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Sélectionner le document le plus pertinent
  const primaryDocument = sources.length > 0 ? sources[0] : null;

  if (!primaryDocument) {
    return null;
  }

  // Créer un objet UnifiedDocumentItem simulé pour le viewer
  // En production, il faudrait faire un appel API pour récupérer les détails complets
  const createDocumentFromSource = (source: DocumentSource): UnifiedDocumentItem => ({
    id: source.documentId,
    original_name: source.documentName,
    ai_generated_name: source.documentName,
    type: source.documentType === 'meeting' ? 'meeting' : 'document',
    file_path: `/api/documents/${source.documentId}/download`, // URL simulée
    file_size: null,
    content_type: 'application/pdf', // Type par défaut
    extracted_text: source.relevantChunks?.join('\n\n') || '',
    ai_summary: '',
    taxonomy: {},
    processed: true,
    created_at: new Date().toISOString(),
    created_by: null,
    participants: source.documentType === 'meeting' ? [] : undefined,
    audio_url: source.documentType === 'meeting' ? `/api/meetings/${source.documentId}/audio` : undefined
  });

  const handleViewDocument = () => {
    const documentData = createDocumentFromSource(primaryDocument);
    setSelectedDocument(documentData);
    setIsViewerOpen(true);
  };

  const handleDownloadDocument = () => {
    // Simuler le téléchargement
    const downloadUrl = `/api/documents/${primaryDocument.documentId}/download`;
    window.open(downloadUrl, '_blank');
  };

  const isMeeting = primaryDocument.documentType === 'meeting';

  return (
    <>
      <div className="mt-4 space-y-3">
        <div className="text-sm text-muted-foreground font-medium flex items-center gap-2">
          {isMeeting ? <Mic className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          {title} :
        </div>
        
        <Card className="p-4 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {isMeeting ? (
                  <Mic className="h-4 w-4 text-blue-600" />
                ) : (
                  <FileText className="h-4 w-4 text-blue-600" />
                )}
                <span className="font-medium text-blue-800 text-sm">
                  {primaryDocument.documentName}
                </span>
                {isMeeting && (
                  <Badge variant="default" className="bg-blue-500 text-xs">
                    <Mic className="h-3 w-3 mr-1" />
                    Réunion
                  </Badge>
                )}
              </div>
              
              <div className="flex gap-2 mb-2">
                <Badge variant="outline" className="text-xs">
                  Pertinence: {(primaryDocument.maxSimilarity * 100).toFixed(1)}%
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {primaryDocument.chunksCount} section{primaryDocument.chunksCount > 1 ? 's' : ''} utilisée{primaryDocument.chunksCount > 1 ? 's' : ''}
                </Badge>
              </div>

              {primaryDocument.relevantChunks && primaryDocument.relevantChunks.length > 0 && (
                <div className="text-xs text-gray-600 bg-white p-2 rounded border mt-2">
                  <strong>Passage pertinent :</strong>
                  <div className="mt-1 font-mono">
                    "{primaryDocument.relevantChunks[0].substring(0, 150)}..."
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewDocument}
                className="flex items-center gap-1"
              >
                <Eye className="h-4 w-4" />
                Voir
              </Button>
              
              {!isMeeting && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadDocument}
                  className="flex items-center gap-1"
                >
                  <Download className="h-4 w-4" />
                  Télécharger
                </Button>
              )}
            </div>
          </div>
        </Card>

        {sources.length > 1 && (
          <div className="text-xs text-muted-foreground">
            + {sources.length - 1} autre{sources.length > 2 ? 's' : ''} document{sources.length > 2 ? 's' : ''} consulté{sources.length > 2 ? 's' : ''}
          </div>
        )}
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
