
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RefreshCw, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface KeywordsDisplayProps {
  onKeywordClick?: (keyword: string) => void;
}

export const KeywordsDisplay = ({ onKeywordClick }: KeywordsDisplayProps) => {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const { toast } = useToast();

  const fetchKeywords = async () => {
    try {
      const { data: documents, error } = await supabase
        .from('uploaded_documents')
        .select('taxonomy')
        .not('taxonomy', 'is', null);

      if (error) throw error;

      const keywordsSet = new Set<string>();
      documents?.forEach(doc => {
        if (doc.taxonomy?.keywords) {
          doc.taxonomy.keywords.forEach((keyword: string) => {
            keywordsSet.add(keyword);
          });
        }
      });

      const sortedKeywords = Array.from(keywordsSet).sort();
      setKeywords(sortedKeywords);
    } catch (error: any) {
      console.error('Error fetching keywords:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les mots-clés",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const normalizeAllKeywords = async () => {
    setIsNormalizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('normalize-keywords');
      
      if (error) throw error;

      toast({
        title: "Normalisation terminée",
        description: `${data.processedDocuments} documents mis à jour avec des mots-clés normalisés`,
      });

      // Recharger les mots-clés après normalisation
      await fetchKeywords();
    } catch (error: any) {
      console.error('Error normalizing keywords:', error);
      toast({
        title: "Erreur",
        description: "Impossible de normaliser les mots-clés",
        variant: "destructive",
      });
    } finally {
      setIsNormalizing(false);
    }
  };

  useEffect(() => {
    fetchKeywords();
  }, []);

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">
            Chargement des mots-clés...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            <CardTitle>Mots-clés disponibles ({keywords.length})</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={normalizeAllKeywords}
            disabled={isNormalizing}
          >
            {isNormalizing ? (
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Normaliser les mots-clés
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {keywords.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            Aucun mot-clé disponible
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword, index) => (
              <Badge
                key={index}
                variant="secondary"
                className={onKeywordClick ? "cursor-pointer hover:bg-primary hover:text-primary-foreground" : ""}
                onClick={() => onKeywordClick?.(keyword)}
              >
                {keyword}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
