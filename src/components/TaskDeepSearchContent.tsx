import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Loader2, Copy, Maximize2, HelpCircle, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DeepSearchContent } from "@/utils/deepSearchRenderer";

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
  
  // Nouveaux états pour les questions d'enrichissement
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

      console.log('🔍 Génération des questions d\'enrichissement');

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

  const handleFinalSearch = async (skipQuestions = false) => {
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
          enrichmentAnswers: skipQuestions ? null : questionAnswers.filter(qa => qa.answer.trim()),
          skipQuestions: skipQuestions
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
    setSearchResult("");
    setSources([]);
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
          {/* Header with status indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-purple-600" />
              <span className="font-medium text-sm">Recherche approfondie (Sonar Pro)</span>
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

          {/* Phase 1: Initial context input */}
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
              
              <div className="flex gap-2">
                <Button 
                  onClick={handleInitialSearch} 
                  disabled={isLoadingQuestions || !userContext.trim()}
                  size="sm"
                  className="flex-1"
                >
                  {isLoadingQuestions ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Génération des questions...
                    </>
                  ) : (
                    <>
                      <HelpCircle className="h-4 w-4 mr-2" />
                      Générer des questions d'enrichissement
                    </>
                  )}
                </Button>
                <Button 
                  onClick={() => handleFinalSearch(true)} 
                  disabled={isSearching || !userContext.trim()}
                  variant="outline"
                  size="sm"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Recherche...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Recherche directe
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Phase 2: Enrichment questions */}
          {searchPhase === 'questions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Questions d'enrichissement</h4>
                <Button variant="ghost" size="sm" onClick={resetSearch}>
                  Recommencer
                </Button>
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
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleFinalSearch(false)} 
                  disabled={isSearching}
                  size="sm"
                  className="flex-1"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Recherche en cours...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Lancer la recherche finale
                    </>
                  )}
                </Button>
                <Button 
                  onClick={() => handleFinalSearch(true)} 
                  disabled={isSearching}
                  variant="outline"
                  size="sm"
                >
                  Ignorer les questions
                </Button>
              </div>
            </div>
          )}

          {/* Phase 3: Results */}
          {searchPhase === 'result' && searchResult && searchResult.trim() ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Recherche terminée avec Sonar Pro
                </Badge>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={resetSearch}>
                    Nouvelle recherche
                  </Button>
                  <Dialog open={isFullScreenOpen} onOpenChange={setIsFullScreenOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Maximize2 className="h-4 w-4 mr-1" />
                        Plein écran
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] w-[90vw]">
                      <DialogHeader>
                        <DialogTitle>Résultat de la recherche approfondie (Sonar Pro)</DialogTitle>
                      </DialogHeader>
                      <div className="flex justify-end mb-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(searchResult)}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copier
                        </Button>
                      </div>
                      <ScrollArea className="h-[70vh] w-full pr-4">
                        <DeepSearchContent text={searchResult} sources={sources} />
                      </ScrollArea>
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
                </div>
              </div>
              <div className="border rounded-md overflow-hidden">
                <ScrollArea className="h-[300px] w-full">
                  <div className="p-3">
                    <DeepSearchContent text={searchResult} sources={sources} />
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : searchPhase === 'result' && isSearching ? (
            <div className="text-center py-6 text-muted-foreground">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Recherche en cours avec Sonar Pro...</span>
              </div>
            </div>
          ) : searchPhase === 'result' ? (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">Aucun résultat à afficher</p>
              <p className="text-xs opacity-70">La recherche n'a pas retourné de résultats</p>
              <Button variant="ghost" size="sm" onClick={resetSearch} className="mt-2">
                Recommencer
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};
