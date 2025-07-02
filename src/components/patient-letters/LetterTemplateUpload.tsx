
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface LetterTemplateUploadProps {
  onTemplateUploaded: (templateUrl: string) => void;
  currentTemplate?: string;
}

export const LetterTemplateUpload = ({ onTemplateUploaded, currentTemplate }: LetterTemplateUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

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

      toast({
        title: "Template uploadé",
        description: "Votre papier à en-tête a été uploadé avec succès",
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

  const removeTemplate = () => {
    onTemplateUploaded("");
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
          {currentTemplate ? (
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-600" />
                <span className="text-sm">Template PDF chargé</span>
              </div>
              <Button
                onClick={removeTemplate}
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-sm text-gray-600 mb-4">
                Uploadez votre papier à en-tête au format PDF
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
          )}
        </div>
      </CardContent>
    </Card>
  );
};
