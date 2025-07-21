import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Paperclip, Download, Trash2, FileText, Image, File, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  content_type: string | null;
  created_at: string;
  created_by: string | null;
  extracted_text?: string | null;
}

interface TodoAttachmentsProps {
  todoId: string;
}

export function TodoAttachments({ todoId }: TodoAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchAttachments();
  }, [todoId]);

  const fetchAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from('todo_attachments')
        .select('*')
        .eq('todo_id', todoId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error('Error fetching attachments:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les pièces jointes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File) => {
    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Utilisateur non connecté');

      // Créer un nom de fichier unique
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${todoId}/${fileName}`;

      // Upload du fichier vers Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('todo-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Enregistrer les métadonnées dans la base de données
      const { data, error: dbError } = await supabase
        .from('todo_attachments')
        .insert([{
          todo_id: todoId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          content_type: file.type,
          created_by: user.id
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      setAttachments([data, ...attachments]);

      toast({
        title: 'Fichier ajouté',
        description: `${file.name} a été ajouté avec succès`,
      });

      // Lancer l'extraction de texte en arrière-plan
      extractTextFromAttachment(data.id, file.type);

    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'ajouter le fichier',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const extractTextFromAttachment = async (attachmentId: string, contentType: string) => {
    try {
      console.log('🔍 Starting text extraction for attachment:', attachmentId);
      
      const { data, error } = await supabase.functions.invoke('extract-attachment-text', {
        body: { attachmentId }
      });

      if (error) {
        console.error('Text extraction error:', error);
        return;
      }

      if (data.success) {
        console.log('✅ Text extraction completed:', data.message);
        
        // Refresh attachments to get the updated extracted_text
        fetchAttachments();
        
        if (data.extractedText && data.extractedText.length > 0) {
          toast({
            title: 'Texte extrait',
            description: `Texte extrait du fichier (${data.textLength} caractères)`,
          });
        }
      }
    } catch (error) {
      console.error('Error calling text extraction function:', error);
    }
  };

  const downloadFile = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('todo-attachments')
        .download(attachment.file_path);

      if (error) throw error;

      // Créer un lien de téléchargement
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de télécharger le fichier',
        variant: 'destructive',
      });
    }
  };

  const deleteAttachment = async (attachment: Attachment) => {
    try {
      // Supprimer le fichier du storage
      const { error: storageError } = await supabase.storage
        .from('todo-attachments')
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      // Supprimer l'enregistrement de la base de données
      const { error: dbError } = await supabase
        .from('todo_attachments')
        .delete()
        .eq('id', attachment.id);

      if (dbError) throw dbError;

      setAttachments(attachments.filter(a => a.id !== attachment.id));

      toast({
        title: 'Fichier supprimé',
        description: `${attachment.file_name} a été supprimé`,
      });
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le fichier',
        variant: 'destructive',
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
    // Reset input pour permettre de sélectionner le même fichier à nouveau
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFileIcon = (contentType: string | null) => {
    if (!contentType) return <File className="h-4 w-4" />;
    
    if (contentType.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    } else {
      return <FileText className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const previewFile = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('todo-attachments')
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      setPreviewUrl(url);
      setPreviewAttachment(attachment);
    } catch (error) {
      console.error('Error previewing file:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de prévisualiser le fichier',
        variant: 'destructive',
      });
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewAttachment(null);
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Chargement des pièces jointes...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">
          Pièces jointes ({attachments.length})
        </h4>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="*/*"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="h-6 text-xs"
          >
            <Paperclip className="h-3 w-3 mr-1" />
            {uploading ? 'Upload...' : 'Ajouter'}
          </Button>
        </div>
      </div>

      {/* Liste des pièces jointes */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center gap-2 p-2 rounded-md border border-gray-100 bg-gray-50/30">
              <div className="shrink-0 text-muted-foreground">
                {getFileIcon(attachment.content_type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {attachment.file_name}
                </div>
                {attachment.file_size && (
                  <div className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.file_size)}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => previewFile(attachment)}
                  className="h-6 w-6 p-0 hover:bg-green-100 hover:text-green-600"
                  title="Prévisualiser"
                >
                  <Eye className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadFile(attachment)}
                  className="h-6 w-6 p-0 hover:bg-blue-100 hover:text-blue-600"
                  title="Télécharger"
                >
                  <Download className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteAttachment(attachment)}
                  className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                  title="Supprimer"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog de prévisualisation */}
      <Dialog open={!!previewAttachment} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="truncate">
              {previewAttachment?.file_name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex items-center justify-center p-4 max-h-[70vh] overflow-auto">
            {previewUrl && previewAttachment && (
              <div className="w-full h-full">
                {previewAttachment.content_type?.startsWith('image/') ? (
                  <img 
                    src={previewUrl} 
                    alt={previewAttachment.file_name}
                    className="max-w-full max-h-full object-contain mx-auto"
                  />
                ) : previewAttachment.content_type?.includes('pdf') ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[60vh] border-0"
                    title={previewAttachment.file_name}
                  />
                ) : previewAttachment.content_type?.startsWith('text/') ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[60vh] border border-gray-200 rounded"
                    title={previewAttachment.file_name}
                  />
                ) : (
                  <div className="text-center py-8">
                    <File className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Prévisualisation non disponible pour ce type de fichier
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Type: {previewAttachment.content_type || 'Inconnu'}
                    </p>
                    <Button
                      onClick={() => downloadFile(previewAttachment)}
                      className="mt-4"
                      variant="outline"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Télécharger
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}