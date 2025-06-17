
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Download, ExternalLink, X, Loader2, AlertTriangle, RefreshCw, Eye } from "lucide-react";
import { UnifiedDocumentItem } from "@/types/unified-document";
import { 
  getDocumentViewUrl, 
  getDocumentDownloadUrl, 
  canPreviewDirectly,
  getGoogleDocsViewerUrl,
  getOfficeOnlineViewerUrl
} from "@/lib/utils";

interface DocumentPreviewProps {
  document: UnifiedDocumentItem;
  isOpen: boolean;
  onClose: () => void;
}

type ViewerMode = 'direct' | 'google-docs' | 'office-online' | 'download-only';

export const DocumentPreview = ({ document, isOpen, onClose }: DocumentPreviewProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentMode, setCurrentMode] = useState<ViewerMode>('direct');
  const [retryCount, setRetryCount] = useState(0);

  const isOfficeDoc = document.content_type?.includes('office') || 
                     document.content_type?.includes('word') ||
                     document.content_type?.includes('powerpoint') ||
                     document.content_type?.includes('excel') ||
                     document.content_type?.includes('presentation') ||
                     document.content_type?.includes('sheet');

  const isPdf = document.content_type?.includes('pdf');
  const isImage = document.content_type?.startsWith('image/');
  const isText = document.content_type?.includes('text/plain');

  const viewUrl = document.file_path ? getDocumentViewUrl(document.file_path) : '';
  const downloadUrl = document.file_path ? getDocumentDownloadUrl(document.file_path) : '';

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setHasError(false);
      setRetryCount(0);
      
      // Détermine le mode initial selon le type de fichier
      if (canPreviewDirectly(document.content_type || '')) {
        setCurrentMode('direct');
      } else if (isOfficeDoc) {
        setCurrentMode('office-online');
      } else {
        setCurrentMode('download-only');
      }
    }
  }, [isOpen, document.id, document.content_type, isOfficeDoc]);

  const handleLoadSuccess = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleLoadError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleRetryWithMode = (mode: ViewerMode) => {
    setCurrentMode(mode);
    setIsLoading(true);
    setHasError(false);
    setRetryCount(prev => prev + 1);
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  const getCurrentViewerUrl = () => {
    if (!viewUrl) return '';
    
    switch (currentMode) {
      case 'google-docs':
        return getGoogleDocsViewerUrl(viewUrl);
      case 'office-online':
        return getOfficeOnlineViewerUrl(viewUrl);
      default:
        return viewUrl;
    }
  };

  const renderPreview = () => {
    if (!viewUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <FileText className="h-16 w-16 text-gray-400 mb-4" />
          <p className="text-gray-600 mb-4">Fichier non disponible</p>
          <Button onClick={handleDownload} disabled={!downloadUrl}>
            <Download className="h-4 w-4 mr-2" />
            Télécharger
          </Button>
        </div>
      );
    }

    if (hasError || currentMode === 'download-only') {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-center p-6">
          <AlertTriangle className="h-16 w-16 text-amber-500 mb-4" />
          <h3 className="font-semibold text-lg mb-2">Aperçu non disponible</h3>
          <p className="text-gray-600 mb-6 max-w-md">
            Ce document ne peut pas être affiché dans le navigateur.
          </p>
          
          <div className="flex flex-wrap gap-2 justify-center">
            <Button onClick={handleDownload} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Télécharger
            </Button>
            
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
            
            {isOfficeDoc && currentMode !== 'google-docs' && (
              <Button 
                variant="outline" 
                onClick={() => handleRetryWithMode('google-docs')}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Essayer Google Docs
              </Button>
            )}
            
            {isOfficeDoc && currentMode !== 'office-online' && (
              <Button 
                variant="outline" 
                onClick={() => handleRetryWithMode('office-online')}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Essayer Office Online
              </Button>
            )}
          </div>
        </div>
      );
    }

    const currentUrl = getCurrentViewerUrl();

    if (isImage) {
      return (
        <div className="flex justify-center relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}
          <img
            src={currentUrl}
            alt={document.ai_generated_name || document.original_name}
            className="max-w-full max-h-96 object-contain"
            onLoad={handleLoadSuccess}
            onError={handleLoadError}
            style={{ display: isLoading ? 'none' : 'block' }}
          />
        </div>
      );
    }

    return (
      <div className="w-full h-96 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-600">
              {currentMode === 'direct' ? 'Chargement du document...' : 
               currentMode === 'office-online' ? 'Chargement via Office Online...' :
               'Chargement via Google Docs...'}
            </span>
          </div>
        )}
        <iframe
          src={currentUrl}
          className="w-full h-full border"
          onLoad={handleLoadSuccess}
          onError={handleLoadError}
          title={`Aperçu de ${document.ai_generated_name || document.original_name}`}
          style={{ display: isLoading ? 'none' : 'block' }}
          sandbox="allow-same-origin allow-scripts"
        />
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
              {currentMode !== 'direct' && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {currentMode === 'office-online' ? 'Office Online' : 
                   currentMode === 'google-docs' ? 'Google Docs' : ''}
                </span>
              )}
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="overflow-y-auto">
          {renderPreview()}
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
