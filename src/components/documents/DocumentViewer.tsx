
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Download, ExternalLink, X, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { UnifiedDocumentItem } from "@/types/unified-document";
import { getDocumentViewUrl, getDocumentDownloadUrl } from "@/lib/utils";

interface DocumentViewerProps {
  document: UnifiedDocumentItem;
  isOpen: boolean;
  onClose: () => void;
}

type ViewerMethod = 'direct' | 'office-online' | 'google-docs' | 'download-only';

export const DocumentViewer = ({ document, isOpen, onClose }: DocumentViewerProps) => {
  const [viewerError, setViewerError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMethod, setCurrentMethod] = useState<ViewerMethod>('direct');
  const [edgeBlocked, setEdgeBlocked] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const isPdf = document.content_type?.includes('pdf');
  const isImage = document.content_type?.startsWith('image/');
  const isText = document.content_type?.includes('text/plain');
  const isOfficeDoc = document.content_type?.includes('office') || 
                     document.content_type?.includes('word') ||
                     document.content_type?.includes('powerpoint') ||
                     document.content_type?.includes('excel') ||
                     document.content_type?.includes('presentation') ||
                     document.content_type?.includes('sheet');

  const viewUrl = document.file_path ? getDocumentViewUrl(document.file_path) : '';
  const downloadUrl = document.file_path ? getDocumentDownloadUrl(document.file_path) : '';

  // Detect if we're in Microsoft Edge
  const isEdge = typeof navigator !== 'undefined' && /Edg/.test(navigator.userAgent);

  // Reset states when document changes
  useEffect(() => {
    if (isOpen) {
      setViewerError(false);
      setIsLoading(true);
      setCurrentMethod('direct');
      setEdgeBlocked(false);
      setRetryCount(0);
    }
  }, [isOpen, document.id]);

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  const handleLoadSuccess = () => {
    setIsLoading(false);
    setViewerError(false);
    setEdgeBlocked(false);
  };

  const handleLoadError = () => {
    setIsLoading(false);
    
    // Detect potential Edge blocking
    if (isEdge && retryCount === 0) {
      setEdgeBlocked(true);
    }
    
    // Try next fallback method
    if (currentMethod === 'direct' && isOfficeDoc) {
      setCurrentMethod('office-online');
      setRetryCount(prev => prev + 1);
      setIsLoading(true);
      setViewerError(false);
    } else if (currentMethod === 'office-online' && isOfficeDoc) {
      setCurrentMethod('google-docs');
      setRetryCount(prev => prev + 1);
      setIsLoading(true);
      setViewerError(false);
    } else {
      setViewerError(true);
    }
  };

  const retryWithMethod = (method: ViewerMethod) => {
    setCurrentMethod(method);
    setViewerError(false);
    setEdgeBlocked(false);
    setIsLoading(true);
    setRetryCount(prev => prev + 1);
  };

  const getViewerUrl = () => {
    if (!viewUrl) return '';
    
    switch (currentMethod) {
      case 'office-online':
        return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(viewUrl)}`;
      case 'google-docs':
        return `https://docs.google.com/gview?url=${encodeURIComponent(viewUrl)}&embedded=true`;
      default:
        return viewUrl;
    }
  };

  const renderErrorFallback = () => {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center p-6">
        <AlertTriangle className="h-16 w-16 text-amber-500 mb-4" />
        
        {edgeBlocked && isEdge ? (
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-2">Document bloqué par Microsoft Edge</h3>
            <p className="text-gray-600 mb-4 max-w-md">
              Edge bloque l'affichage de ce document pour des raisons de sécurité. 
              Vous pouvez essayer les options ci-dessous :
            </p>
            <div className="bg-blue-50 p-3 rounded-md mb-4 text-sm text-left">
              <strong>Pour débloquer dans Edge :</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Cliquez sur l'icône de bouclier dans la barre d'adresse</li>
                <li>Sélectionnez "Autoriser le contenu non sécurisé"</li>
                <li>Actualisez la page</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-2">Aperçu non disponible</h3>
            <p className="text-gray-600 mb-4">
              Impossible d'afficher ce document dans le navigateur
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 justify-center">
          <Button onClick={handleDownload} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Télécharger le document
          </Button>
          
          {isOfficeDoc && currentMethod !== 'office-online' && (
            <Button 
              variant="outline" 
              onClick={() => retryWithMethod('office-online')}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Essayer Office Online
            </Button>
          )}
          
          {isOfficeDoc && currentMethod !== 'google-docs' && (
            <Button 
              variant="outline" 
              onClick={() => retryWithMethod('google-docs')}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Essayer Google Docs
            </Button>
          )}
          
          {viewUrl && (
            <Button 
              variant="outline" 
              onClick={() => window.open(viewUrl, '_blank')}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Ouvrir dans un nouvel onglet
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderViewer = () => {
    if (!viewUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <FileText className="h-16 w-16 text-gray-400 mb-4" />
          <p className="text-gray-600 mb-4">
            Aucun fichier disponible pour ce document
          </p>
        </div>
      );
    }

    if (viewerError) {
      return renderErrorFallback();
    }

    if (isPdf) {
      const pdfUrl = currentMethod === 'direct' ? `${viewUrl}#view=FitH` : getViewerUrl();
      
      return (
        <div className="w-full h-96 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-600">
                {currentMethod === 'direct' ? 'Chargement du PDF...' : 
                 currentMethod === 'office-online' ? 'Chargement via Office Online...' :
                 'Chargement via Google Docs...'}
              </span>
            </div>
          )}
          <iframe
            src={pdfUrl}
            className="w-full h-full border"
            onLoad={handleLoadSuccess}
            onError={handleLoadError}
            title={`Aperçu de ${document.ai_generated_name || document.original_name}`}
            style={{ display: isLoading ? 'none' : 'block' }}
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="flex justify-center relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}
          <img
            src={viewUrl}
            alt={document.ai_generated_name || document.original_name}
            className="max-w-full max-h-96 object-contain"
            onLoad={handleLoadSuccess}
            onError={handleLoadError}
            style={{ display: isLoading ? 'none' : 'block' }}
          />
        </div>
      );
    }

    if (isText) {
      return (
        <div className="w-full h-96 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}
          <iframe
            src={viewUrl}
            className="w-full h-full border bg-white"
            onLoad={handleLoadSuccess}
            onError={handleLoadError}
            title={`Contenu de ${document.ai_generated_name || document.original_name}`}
            style={{ display: isLoading ? 'none' : 'block' }}
            sandbox="allow-same-origin"
          />
        </div>
      );
    }

    if (isOfficeDoc) {
      const officeUrl = getViewerUrl();
      
      return (
        <div className="w-full h-96 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-600">
                {currentMethod === 'office-online' ? 'Chargement via Office Online...' :
                 currentMethod === 'google-docs' ? 'Chargement via Google Docs...' :
                 'Chargement du document...'}
              </span>
            </div>
          )}
          <iframe
            src={officeUrl}
            className="w-full h-full border"
            onLoad={handleLoadSuccess}
            onError={handleLoadError}
            title={`Aperçu de ${document.ai_generated_name || document.original_name}`}
            style={{ display: isLoading ? 'none' : 'block' }}
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      );
    }

    // Fallback pour les autres types de fichiers
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <FileText className="h-16 w-16 text-gray-400 mb-4" />
        <p className="text-gray-600 mb-2">
          {document.ai_generated_name || document.original_name}
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Type de fichier : {document.content_type || 'Inconnu'}
        </p>
        <Button onClick={handleDownload} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Télécharger le document
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {document.ai_generated_name || document.original_name}
              {currentMethod !== 'direct' && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {currentMethod === 'office-online' ? 'Office Online' : 'Google Docs'}
                </span>
              )}
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="overflow-y-auto">
          {renderViewer()}
        </div>
        
        {document.ai_summary && (
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Résumé du document :</h4>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
              {document.ai_summary}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
