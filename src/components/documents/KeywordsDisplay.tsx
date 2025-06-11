
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Filter, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface KeywordsDisplayProps {
  onCategoryClick?: (category: string | null) => void;
  selectedCategory?: string | null;
}

export const KeywordsDisplay = ({ onCategoryClick, selectedCategory }: KeywordsDisplayProps) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const validCategories = [
    "Administratif", 
    "Marketing", 
    "Contrat", 
    "Information médicale", 
    "Fiche Technique Materiel", 
    "Contact",
    "Meeting"
  ];

  const fetchCategories = async () => {
    try {
      // Récupérer les catégories des documents uploadés
      const { data: documents, error: docsError } = await supabase
        .from('uploaded_documents')
        .select('taxonomy')
        .not('taxonomy', 'is', null);

      if (docsError) throw docsError;

      // Récupérer les meetings avec transcript (ils auront automatiquement la catégorie "Meeting")
      const { data: meetings, error: meetingsError } = await supabase
        .from('meetings')
        .select('id')
        .not('transcript', 'is', null);

      if (meetingsError) throw meetingsError;

      const categoriesSet = new Set<string>();
      
      // Ajouter les catégories des documents
      documents?.forEach(doc => {
        if (doc.taxonomy?.category) {
          categoriesSet.add(doc.taxonomy.category);
        }
      });

      // Ajouter "Meeting" s'il y a des meetings avec transcript
      if (meetings && meetings.length > 0) {
        categoriesSet.add("Meeting");
      }

      const sortedCategories = Array.from(categoriesSet).sort();
      setCategories(sortedCategories);
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les catégories",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">
            Chargement des catégories...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          <CardTitle>Filtrer par catégorie</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {/* Bouton "Toutes les catégories" */}
          <Badge
            variant={selectedCategory === null ? "default" : "secondary"}
            className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
            onClick={() => onCategoryClick?.(null)}
          >
            Toutes les catégories
          </Badge>
          
          {/* Filtres par catégorie disponible */}
          {categories.map((category, index) => (
            <Badge
              key={index}
              variant={selectedCategory === category ? "default" : "secondary"}
              className={`cursor-pointer hover:bg-primary hover:text-primary-foreground flex items-center gap-1 ${
                category === "Meeting" ? "bg-blue-100 text-blue-800 hover:bg-blue-500 hover:text-white" : ""
              }`}
              onClick={() => onCategoryClick?.(category)}
            >
              {category}
              {selectedCategory === category && (
                <X 
                  className="h-3 w-3 ml-1" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onCategoryClick?.(null);
                  }}
                />
              )}
            </Badge>
          ))}
        </div>
        
        {categories.length === 0 && (
          <div className="text-center text-muted-foreground py-4">
            Aucune catégorie disponible
          </div>
        )}
      </CardContent>
    </Card>
  );
};
