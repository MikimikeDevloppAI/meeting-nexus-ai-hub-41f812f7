import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Search, Loader2, Copy, Maximize2, HelpCircle, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DeepSearchContent } from "@/utils/deepSearchRenderer";
import { TaskDeepSearchFollowups } from "./TaskDeepSearchFollowups";

interface TaskDeepSearchContentProps {
  todoId: string;
  todoDescription: string;
}

interface EnrichmentQuestion {
  question: string;
  answer: string;
}

export const TaskDeepSearchContent = ({ todoId, todoDescription }: TaskDeepSearchContentProps) => {
  const [userContext, setUserContext] = useState("");
  const [searchResult, setSearchResult] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasExistingResults, setHasExistingResults] = useState(false);
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
  const [currentDeepSearchId, setCurrentDeepSearchId] = useState<string | null>(null);
  
  // États pour les questions d'enrichissement
  const [searchPhase, setSearchPhase] = useState<'input' | 'questions' | 'result'>('input');
  const [enrichmentQuestions, setEnrichmentQuestions] = useState<string[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<EnrichmentQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    loadExistingResults();
  }, [todoId]);

  const loadExistingResults = async () => {
    try {
      console.log('🔍 Chargement des résultats existants pour todo:', todoId);
      
      const { data, error } = await supabase
        .from('task_deep_searches')
        .select('id, search_result, sources')
        .eq('todo_id', todoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading existing results:', error);
        return;
      }

      if (data?.search_result) {
        console.log('✅ Résultats existants trouvés, ID:', data.id);
        setSearchResult(data.search_result);
        setSources(data.sources || []);
        setCurrentDeepSearchId(data.id);
        setHasExistingResults(true);
        setSearchPhase('result');
      } else {
        console.log('❌ Aucun résultat existant trouvé');
        setHasExistingResults(false);
        setSearchResult("");
        setSources([]);
        setCurrentDeepSearchId(null);
        setSearchPhase('input');
      }
    } catch (error) {
      console.error('Error loading existing results:', error);
      setHasExistingResults(false);
      setSearchResult("");
      setSources([]);
      setCurrentDeepSearchId(null);
      setSearchPhase('input');
    }
  };

  const handleInitialSearch = async () => {
    if (!userContext.trim()) {
      toast({
        title: "Contexte requis",
        description: "Veuillez ajouter du contexte pour la recherche",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingQuestions(true);
    setEnrichmentQuestions([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      console.log('🔍 Génération des questions d\'enrichissement (obligatoire)');

      const response = await supabase.functions.invoke('task-deep-search', {
        body: {
          todoId,
          userContext: userContext.trim(),
          todoDescription
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erreur lors de la génération des questions');
      }

      if (response.data?.success && response.data?.phase === 'questions') {
        const questions = response.data.questions || [];
        console.log('✅ Questions reçues:', questions.length);
        
        setEnrichmentQuestions(questions);
        setQuestionAnswers(questions.map(q => ({ question: q, answer: '' })));
        setSearchPhase('questions');

        toast({
          title: "Questions d'enrichissement",
          description: `${questions.length} questions ont été générées pour affiner votre recherche`,
        });
      } else {
        throw new Error(response.data?.error || 'Erreur lors de la génération des questions');
      }

    } catch (error: any) {
      console.error('❌ Erreur génération questions:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de générer les questions",
        variant: "destructive",
      });
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const handleFinalSearch = async () => {
    setIsSearching(true);
    setSearchResult("");
    setSources([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      console.log('🔍 Lancement de la recherche finale avec Perplexity');

      const response = await supabase.functions.invoke('task-deep-search', {
        body: {
          todoId,
          userContext: userContext.trim(),
          todoDescription,
          enrichmentAnswers: questionAnswers.filter(qa => qa.answer.trim())
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erreur lors de la recherche');
      }

      if (response.data?.success && response.data?.phase === 'result') {
        const result = response.data.result;
        const sourcesData = response.data.sources || [];
        
        console.log('✅ Résultat de recherche reçu:', result.substring(0, 200) + '...');
        console.log('📚 Sources reçues:', sourcesData.length, 'sources');
        
        setSearchResult(result);
        setSources(sourcesData);
        setHasExistingResults(true);
        setSearchPhase('result');

        // Recharger pour obtenir l'ID de la nouvelle recherche
        setTimeout(() => loadExistingResults(), 1000);

        toast({
          title: "Recherche terminée",
          description: "Les résultats ont été sauvegardés avec Perplexity",
        });
      } else {
        throw new Error(response.data?.error || 'Erreur inconnue');
      }

    } catch (error: any) {
      console.error('❌ Erreur recherche finale:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'effectuer la recherche",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAnswerChange = (index: number, answer: string) => {
    setQuestionAnswers(prev => 
      prev.map((qa, i) => i === index ? { ...qa, answer } : qa)
    );
  };

  const resetSearch = () => {
    setSearchPhase('input');
    setEnrichmentQuestions([]);
    setQuestionAnswers([]);
    setSearchResult("");
    setSources([]);
    setCurrentDeepSearchId(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copié",
      description: "Le contenu a été copié dans le presse-papiers",
    });
  };

  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-purple-600" />
              <span className="font-medium text-sm">Recherche approfondie (Perplexity)</span>
            </div>
            <div className="flex items-center gap-2">
              {hasExistingResults && (
                <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                  Résultats disponibles
                </Badge>
              )}
              {searchPhase === 'questions' && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                  Questions d'enrichissement
                </Badge>
              )}
            </div>
          </div>

          {searchPhase === 'input' && (
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
                onClick={handleInitialSearch} 
                disabled={isLoadingQuestions || !userContext.trim()}
                size="sm"
                className="w-full"
              >
                {isLoadingQuestions ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Génération des questions d'enrichissement...
                  </>
                ) : (
                  <>
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Commencer la recherche approfondie
                  </>
                )}
              </Button>
            </div>
          )}

          {searchPhase === 'questions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Questions d'enrichissement</h4>
                <Button variant="ghost" size="sm" onClick={resetSearch}>
                  Recommencer
                </Button>
              </div>
              
              <div className="bg-blue-50 p-3 rounded-md border-l-4 border-blue-400">
                <p className="text-xs text-blue-800 mb-2 font-medium">
                  💡 Ces questions nous aident à mieux comprendre vos besoins
                </p>
                <p className="text-xs text-blue-700">
                  Répondez aux questions qui vous semblent pertinentes. Vous pouvez laisser certaines vides si elles ne s'appliquent pas à votre situation.
                </p>
              </div>
              
              <div className="space-y-3">
                {enrichmentQuestions.map((question, index) => (
                  <div key={index} className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {index + 1}. {question}
                    </label>
                    <Input
                      placeholder="Votre réponse (optionnelle)..."
                      value={questionAnswers[index]?.answer || ''}
                      onChange={(e) => handleAnswerChange(index, e.target.value)}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
              
              <Button 
                onClick={handleFinalSearch} 
                disabled={isSearching}
                size="sm"
                className="w-full"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Recherche en cours avec Perplexity...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Lancer la recherche finale
                  </>
                )}
              </Button>
            </div>
          )}

          {searchPhase === 'result' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={resetSearch}>
                    Nouvelle recherche
                  </Button>
                  {searchResult && searchResult.trim() && (
                    <>
                      <Dialog open={isFullScreenOpen} onOpenChange={setIsFullScreenOpen}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Maximize2 className="h-4 w-4 mr-1" />
                            Plein écran
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] flex flex-col p-0">
                          <DialogHeader className="px-6 py-4 border-b shrink-0">
                            <DialogTitle>Résultat de la recherche approfondie (Perplexity)</DialogTitle>
                          </DialogHeader>
                          <div className="flex-1 min-h-0 p-6">
                            <ScrollArea className="h-full w-full">
                              <div className="space-y-8 pr-4">
                                <div>
                                  <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-lg">Résultat principal</h3>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => copyToClipboard(searchResult)}
                                    >
                                      <Copy className="h-4 w-4 mr-1" />
                                      Copier tout
                                    </Button>
                                  </div>
                                  <div className="border rounded-md bg-gray-50">
                                    <ScrollArea className="h-[500px] w-full">
                                      <div className="p-4">
                                        <DeepSearchContent text={searchResult} sources={sources} />
                                      </div>
                                    </ScrollArea>
                                  </div>
                                </div>
                                
                                {currentDeepSearchId && (
                                  <div>
                                    <Separator className="my-6" />
                                    <TaskDeepSearchFollowups 
                                      deepSearchId={currentDeepSearchId}
                                      todoId={todoId}
                                      todoDescription={todoDescription}
                                      isFullScreen={true}
                                    />
                                  </div>
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyToClipboard(searchResult)}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copier
                      </Button>
                    </>
                  )}
                </div>
              </div>
              
              {searchResult && searchResult.trim() ? (
                <>
                  <div className="border rounded-md overflow-hidden">
                    <ScrollArea className="h-[300px] w-full">
                      <div className="p-3">
                        <DeepSearchContent text={searchResult} sources={sources} />
                      </div>
                    </ScrollArea>
                  </div>
                  
                  {currentDeepSearchId && (
                    <>
                      <Separator />
                      <div className="max-h-[600px] overflow-y-auto">
                        <TaskDeepSearchFollowups 
                          deepSearchId={currentDeepSearchId}
                          todoId={todoId}
                          todoDescription={todoDescription}
                          isFullScreen={false}
                        />
                      </div>
                    </>
                  )}
                </>
              ) : isSearching ? (
                <div className="text-center py-6 text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Recherche en cours avec Perplexity...</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">Aucun résultat à afficher</p>
                  <p className="text-xs opacity-70">La recherche n'a pas retourné de résultats</p>
                  <Button variant="ghost" size="sm" onClick={resetSearch} className="mt-2">
                    Recommencer
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
