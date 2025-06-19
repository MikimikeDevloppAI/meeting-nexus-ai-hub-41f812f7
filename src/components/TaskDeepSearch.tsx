import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Loader2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TaskDeepSearchProps {
  todoId: string;
  todoDescription: string;
}

export const TaskDeepSearch = ({ todoId, todoDescription }: TaskDeepSearchProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [userContext, setUserContext] = useState("");
  const [searchResult, setSearchResult] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState("search");
  const [hasExistingResults, setHasExistingResults] = useState(false);
  const { toast } = useToast();

  // Charger les résultats existants quand le dialog s'ouvre
  useEffect(() => {
    if (isOpen) {
      loadExistingResults();
    }
  }, [isOpen, todoId]);

  const loadExistingResults = async () => {
    try {
      const { data, error } = await supabase
        .from('task_deep_searches')
        .select('search_result')
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
        setHasExistingResults(true);
        setActiveTab("result");
        console.log('Loaded existing result:', data.search_result.substring(0, 100) + '...');
      } else {
        setHasExistingResults(false);
        setSearchResult("");
        setActiveTab("search");
      }
    } catch (error) {
      console.error('Error loading existing results:', error);
      setHasExistingResults(false);
      setSearchResult("");
      setActiveTab("search");
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
        console.log('✅ Search result received:', result.substring(0, 200) + '...');
        
        setSearchResult(result);
        setHasExistingResults(true);
        setActiveTab("result");

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
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="h-8 px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
      >
        <Search className="h-4 w-4 mr-1" />
        Deep Search
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Deep Search - Recherche Spécialisée
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Tâche: <span className="font-medium">{todoDescription}</span>
            </p>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="search">Nouvelle Recherche</TabsTrigger>
              <TabsTrigger value="result">Résultat</TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="space-y-4 flex-1">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Contexte additionnel pour la recherche :
                </label>
                <Textarea
                  placeholder="Décrivez les points spécifiques que vous souhaitez approfondir, les contraintes particulières, ou tout contexte qui pourrait aider à obtenir des résultats plus précis..."
                  value={userContext}
                  onChange={(e) => setUserContext(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Annuler
                </Button>
                <Button 
                  onClick={handleDeepSearch} 
                  disabled={isSearching || !userContext.trim()}
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
              </DialogFooter>
            </TabsContent>

            <TabsContent value="result" className="space-y-3 flex-1 min-h-0 flex flex-col">
              {searchResult && searchResult.trim() ? (
                <>
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
                  <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
                    <ScrollArea className="h-[400px] w-full">
                      <div className="p-4 text-sm leading-relaxed whitespace-pre-wrap break-words hyphens-auto" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                        {searchResult}
                      </div>
                    </ScrollArea>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground flex-1 flex items-center justify-center">
                  {isSearching ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Recherche en cours...
                    </div>
                  ) : (
                    <div>
                      <p className="mb-2">Aucun résultat à afficher</p>
                      <p className="text-xs">Effectuez d'abord une recherche dans l'onglet "Nouvelle Recherche"</p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
};
