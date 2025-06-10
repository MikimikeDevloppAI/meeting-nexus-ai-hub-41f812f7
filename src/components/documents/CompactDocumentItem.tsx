
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Trash2, CheckCircle, Loader2, FileSearch, X } from "lucide-react";
import { useState } from "react";
import { CompactDocumentChat } from "./CompactDocumentChat";

interface CompactDocumentItemProps {
  document: {
    id: string;
    original_name: string;
    ai_generated_name: string | null;
    file_path: string;
    file_size: number | null;
    content_type: string | null;
    taxonomy: any;
    ai_summary: string | null;
    processed: boolean;
    created_at: string;
    created_by: string;
    extracted_text: string | null;
  };
  onDownload: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

export const CompactDocumentItem = ({ 
  document, 
  onDownload, 
  onDelete, 
  isDeleting 
}: CompactDocumentItemProps) => {
  const [showDetails, setShowDetails] = useState(false);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
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
              <FileText className="h-4 w-4 text-gray-600" />
              <h3 className="font-medium text-sm">
                {document.ai_generated_name || document.original_name}
              </h3>
              
              {document.processed ? (
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
                  Texte extrait
                </Badge>
              )}
            </div>
            
            {/* Catégorisation */}
            {document.taxonomy && Object.keys(document.taxonomy).length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {document.taxonomy.category && (
                  <Badge variant="secondary" className="text-xs">
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
              <span>{formatFileSize(document.file_size)}</span>
              <span>{new Date(document.created_at).toLocaleDateString('fr-FR')}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
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

            {/* Partie gauche - Détails du document */}
            <div className="flex-1 flex flex-col">
              <div className="p-6 border-b pr-16">
                <h2 className="text-lg font-semibold">
                  {document.ai_generated_name || document.original_name}
                </h2>
                
                {document.ai_generated_name && document.original_name !== document.ai_generated_name && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Nom original: {document.original_name}
                  </p>
                )}
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto space-y-4">
                {/* Résumé */}
                {document.ai_summary && (
                  <div>
                    <h4 className="font-medium mb-2">Résumé</h4>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                      {document.ai_summary}
                    </p>
                  </div>
                )}
                
                {/* Catégorisation complète */}
                {document.taxonomy && Object.keys(document.taxonomy).length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Catégorisation complète</h4>
                    <div className="flex flex-wrap gap-2">
                      {document.taxonomy.category && (
                        <Badge variant="secondary">
                          {document.taxonomy.category}
                        </Badge>
                      )}
                      {document.taxonomy.subcategory && (
                        <Badge variant="outline">
                          {document.taxonomy.subcategory}
                        </Badge>
                      )}
                      {document.taxonomy.documentType && (
                        <Badge variant="outline">
                          {document.taxonomy.documentType}
                        </Badge>
                      )}
                      {document.taxonomy.keywords?.map((keyword: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Texte extrait */}
                {document.extracted_text && (
                  <div>
                    <h4 className="font-medium mb-2">
                      Texte extrait ({document.extracted_text.length.toLocaleString()} caractères)
                    </h4>
                    <div className="whitespace-pre-wrap text-sm font-mono bg-gray-50 p-4 rounded max-h-60 overflow-y-auto">
                      {document.extracted_text}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Partie droite - Chat avec le document */}
            <div className="w-96 border-l bg-gray-50">
              <CompactDocumentChat document={document} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
