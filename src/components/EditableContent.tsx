
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Edit2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Editor } from '@tinymce/tinymce-react';

interface EditableContentProps {
  content: string;
  onSave: (newContent: string) => void;
  type: 'summary' | 'todo';
  id: string;
  className?: string;
}

export const EditableContent = ({ content, onSave, type, id, className }: EditableContentProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (editedContent === content) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      let error;
      
      if (type === 'summary') {
        const { error: updateError } = await supabase
          .from('meetings')
          .update({ summary: editedContent })
          .eq('id', id);
        error = updateError;
      } else {
        const { error: updateError } = await supabase
          .from('todos')
          .update({ description: editedContent })
          .eq('id', id);
        error = updateError;
      }

      if (error) throw error;

      onSave(editedContent);
      setIsEditing(false);
      toast({
        title: "Sauvegardé",
        description: `${type === 'summary' ? 'Résumé' : 'Tâche'} mis à jour avec succès`,
      });
    } catch (error: any) {
      console.error('Error saving:', error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les modifications",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedContent(content);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className={className}>
        {type === 'summary' ? (
          <div className="border rounded-md">
            <Editor
              apiKey="no-api-key"
              value={editedContent}
              onEditorChange={(value) => setEditedContent(value || '')}
              init={{
                height: 300,
                menubar: false,
                plugins: [
                  'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                  'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                  'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
                ],
                toolbar: 'undo redo | blocks | bold italic forecolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | help',
                content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
                branding: false,
                disabled: isSaving
              }}
            />
          </div>
        ) : (
          <Input
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            disabled={isSaving}
          />
        )}
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="h-3 w-3 mr-1" />
            Sauvegarder
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            <X className="h-3 w-3 mr-1" />
            Annuler
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`group ${className}`}>
      <div className="relative">
        {type === 'summary' ? (
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ) : (
          <span>{content}</span>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsEditing(true)}
          className="absolute -right-8 top-0 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
        >
          <Edit2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};
