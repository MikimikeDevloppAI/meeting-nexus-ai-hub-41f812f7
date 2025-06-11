
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit2, Save, X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DocumentMetadataEditorProps {
  document: {
    id: string;
    taxonomy: any;
    ai_generated_name: string | null;
    original_name: string;
  };
  onUpdate: () => void;
}

export const DocumentMetadataEditor = ({ document, onUpdate }: DocumentMetadataEditorProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [category, setCategory] = useState(document.taxonomy?.category || "");
  const [subcategory, setSubcategory] = useState(document.taxonomy?.subcategory || "");
  const [documentType, setDocumentType] = useState(document.taxonomy?.documentType || "");
  const [keywords, setKeywords] = useState<string[]>(document.taxonomy?.keywords || []);
  const [newKeyword, setNewKeyword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const validCategories = [
    "Administratif", 
    "Marketing", 
    "Contrat", 
    "Information médicale", 
    "Fiche Technique Materiel", 
    "Contact"
  ];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedTaxonomy = {
        category,
        subcategory,
        documentType,
        keywords: keywords.filter(k => k.trim().length > 0)
      };

      const { error } = await supabase
        .from('uploaded_documents')
        .update({ taxonomy: updatedTaxonomy })
        .eq('id', document.id);

      if (error) throw error;

      toast({
        title: "Métadonnées mises à jour",
        description: "Les informations du document ont été sauvegardées",
      });

      setIsEditing(false);
      onUpdate();
    } catch (error: any) {
      console.error('Error updating document metadata:', error);
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
    setCategory(document.taxonomy?.category || "");
    setSubcategory(document.taxonomy?.subcategory || "");
    setDocumentType(document.taxonomy?.documentType || "");
    setKeywords(document.taxonomy?.keywords || []);
    setNewKeyword("");
    setIsEditing(false);
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()]);
      setNewKeyword("");
    }
  };

  const removeKeyword = (keywordToRemove: string) => {
    setKeywords(keywords.filter(k => k !== keywordToRemove));
  };

  if (!isEditing) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {document.taxonomy?.category && (
            <Badge variant="secondary">{document.taxonomy.category}</Badge>
          )}
          {document.taxonomy?.subcategory && (
            <Badge variant="outline">{document.taxonomy.subcategory}</Badge>
          )}
          {document.taxonomy?.documentType && (
            <Badge variant="outline">{document.taxonomy.documentType}</Badge>
          )}
          {document.taxonomy?.keywords?.map((keyword: string, index: number) => (
            <Badge key={index} variant="outline" className="text-xs">
              {keyword}
            </Badge>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsEditing(true)}
        >
          <Edit2 className="h-4 w-4 mr-1" />
          Modifier
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Modifier les métadonnées</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="category">Catégorie</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une catégorie" />
            </SelectTrigger>
            <SelectContent>
              {validCategories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="subcategory">Sous-catégorie</Label>
          <Input
            id="subcategory"
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
            placeholder="Sous-catégorie (optionnel)"
          />
        </div>

        <div>
          <Label htmlFor="documentType">Type de document</Label>
          <Input
            id="documentType"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            placeholder="Type de document (optionnel)"
          />
        </div>

        <div>
          <Label>Mots-clés</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {keywords.map((keyword, index) => (
              <Badge key={index} variant="outline" className="flex items-center gap-1">
                {keyword}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-red-500" 
                  onClick={() => removeKeyword(keyword)}
                />
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="Ajouter un mot-clé"
              onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addKeyword}
              disabled={!newKeyword.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
