
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Loader2, History, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TaskDeepSearchProps {
  todoId: string;
  todoDescription: string;
}

interface DeepSearchResult {
  id: string;
  user_context: string;
  search_result: string;
  created_at: string;
  created_by: string;
}

export const TaskDeepSearch = ({ todoId, todoDescription }: TaskDeepSearchProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [userContext, setUserContext] = useState("");
  const [searchResult, setSearchResult] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<DeepSearchResult[]>([]);
  const [activeTab, setActiveTab] = useState("search");
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchSearchHistory();
    }
  }, [isOpen, todoId]);

  const fetchSearchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('task_deep_searches')
        .select('*')
        .eq('todo_id', todoId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSearchHistory(data || []);
    } catch (error: any) {
      console.error('Error fetching search history:', error);
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
        setSearchResult(response.data.result);
        setActiveTab("result");
        
        // Rafraîchir l'historique
        await fetchSearchHistory();

        toast({
          title: "Recherche terminée",
          description: "Les résultats ont été sauvegardés",
        });
      } else {
        throw new Error(response.data?.error || 'Erreur inconnue');
      }

    } catch (error: any) {
      console.error('Deep search error:', error);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
        <DialogContent className="sm:max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Deep Search - Recherche Spécialisée
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Tâche: <span className="font-medium">{todoDescription}</span>
            </p>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="search">Nouvelle Recherche</TabsTrigger>
              <TabsTrigger value="result">Résultat</TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-1">
                <History className="h-4 w-4" />
                Historique ({searchHistory.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="space-y-4">
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

            <TabsContent value="result" className="space-y-4">
              {searchResult ? (
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
                  <ScrollArea className="h-96 w-full border rounded-md p-4">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {searchResult}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun résultat à afficher. Effectuez d'abord une recherche.
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              {searchHistory.length > 0 ? (
                <ScrollArea className="h-96 w-full">
                  <div className="space-y-4">
                    {searchHistory.map((search) => (
                      <div key={search.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">
                            {formatDate(search.created_at)}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(search.search_result)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">
                            Contexte:
                          </p>
                          <p className="text-sm bg-gray-50 p-2 rounded">
                            {search.user_context}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">
                            Résultat:
                          </p>
                          <div className="text-sm bg-blue-50 p-3 rounded max-h-32 overflow-y-auto">
                            {search.search_result.substring(0, 300)}
                            {search.search_result.length > 300 && '...'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune recherche précédente trouvée pour cette tâche.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
};
