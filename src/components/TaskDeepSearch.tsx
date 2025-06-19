
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Loader2, Copy, Bot, ChevronUp, ChevronDown, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeepSearchContent } from "@/utils/deepSearchRenderer";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";

interface TaskDeepSearchProps {
  todoId: string;
  todoDescription: string;
}

export const TaskDeepSearch = ({ todoId, todoDescription }: TaskDeepSearchProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [userContext, setUserContext] = useState("");
  const [searchResult, setSearchResult] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState("search");
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
      }
    } catch (error) {
      console.error('Error loading existing results:', error);
      setHasExistingResults(false);
      setSearchResult("");
      setSources([]);
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
        
        console.log('✅ Search result received:', result.substring(0, 200) + '...');
        console.log('📚 Sources received:', sourcesData.length, 'sources');
        
        setSearchResult(result);
        setSources(sourcesData);
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

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between text-foreground hover:text-foreground p-2 pl-1"
        >
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-purple-500" />
            <span className="text-sm text-black">Deep Search</span>
            <Search className="h-3 w-3" />
            {hasExistingResults && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs h-4">
                Résultats disponibles
              </Badge>
            )}
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-2">
        <Card className="border-dashed">
          <CardContent className="p-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
              <TabsList className="grid w-full grid-cols-2 h-7">
                <TabsTrigger value="search" className="text-xs">Nouvelle Recherche</TabsTrigger>
                <TabsTrigger value="result" className="text-xs">Résultat</TabsTrigger>
              </TabsList>

              <TabsContent value="search" className="space-y-3 mt-3">
                <div>
                  <label className="text-xs font-medium mb-1 block">
                    Contexte additionnel pour la recherche :
                  </label>
                  <Textarea
                    placeholder="Décrivez les points spécifiques que vous souhaitez approfondir..."
                    value={userContext}
                    onChange={(e) => setUserContext(e.target.value)}
                    rows={3}
                    className="resize-none text-xs"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleDeepSearch} 
                    disabled={isSearching || !userContext.trim()}
                    size="sm"
                    className="h-7 text-xs"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Recherche...
                      </>
                    ) : (
                      <>
                        <Search className="h-3 w-3 mr-1" />
                        Lancer
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="result" className="space-y-3 mt-3">
                {searchResult && searchResult.trim() ? (
                  <>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                        Recherche terminée
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(searchResult)}
                        className="h-6 text-xs"
                      >
                        <Copy className="h-3 w-3 mr-1" />
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
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    {isSearching ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs">Recherche en cours...</span>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs mb-1">Aucun résultat à afficher</p>
                        <p className="text-xs opacity-70">Effectuez d'abord une recherche</p>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};
