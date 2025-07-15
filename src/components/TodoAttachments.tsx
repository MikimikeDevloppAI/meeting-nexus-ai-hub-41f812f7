import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Paperclip, Download, Trash2, FileText, Image, File } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  content_type: string | null;
  created_at: string;
  created_by: string | null;
}

interface TodoAttachmentsProps {
  todoId: string;
}

export function TodoAttachments({ todoId }: TodoAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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
                  onClick={() => downloadFile(attachment)}
                  className="h-6 w-6 p-0 hover:bg-blue-100 hover:text-blue-600"
                >
                  <Download className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteAttachment(attachment)}
                  className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}