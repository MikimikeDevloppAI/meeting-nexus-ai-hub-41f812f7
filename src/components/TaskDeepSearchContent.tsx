
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Copy, Send, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DeepSearchContent } from "@/utils/deepSearchRenderer";

interface TaskDeepSearchContentProps {
  todoId: string;
  todoDescription: string;
}

export const TaskDeepSearchContent = ({ todoId, todoDescription }: TaskDeepSearchContentProps) => {
  const [userContext, setUserContext] = useState("");
  const [searchResult, setSearchResult] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [relatedQuestions, setRelatedQuestions] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasExistingResults, setHasExistingResults] = useState(false);
  const { toast } = useToast();

  // Charger les résultats existants quand le composant se monte
  useEffect(() => {
    loadExistingResults();
  }, [todoId]);

  const loadExistingResults = async () => {
    try {
      const { data, error } = await supabase
        .from('task_deep_searches')
        .select('search_result, sources')
        .eq('todo_id', todoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading existing results:', error);
        return;
      }

      if (data?.search_result) {
        setSearchResult(data.search_result);
        setSources(data.sources || []);
        setHasExistingResults(true);
        console.log('Loaded existing result:', data.search_result.substring(0, 100) + '...');
        console.log('Loaded sources:', data.sources?.length || 0, 'sources');
      } else {
        setHasExistingResults(false);
        setSearchResult("");
        setSources([]);
        setRelatedQuestions([]);
      }
    } catch (error) {
      console.error('Error loading existing results:', error);
      setHasExistingResults(false);
      setSearchResult("");
      setSources([]);
      setRelatedQuestions([]);
    }
  };

  const handleDeepSearch = async () => {
    if (!userContext.trim()) {
      toast({
        title: "Contexte requis",
        description: "Veuillez ajouter du contexte pour la recherche",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    setSearchResult("");
    setSources([]);
    setRelatedQuestions([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      console.log('🔍 Starting deep search for todo:', todoId);
      console.log('📝 User context:', userContext);

      const response = await supabase.functions.invoke('task-deep-search', {
        body: {
          todoId,
          userContext: userContext.trim(),
          todoDescription
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erreur lors de la recherche');
      }

      if (response.data?.success) {
        const result = response.data.result;
        const sourcesData = response.data.sources || [];
        const relatedQuestionsData = response.data.relatedQuestions || [];
        
        console.log('✅ Search result received:', result.substring(0, 200) + '...');
        console.log('📚 Sources received:', sourcesData.length, 'sources');
        console.log('🤔 Related questions received:', relatedQuestionsData.length, 'questions');
        
        setSearchResult(result);
        setSources(sourcesData);
        setRelatedQuestions(relatedQuestionsData);
        setHasExistingResults(true);

        toast({
          title: "Recherche terminée",
          description: "Les résultats ont été sauvegardés",
        });
      } else {
        throw new Error(response.data?.error || 'Erreur inconnue');
      }

    } catch (error: any) {
      console.error('❌ Deep search error:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'effectuer la recherche",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copié",
      description: "Le contenu a été copié dans le presse-papiers",
    });
  };

  const handleRelatedQuestionClick = (question: string) => {
    setUserContext(question);
  };

  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header with status indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-purple-600" />
              <span className="font-medium text-sm">Recherche approfondie</span>
            </div>
            {hasExistingResults && (
              <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                Résultats disponibles
              </Badge>
            )}
          </div>

          {/* Search input */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-2 block text-muted-foreground">
                Contexte additionnel pour la recherche :
              </label>
              <Textarea
                placeholder="Décrivez les points spécifiques que vous souhaitez approfondir..."
                value={userContext}
                onChange={(e) => setUserContext(e.target.value)}
                rows={3}
                className="resize-none text-sm"
              />
            </div>
            
            <Button 
              onClick={handleDeepSearch} 
              disabled={isSearching || !userContext.trim()}
              size="sm"
              className="w-full"
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Recherche en cours...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Lancer la recherche
                </>
              )}
            </Button>
          </div>

          {/* Related Questions */}
          {relatedQuestions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Questions connexes :</span>
              </div>
              <div className="grid gap-2">
                {relatedQuestions.slice(0, 4).map((question, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleRelatedQuestionClick(question)}
                    className="text-left h-auto py-2 px-3 text-xs text-wrap justify-start hover:bg-blue-50"
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {searchResult && searchResult.trim() ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Recherche terminée
                </Badge>
                <Button
                  variant="ghost" 
                  size="sm"
                  onClick={() => copyToClipboard(searchResult)}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copier
                </Button>
              </div>
              <div className="border rounded-md overflow-hidden">
                <ScrollArea className="h-[300px] w-full">
                  <div className="p-3">
                    <DeepSearchContent text={searchResult} sources={sources} />
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : isSearching ? (
            <div className="text-center py-6 text-muted-foreground">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Recherche en cours...</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">Aucun résultat à afficher</p>
              <p className="text-xs opacity-70">Effectuez d'abord une recherche</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
