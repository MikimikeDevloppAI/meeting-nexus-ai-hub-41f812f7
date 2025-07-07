
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Download, Trash2, Loader2, X, Mic, Users, Play, Eye, Edit3, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { CompactDocumentChat } from "./CompactDocumentChat";
import { DocumentMetadataEditor } from "./DocumentMetadataEditor";
import { DocumentPreview } from "./DocumentPreview";
import { UnifiedDocumentItem } from "@/types/unified-document";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  const [showPreview, setShowPreview] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(document.ai_generated_name || document.original_name);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

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

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTitle(true);
  };

  const handleTitleSave = async () => {
    if (editedTitle.trim() === (document.ai_generated_name || document.original_name)) {
      setIsEditingTitle(false);
      return;
    }

    setIsSavingTitle(true);
    try {
      if (document.type === 'meeting') {
        const { error } = await supabase
          .from('meetings')
          .update({ title: editedTitle.trim() })
          .eq('id', document.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('uploaded_documents')
          .update({ ai_generated_name: editedTitle.trim() })
          .eq('id', document.id);

        if (error) throw error;
      }

      toast({
        title: "Titre mis à jour",
        description: "Le titre a été modifié avec succès",
      });

      setIsEditingTitle(false);
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du titre:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le titre",
        variant: "destructive",
      });
      setEditedTitle(document.ai_generated_name || document.original_name);
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleTitleCancel = () => {
    setEditedTitle(document.ai_generated_name || document.original_name);
    setIsEditingTitle(false);
  };

  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      handleTitleCancel();
    }
  };

  const isMeeting = document.type === 'meeting';
  const isProcessing = !document.processed && !isMeeting;

  const handlePlayAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (document.audio_url) {
      const audio = new Audio(document.audio_url);
      audio.play();
    }
  };

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPreview(true);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDownload();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  console.log(`🔍 Rendering document ${document.id}: processed=${document.processed}, isProcessing=${isProcessing}`);

  return (
    <>
      <div 
        className="border rounded-lg p-3 lg:p-4 hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => setShowDetails(true)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {isMeeting ? (
                <Mic className="h-4 w-4 text-blue-600 flex-shrink-0" />
              ) : (
                <FileText className="h-4 w-4 text-gray-600 flex-shrink-0" />
              )}
              
              {isEditingTitle ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Input
                    ref={inputRef}
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={handleTitleKeyPress}
                    onBlur={handleTitleSave}
                    className="text-sm font-medium h-8 flex-1"
                    disabled={isSavingTitle}
                  />
                  {isSavingTitle ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  ) : (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={handleTitleSave}
                      >
                        <Check className="h-3 w-3 text-green-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={handleTitleCancel}
                      >
                        <X className="h-3 w-3 text-red-600" />
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1 min-w-0 group">
                  <h3 
                    className="font-medium text-sm truncate flex-1 min-w-0 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={handleTitleClick}
                    title="Cliquer pour modifier le titre"
                  >
                    {document.ai_generated_name || document.original_name}
                  </h3>
                  <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1 mb-2">
              {isMeeting ? (
                <Badge variant="default" className="bg-blue-500 text-xs">
                  <Mic className="h-3 w-3 mr-1" />
                  Meeting
                </Badge>
              ) : isProcessing ? (
                <Badge variant="secondary" className="bg-blue-500 text-white text-xs">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  En traitement...
                </Badge>
              ) : null}

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
            
            <div className="flex items-center gap-2 lg:gap-4 text-xs text-muted-foreground flex-wrap">
              {isMeeting ? (
                <>
                  <span className="flex-shrink-0">Meeting</span>
                  {document.participants && (
                    <span className="truncate">
                      {document.participants.map(p => p.name).join(', ')}
                    </span>
                  )}
                </>
              ) : (
                <span className="flex-shrink-0">{formatFileSize(document.file_size)}</span>
              )}
              <span className="flex-shrink-0">
                {new Date(document.created_at).toLocaleDateString('fr-FR')}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 lg:gap-2 flex-shrink-0">
            {/* Bouton de prévisualisation pour les documents avec file_path */}
            {!isMeeting && document.file_path && document.processed && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreview}
                title="Prévisualiser le document"
                className="h-8 w-8 p-0 lg:h-auto lg:w-auto lg:px-3"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {isMeeting && document.audio_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePlayAudio}
                title="Écouter l'audio"
                className="h-8 w-8 p-0 lg:h-auto lg:w-auto lg:px-3"
              >
                <Play className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              title={isMeeting ? "Voir la page du meeting" : "Télécharger"}
              className="h-8 w-8 p-0 lg:h-auto lg:w-auto lg:px-3"
            >
              <Download className="h-4 w-4" />
            </Button>
            {!isMeeting && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="h-8 w-8 p-0 lg:h-auto lg:w-auto lg:px-3"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Nouveau composant de prévisualisation */}
      {showPreview && (
        <DocumentPreview
          document={document}
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Modal pour les détails */}
      {showDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 lg:p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[95vh] lg:max-h-[90vh] overflow-hidden flex flex-col lg:flex-row relative">
            {/* Bouton de fermeture en haut à droite */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowDetails(false)}
              className="absolute top-2 right-2 lg:top-4 lg:right-4 z-10 h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Partie gauche - Détails du document/meeting */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 lg:p-6 border-b pr-12 lg:pr-16">
                <div className="flex items-center gap-2 mb-2">
                  {isMeeting ? (
                    <Mic className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  ) : (
                    <FileText className="h-5 w-5 text-gray-600 flex-shrink-0" />
                  )}
                   <h2 className="text-base lg:text-lg font-semibold truncate">
                     {isEditingTitle ? editedTitle : (document.ai_generated_name || document.original_name)}
                   </h2>
                  {/* Statut de traitement dans le header */}
                  {!isMeeting && (
                    <div className="ml-2">
                      {isProcessing ? (
                        <Badge variant="secondary" className="bg-blue-500 text-white text-xs">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          En traitement...
                        </Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-500 text-white text-xs">
                          Traité
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                
                {document.ai_generated_name && document.original_name !== document.ai_generated_name && (
                  <p className="text-sm text-muted-foreground mt-1 truncate">
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
              
              <div className="p-4 lg:p-6 flex-1 overflow-y-auto space-y-4">
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
                
                {/* Éditeur de métadonnées - seulement pour les documents traités */}
                {!isMeeting && document.processed && (
                  <div>
                    <h4 className="font-medium mb-2">Catégorisation</h4>
                    <DocumentMetadataEditor 
                      document={document}
                      onUpdate={handleMetadataUpdate}
                    />
                  </div>
                )}

                {/* Message pour documents en traitement */}
                {!isMeeting && isProcessing && (
                  <div className="bg-blue-50 p-4 rounded-md">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <p className="text-sm text-blue-800">
                        Document en cours de traitement... La catégorisation et l'extraction de texte seront disponibles une fois le traitement terminé.
                      </p>
                    </div>
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
                
                {/* Texte extrait / Transcript - seulement si traité */}
                {document.extracted_text && document.processed && (
                  <div>
                    <h4 className="font-medium mb-2">
                      {isMeeting ? 'Transcript de la réunion' : 'Contenu du document'} ({document.extracted_text.length.toLocaleString()} caractères)
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
            
            {/* Partie droite - Chat avec le document/meeting - seulement si traité */}
            {(isMeeting || document.processed) && (
              <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l bg-gray-50 min-h-[300px] lg:min-h-0">
                <CompactDocumentChat document={document} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
