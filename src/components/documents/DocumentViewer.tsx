
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Download, ExternalLink, X, Loader2 } from "lucide-react";
import { UnifiedDocumentItem } from "@/types/unified-document";
import { getDocumentViewUrl, getDocumentDownloadUrl } from "@/lib/utils";

interface DocumentViewerProps {
  document: UnifiedDocumentItem;
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentViewer = ({ document, isOpen, onClose }: DocumentViewerProps) => {
  const [viewerError, setViewerError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  const handleLoadSuccess = () => {
    setIsLoading(false);
    setViewerError(false);
  };

  const handleLoadError = () => {
    setIsLoading(false);
    setViewerError(true);
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
      return (
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <FileText className="h-16 w-16 text-gray-400 mb-4" />
          <p className="text-gray-600 mb-4">
            Impossible d'afficher ce document dans le navigateur
          </p>
          <div className="flex gap-2">
            <Button onClick={handleDownload} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Télécharger le document
            </Button>
            {isOfficeDoc && (
              <Button 
                variant="outline" 
                onClick={() => window.open(`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(viewUrl)}`, '_blank')}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Ouvrir avec Office Online
              </Button>
            )}
          </div>
        </div>
      );
    }

    if (isPdf) {
      return (
        <div className="w-full h-96 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}
          <iframe
            src={`${viewUrl}#view=FitH`}
            className="w-full h-full border"
            onLoad={handleLoadSuccess}
            onError={handleLoadError}
            title={`Aperçu de ${document.ai_generated_name || document.original_name}`}
            style={{ display: isLoading ? 'none' : 'block' }}
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
          />
        </div>
      );
    }

    if (isOfficeDoc) {
      // Try Google Docs Viewer first, with fallback to Office Online
      return (
        <div className="w-full h-96 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}
          <iframe
            src={`https://docs.google.com/gview?url=${encodeURIComponent(viewUrl)}&embedded=true`}
            className="w-full h-full border"
            onLoad={handleLoadSuccess}
            onError={handleLoadError}
            title={`Aperçu de ${document.ai_generated_name || document.original_name}`}
            style={{ display: isLoading ? 'none' : 'block' }}
          />
          {viewerError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white">
              <FileText className="h-16 w-16 text-blue-600 mb-4" />
              <p className="text-gray-600 mb-2">
                Document Office : {document.ai_generated_name || document.original_name}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Aperçu non disponible, essayez de télécharger ou d'ouvrir en externe
              </p>
              <div className="flex gap-2">
                <Button onClick={handleDownload} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Télécharger
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.open(`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(viewUrl)}`, '_blank')}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Office Online
                </Button>
              </div>
            </div>
          )}
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
