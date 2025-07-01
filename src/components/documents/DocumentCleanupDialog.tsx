
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UnifiedDocumentItem } from "@/types/unified-document";

interface DocumentCleanupDialogProps {
  documents: UnifiedDocumentItem[];
  onCleanupComplete: () => void;
}

export const DocumentCleanupDialog = ({ documents, onCleanupComplete }: DocumentCleanupDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [orphanedDocuments, setOrphanedDocuments] = useState<UnifiedDocumentItem[]>([]);
  const { toast } = useToast();

  const scanForOrphanedDocuments = async () => {
    setIsScanning(true);
    const orphaned: UnifiedDocumentItem[] = [];

    try {
      // Vérifier seulement les documents uploadés (pas les meetings)
      const documentsToCheck = documents.filter(doc => doc.type === 'document' && doc.file_path);

      for (const document of documentsToCheck) {
        try {
          const { data: fileList, error } = await supabase.storage
            .from('documents')
            .list('', { search: document.file_path });

          if (error || !fileList || fileList.length === 0) {
            orphaned.push(document);
          }
        } catch (error) {
          console.error(`Error checking file ${document.file_path}:`, error);
          orphaned.push(document);
        }
      }

      setOrphanedDocuments(orphaned);
      
      if (orphaned.length === 0) {
        toast({
          title: "Aucun document orphelin",
          description: "Tous les documents ont leurs fichiers correspondants.",
        });
      }
    } catch (error) {
      console.error('Error scanning for orphaned documents:', error);
      toast({
        title: "Erreur",
        description: "Impossible de scanner les documents orphelins",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const deleteOrphanedDocuments = async () => {
    setIsDeleting(true);
    let deletedCount = 0;

    try {
      for (const document of orphanedDocuments) {
        try {
          const { error } = await supabase
            .from('uploaded_documents')
            .delete()
            .eq('id', document.id);

          if (!error) {
            deletedCount++;
          }
        } catch (error) {
          console.error(`Error deleting document ${document.id}:`, error);
        }
      }

      toast({
        title: "Nettoyage terminé",
        description: `${deletedCount} document(s) orphelin(s) supprimé(s)`,
      });

      setOrphanedDocuments([]);
      setIsOpen(false);
      onCleanupComplete();
    } catch (error) {
      console.error('Error deleting orphaned documents:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la suppression des documents orphelins",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Nettoyer les documents orphelins
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Nettoyage des documents orphelins
          </DialogTitle>
          <DialogDescription>
            Recherchez et supprimez les enregistrements de documents dont les fichiers n'existent plus dans le stockage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {orphanedDocuments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Cliquez sur "Scanner" pour rechercher les documents orphelins
              </p>
              <Button 
                onClick={scanForOrphanedDocuments}
                disabled={isScanning}
                className="flex items-center gap-2"
              >
                {isScanning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                Scanner les documents
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">
                  {orphanedDocuments.length} document(s) orphelin(s) trouvé(s)
                </h4>
                <Badge variant="destructive">
                  Fichiers manquants
                </Badge>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {orphanedDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {doc.ai_generated_name || doc.original_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Fichier: {doc.file_path}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Orphelin
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="flex justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={scanForOrphanedDocuments}
                  disabled={isScanning}
                >
                  Re-scanner
                </Button>
                <Button
                  variant="destructive"
                  onClick={deleteOrphanedDocuments}
                  disabled={isDeleting}
                  className="flex items-center gap-2"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Supprimer tous les orphelins
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
