
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Trash2, Eye, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface LetterTemplate {
  id: string;
  filename: string;
  file_url: string;
  created_at: string;
}

interface LetterTemplateUploadProps {
  onTemplateUploaded: (templateUrl: string) => void;
  currentTemplate?: string;
}

export const LetterTemplateUpload = ({ onTemplateUploaded, currentTemplate }: LetterTemplateUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<LetterTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const { toast } = useToast();

  // Charger les templates sauvegardés au montage du composant
  useEffect(() => {
    loadSavedTemplates();
  }, []);

  const loadSavedTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('letter_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedTemplates(data || []);
    } catch (error) {
      console.error("Error loading saved templates:", error);
    }
  };

  const saveTemplateToDatabase = async (filename: string, fileUrl: string) => {
    try {
      const { error } = await supabase
        .from('letter_templates')
        .insert({
          filename,
          file_url: fileUrl,
          user_id: null // Publique pour tous
        });

      if (error) throw error;
      
      // Recharger la liste des templates
      await loadSavedTemplates();
    } catch (error) {
      console.error("Error saving template to database:", error);
      toast({
        title: "Erreur de sauvegarde",
        description: "Impossible de sauvegarder le template en base",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({
        title: "Erreur",
        description: "Seuls les fichiers PDF sont acceptés",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const fileName = `template_${Date.now()}.pdf`;
      const { data, error } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      onTemplateUploaded(urlData.publicUrl);

      // Sauvegarder en base de données
      await saveTemplateToDatabase(file.name, urlData.publicUrl);

      toast({
        title: "Template uploadé",
        description: "Votre papier à en-tête a été uploadé et sauvegardé avec succès",
      });
    } catch (error) {
      console.error("Error uploading template:", error);
      toast({
        title: "Erreur d'upload",
        description: "Impossible d'uploader le template",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const selectTemplate = (template: LetterTemplate) => {
    onTemplateUploaded(template.file_url);
    setSelectedTemplateId(template.id);
    toast({
      title: "Template sélectionné",
      description: `${template.filename} est maintenant actif`,
    });
  };

  const deleteTemplate = async (templateId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    try {
      const { error } = await supabase
        .from('letter_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      // Recharger la liste
      await loadSavedTemplates();

      // Si le template supprimé était sélectionné, le désélectionner
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId(null);
        onTemplateUploaded("");
      }

      toast({
        title: "Template supprimé",
        description: "Le template a été supprimé avec succès",
      });
    } catch (error) {
      console.error("Error deleting template:", error);
      toast({
        title: "Erreur de suppression",
        description: "Impossible de supprimer le template",
        variant: "destructive",
      });
    }
  };

  const removeCurrentTemplate = () => {
    onTemplateUploaded("");
    setSelectedTemplateId(null);
    toast({
      title: "Template supprimé",
      description: "Le papier à en-tête a été supprimé",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Papier à en-tête
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Template actuellement sélectionné */}
          {currentTemplate && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-3 bg-green-50 border-b">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Template PDF actif</span>
                  <Eye className="h-4 w-4 text-green-600" />
                </div>
                <Button
                  onClick={removeCurrentTemplate}
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Templates sauvegardés */}
          {savedTemplates.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Templates sauvegardés :</h4>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {savedTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={`flex items-center justify-between p-2 border rounded cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedTemplateId === template.id ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                    onClick={() => selectTemplate(template)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm truncate">{template.filename}</span>
                      {selectedTemplateId === template.id && (
                        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      )}
                    </div>
                    <Button
                      onClick={(e) => deleteTemplate(template.id, e)}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 flex-shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Zone d'upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-sm text-gray-600 mb-4">
              Uploadez un nouveau papier à en-tête au format PDF
            </p>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
              id="template-upload"
              disabled={isUploading}
            />
            <label htmlFor="template-upload">
              <Button
                asChild
                disabled={isUploading}
                className="cursor-pointer"
              >
                <span>
                  {isUploading ? "Upload en cours..." : "Choisir un fichier PDF"}
                </span>
              </Button>
            </label>
          </div>

          {savedTemplates.length > 0 && (
            <div className="text-xs text-gray-500">
              💡 Cliquez sur un template sauvegardé pour l'utiliser dans votre lettre
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
