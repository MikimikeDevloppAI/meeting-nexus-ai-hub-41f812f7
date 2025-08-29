
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
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
      <div className="text-center text-muted-foreground py-2">
        Chargement des catégories...
      </div>
    );
  }

  return (
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
      
      {categories.length === 0 && (
        <div className="text-center text-muted-foreground py-4">
          Aucune catégorie disponible
        </div>
      )}
    </div>
  );
};
