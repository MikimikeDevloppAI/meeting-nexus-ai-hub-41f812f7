import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Copy, ChevronUp, ChevronDown, Zap, HelpCircle, ArrowRight } from "lucide-react";
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

interface EnrichmentQuestion {
  question: string;
  answer: string;
}

export const TaskDeepSearch = ({ todoId, todoDescription }: TaskDeepSearchProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [userContext, setUserContext] = useState("");
  const [searchResult, setSearchResult] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState("search");
  const [hasExistingResults, setHasExistingResults] = useState(false);
  
  // États pour les questions d'enrichissement
  const [searchPhase, setSearchPhase] = useState<'input' | 'questions' | 'result'>('input');
  const [enrichmentQuestions, setEnrichmentQuestions] = useState<string[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<EnrichmentQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  
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
          title: "Questions générées",
          description: `${questions.length} questions d'enrichissement ont été générées`,
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

      console.log('🔍 Lancement de la recherche finale');

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
        setActiveTab('result');

        toast({
          title: "Recherche terminée",
          description: "Les résultats ont été sauvegardés",
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
    setActiveTab('search');
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
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-16 flex flex-col items-center justify-center gap-1 text-foreground hover:text-foreground hover:bg-purple-100/50 px-2"
          >
            <Zap className="h-4 w-4 text-purple-500 flex-shrink-0" />
            <span className="text-xs font-medium text-black text-center leading-tight">Sonar Pro</span>
            <div className="flex items-center gap-1">
              <Search className="h-2 w-2" />
              {hasExistingResults && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs h-3 px-1">
                  Résultats
                </Badge>
              )}
              {isOpen ? <ChevronUp className="h-2 w-2" /> : <ChevronDown className="h-2 w-2" />}
            </div>
          </Button>
        </CollapsibleTrigger>
        
        {isOpen && (
          <CollapsibleContent className="col-span-full">
            <Card className="mt-2 border-dashed">
              <CardContent className="p-3">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
                  <TabsList className="grid w-full grid-cols-2 h-7">
                    <TabsTrigger value="search" className="text-xs">Recherche</TabsTrigger>
                    <TabsTrigger value="result" className="text-xs">Résultat</TabsTrigger>
                  </TabsList>

                  <TabsContent value="search" className="space-y-3 mt-3">
                    {/* Phase 1: Initial context input */}
                    {searchPhase === 'input' && (
                      <div className="space-y-3">
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
                        
                        <Button 
                          onClick={handleInitialSearch} 
                          disabled={isLoadingQuestions || !userContext.trim()}
                          size="sm"
                          className="h-7 text-xs w-full"
                        >
                          {isLoadingQuestions ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Questions...
                            </>
                          ) : (
                            <>
                              <HelpCircle className="h-3 w-3 mr-1" />
                              Commencer la recherche
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Phase 2: Enrichment questions */}
                    {searchPhase === 'questions' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">Questions d'enrichissement</span>
                          <Button variant="ghost" size="sm" onClick={resetSearch} className="h-6 text-xs">
                            Reset
                          </Button>
                        </div>
                        
                        <div className="bg-blue-50 p-2 rounded-md border-l-2 border-blue-400">
                          <p className="text-xs text-blue-700">
                            💡 Répondez aux questions pertinentes pour affiner votre recherche
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          {enrichmentQuestions.map((question, index) => (
                            <div key={index} className="space-y-1">
                              <label className="text-xs text-muted-foreground">
                                {index + 1}. {question}
                              </label>
                              <Input
                                placeholder="Réponse optionnelle..."
                                value={questionAnswers[index]?.answer || ''}
                                onChange={(e) => handleAnswerChange(index, e.target.value)}
                                className="h-6 text-xs"
                              />
                            </div>
                          ))}
                        </div>
                        
                        <Button 
                          onClick={handleFinalSearch} 
                          disabled={isSearching}
                          size="sm"
                          className="h-7 text-xs w-full"
                        >
                          {isSearching ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Recherche...
                            </>
                          ) : (
                            <>
                              <ArrowRight className="h-3 w-3 mr-1" />
                              Recherche finale
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="result" className="space-y-3 mt-3">
                    {searchResult && searchResult.trim() ? (
                      <>
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                            Sonar Pro terminé
                          </Badge>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={resetSearch} className="h-6 text-xs">
                              Nouveau
                            </Button>
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
                            <span className="text-xs">Recherche Sonar Pro en cours...</span>
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
        )}
      </Collapsible>
    </>
  );
};
