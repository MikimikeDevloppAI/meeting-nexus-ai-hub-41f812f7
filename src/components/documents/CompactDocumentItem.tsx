
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Trash2, CheckCircle, Loader2, FileSearch, X, Mic, Users, Play } from "lucide-react";
import { useState } from "react";
import { CompactDocumentChat } from "./CompactDocumentChat";
import { DocumentMetadataEditor } from "./DocumentMetadataEditor";
import { UnifiedDocumentItem } from "@/types/unified-document";

interface CompactDocumentItemProps {
  document: UnifiedDocumentItem;
  onDownload: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  onUpdate?: () => void;
}

export const CompactDocumentItem = ({ 
  document, 
  onDownload, 
  onDelete, 
  isDeleting,
  onUpdate 
}: CompactDocumentItemProps) => {
  const [showDetails, setShowDetails] = useState(false);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const handleMetadataUpdate = () => {
    if (onUpdate) {
      onUpdate();
    }
  };

  const isMeeting = document.type === 'meeting';

  const handlePlayAudio = () => {
    if (document.audio_url) {
      const audio = new Audio(document.audio_url);
      audio.play();
    }
  };

  return (
    <>
      <div 
        className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => setShowDetails(true)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {isMeeting ? (
                <Mic className="h-4 w-4 text-blue-600" />
              ) : (
                <FileText className="h-4 w-4 text-gray-600" />
              )}
              <h3 className="font-medium text-sm">
                {document.ai_generated_name || document.original_name}
              </h3>
              
              {isMeeting ? (
                <Badge variant="default" className="bg-blue-500 text-xs">
                  <Mic className="h-3 w-3 mr-1" />
                  Meeting
                </Badge>
              ) : document.processed ? (
                <Badge variant="default" className="bg-green-500 text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Traité
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-blue-500 text-white text-xs">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  En traitement...
                </Badge>
              )}
              
              {document.extracted_text && (
                <Badge variant="outline" className="bg-purple-50 text-xs">
                  <FileSearch className="h-3 w-3 mr-1" />
                  {isMeeting ? 'Transcript' : 'Texte extrait'}
                </Badge>
              )}

              {isMeeting && document.participants && document.participants.length > 0 && (
                <Badge variant="outline" className="bg-orange-50 text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {document.participants.length} participant{document.participants.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            
            {/* Catégorisation */}
            {document.taxonomy && Object.keys(document.taxonomy).length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {document.taxonomy.category && (
                  <Badge variant={isMeeting ? "default" : "secondary"} className="text-xs">
                    {document.taxonomy.category}
                  </Badge>
                )}
                {document.taxonomy.subcategory && (
                  <Badge variant="outline" className="text-xs">
                    {document.taxonomy.subcategory}
                  </Badge>
                )}
                {document.taxonomy.documentType && (
                  <Badge variant="outline" className="text-xs">
                    {document.taxonomy.documentType}
                  </Badge>
                )}
              </div>
            )}
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {isMeeting ? (
                <>
                  <span>Meeting</span>
                  {document.participants && (
                    <span>{document.participants.map(p => p.name).join(', ')}</span>
                  )}
                </>
              ) : (
                <span>{formatFileSize(document.file_size)}</span>
              )}
              <span>{new Date(document.created_at).toLocaleDateString('fr-FR')}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {isMeeting && document.audio_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePlayAudio}
                title="Écouter l'audio"
              >
                <Play className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              title={isMeeting ? "Voir la page du meeting" : "Télécharger"}
            >
              <Download className="h-4 w-4" />
            </Button>
            {!isMeeting && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Modal pour les détails */}
      {showDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex relative">
            {/* Bouton de fermeture en haut à droite */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowDetails(false)}
              className="absolute top-4 right-4 z-10"
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Partie gauche - Détails du document/meeting */}
            <div className="flex-1 flex flex-col">
              <div className="p-6 border-b pr-16">
                <div className="flex items-center gap-2 mb-2">
                  {isMeeting ? (
                    <Mic className="h-5 w-5 text-blue-600" />
                  ) : (
                    <FileText className="h-5 w-5 text-gray-600" />
                  )}
                  <h2 className="text-lg font-semibold">
                    {document.ai_generated_name || document.original_name}
                  </h2>
                </div>
                
                {document.ai_generated_name && document.original_name !== document.ai_generated_name && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Nom original: {document.original_name}
                  </p>
                )}

                {isMeeting && document.participants && document.participants.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground">
                      Participants: {document.participants.map(p => p.name).join(', ')}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto space-y-4">
                {/* Résumé */}
                {document.ai_summary && (
                  <div>
                    <h4 className="font-medium mb-2">
                      {isMeeting ? 'Résumé de la réunion' : 'Résumé'}
                    </h4>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                      {document.ai_summary}
                    </p>
                  </div>
                )}
                
                {/* Éditeur de métadonnées - seulement pour les documents */}
                {!isMeeting && (
                  <div>
                    <h4 className="font-medium mb-2">Catégorisation</h4>
                    <DocumentMetadataEditor 
                      document={document}
                      onUpdate={handleMetadataUpdate}
                    />
                  </div>
                )}

                {/* Affichage de la catégorisation pour les meetings */}
                {isMeeting && document.taxonomy && (
                  <div>
                    <h4 className="font-medium mb-2">Informations</h4>
                    <div className="bg-gray-50 p-3 rounded-md">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="default">{document.taxonomy.category}</Badge>
                        <Badge variant="outline">{document.taxonomy.subcategory}</Badge>
                        <Badge variant="outline">{document.taxonomy.documentType}</Badge>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Texte extrait / Transcript */}
                {document.extracted_text && (
                  <div>
                    <h4 className="font-medium mb-2">
                      {isMeeting ? 'Transcript de la réunion' : 'Texte extrait'} ({document.extracted_text.length.toLocaleString()} caractères)
                    </h4>
                    <div className="whitespace-pre-wrap text-sm font-mono bg-gray-50 p-4 rounded max-h-60 overflow-y-auto">
                      {document.extracted_text}
                    </div>
                  </div>
                )}

                {/* Audio player pour les meetings */}
                {isMeeting && document.audio_url && (
                  <div>
                    <h4 className="font-medium mb-2">Audio de la réunion</h4>
                    <audio controls className="w-full">
                      <source src={document.audio_url} type="audio/mpeg" />
                      Votre navigateur ne supporte pas l'élément audio.
                    </audio>
                  </div>
                )}
              </div>
            </div>
            
            {/* Partie droite - Chat avec le document/meeting */}
            <div className="w-96 border-l bg-gray-50">
              <CompactDocumentChat document={document} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
