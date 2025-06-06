
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Save, X, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from 'react-markdown';

interface EditableContentProps {
  content: string;
  onSave: (newContent: string) => void;
  type: 'summary' | 'todo';
  id: string;
  className?: string;
  isEditing?: boolean;
  onStartEdit?: () => void;
  onStopEdit?: () => void;
}

export const EditableContent = ({ 
  content, 
  onSave, 
  type, 
  id, 
  className,
  isEditing = false,
  onStartEdit,
  onStopEdit
}: EditableContentProps) => {
  const [internalIsEditing, setInternalIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  // Use external editing state if provided, otherwise use internal state
  const actualIsEditing = onStartEdit ? isEditing : internalIsEditing;

  const handleStartEdit = () => {
    if (onStartEdit) {
      onStartEdit();
    } else {
      setInternalIsEditing(true);
    }
    setEditedContent(content);
  };

  const handleSave = async () => {
    if (editedContent === content) {
      handleCancel();
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
      handleCancel();
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
    setShowPreview(false);
    if (onStopEdit) {
      onStopEdit();
    } else {
      setInternalIsEditing(false);
    }
  };

  if (actualIsEditing) {
    return (
      <div className={className}>
        {type === 'summary' ? (
          <div className="space-y-3">
            <div className="flex gap-2 mb-2">
              <Button
                size="sm"
                variant={showPreview ? "outline" : "secondary"}
                onClick={() => setShowPreview(false)}
                disabled={isSaving}
              >
                Éditer
              </Button>
              <Button
                size="sm"
                variant={showPreview ? "secondary" : "outline"}
                onClick={() => setShowPreview(true)}
                disabled={isSaving}
              >
                <Eye className="h-3 w-3 mr-1" />
                Aperçu
              </Button>
            </div>
            
            {showPreview ? (
              <div className="border rounded-md p-4 bg-gray-50 min-h-[300px]">
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown 
                    components={{
                      h1: ({ children }) => <h1 className="text-xl font-bold mb-3 text-gray-900">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-bold mb-2 text-gray-800">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-bold mb-2 text-gray-700">{children}</h3>,
                      strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                      ul: ({ children }) => <ul className="list-disc ml-6 mb-3 space-y-1">{children}</ul>,
                      li: ({ children }) => <li className="text-sm text-gray-700">{children}</li>,
                      p: ({ children }) => <p className="mb-2 text-sm text-gray-700">{children}</p>,
                    }}
                  >
                    {editedContent || '*Aperçu vide*'}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                disabled={isSaving}
                rows={15}
                className="font-mono text-sm"
                placeholder="Écrivez votre résumé en Markdown..."
              />
            )}
          </div>
        ) : (
          <Input
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            disabled={isSaving}
            autoFocus
          />
        )}
        <div className="flex gap-2 mt-3">
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
    <div className={`group ${className}`} onClick={handleStartEdit}>
      <div className="relative cursor-pointer hover:bg-gray-50 rounded p-1 -m-1">
        {type === 'summary' ? (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown 
              components={{
                h1: ({ children }) => <h1 className="text-xl font-bold mb-3 text-gray-900">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-bold mb-2 text-gray-800">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-bold mb-2 text-gray-700">{children}</h3>,
                strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                ul: ({ children }) => <ul className="list-disc ml-6 mb-3 space-y-1">{children}</ul>,
                li: ({ children }) => <li className="text-sm text-gray-700">{children}</li>,
                p: ({ children }) => <p className="mb-2 text-sm text-gray-700">{children}</p>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <span>{content}</span>
        )}
      </div>
    </div>
  );
};
