
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Download, ExternalLink, X } from "lucide-react";
import { UnifiedDocumentItem } from "@/types/unified-document";

interface DocumentViewerProps {
  document: UnifiedDocumentItem;
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentViewer = ({ document, isOpen, onClose }: DocumentViewerProps) => {
  const [viewerError, setViewerError] = useState(false);

  const isPdf = document.content_type?.includes('pdf');
  const isImage = document.content_type?.startsWith('image/');
  const isOfficeDoc = document.content_type?.includes('office') || 
                     document.content_type?.includes('word') ||
                     document.content_type?.includes('powerpoint') ||
                     document.content_type?.includes('excel');

  const handleDownload = () => {
    if (document.file_path) {
      // Create download URL - in a real app this would be a signed URL from Supabase
      const downloadUrl = `${document.file_path}?download=true`;
      window.open(downloadUrl, '_blank');
    }
  };

  const renderViewer = () => {
    if (viewerError) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <FileText className="h-16 w-16 text-gray-400 mb-4" />
          <p className="text-gray-600 mb-4">
            Impossible d'afficher ce document dans le navigateur
          </p>
          <Button onClick={handleDownload} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Télécharger le document
          </Button>
        </div>
      );
    }

    if (isPdf && document.file_path) {
      return (
        <div className="w-full h-96">
          <iframe
            src={`${document.file_path}#view=FitH`}
            className="w-full h-full border"
            onError={() => setViewerError(true)}
            title={`Aperçu de ${document.ai_generated_name || document.original_name}`}
          />
        </div>
      );
    }

    if (isImage && document.file_path) {
      return (
        <div className="flex justify-center">
          <img
            src={document.file_path}
            alt={document.ai_generated_name || document.original_name}
            className="max-w-full max-h-96 object-contain"
            onError={() => setViewerError(true)}
          />
        </div>
      );
    }

    if (isOfficeDoc) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <FileText className="h-16 w-16 text-blue-600 mb-4" />
          <p className="text-gray-600 mb-2">
            Document Office : {document.ai_generated_name || document.original_name}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Les documents Office ne peuvent pas être affichés directement dans le navigateur
          </p>
          <div className="flex gap-2">
            <Button onClick={handleDownload} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Télécharger
            </Button>
            {document.file_path && (
              <Button 
                variant="outline" 
                onClick={() => window.open(`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(document.file_path)}`, '_blank')}
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
