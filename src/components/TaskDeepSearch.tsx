
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
  const { toast } = useToast();

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
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Deep Search - Recherche Spécialisée
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Tâche: <span className="font-medium">{todoDescription}</span>
            </p>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
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

            <TabsContent value="result" className="space-y-3 flex-1 flex flex-col">
              {searchResult ? (
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
                  <ScrollArea className="flex-1 w-full border rounded-md p-4 max-h-[50vh]">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {searchResult}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground flex-1 flex items-center justify-center">
                  Aucun résultat à afficher. Effectuez d'abord une recherche.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
};
