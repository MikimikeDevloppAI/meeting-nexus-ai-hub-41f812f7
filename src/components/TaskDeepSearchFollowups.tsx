import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Send, Loader2, Copy, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DeepSearchContent } from "@/utils/deepSearchRenderer";

interface TaskDeepSearchFollowupsProps {
  deepSearchId: string;
  todoId: string;
  todoDescription: string;
  isFullScreen?: boolean;
}

interface Followup {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

export const TaskDeepSearchFollowups = ({ 
  deepSearchId, 
  todoId, 
  todoDescription,
  isFullScreen = false
}: TaskDeepSearchFollowupsProps) => {
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const { toast } = useToast();

  // Charger l'historique des questions de suivi
  useEffect(() => {
    if (deepSearchId && deepSearchId !== 'temp') {
      loadFollowups();
    } else {
      setIsLoading(false);
    }
  }, [deepSearchId]);

  const loadFollowups = async () => {
    if (!deepSearchId || deepSearchId === 'temp') {
      setIsLoading(false);
      return;
    }

    try {
      console.log('🔄 Chargement des questions de suivi pour:', deepSearchId);
      
      const { data, error } = await supabase
        .from('task_deep_search_followups')
        .select('*')
        .eq('deep_search_id', deepSearchId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading followups:', error);
        return;
      }

      console.log('✅ Questions de suivi chargées:', data?.length || 0);
      setFollowups(data || []);
    } catch (error) {
      console.error('Error loading followups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitQuestion = async () => {
    if (!newQuestion.trim()) {
      toast({
        title: "Question requise",
        description: "Veuillez saisir une question",
        variant: "destructive",
      });
      return;
    }

    if (!deepSearchId || deepSearchId === 'temp') {
      toast({
        title: "Erreur",
        description: "Impossible de poser une question sans recherche valide",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      console.log('🔍 Envoi question de suivi pour recherche:', deepSearchId);

      const response = await supabase.functions.invoke('task-deep-search', {
        body: {
          followupQuestion: newQuestion.trim(),
          deepSearchId,
          todoId,
          todoDescription
        }
      });

      console.log('📡 Réponse reçue:', response);

      if (response.error) {
        console.error('❌ Erreur dans la réponse:', response.error);
        throw new Error(response.error.message || 'Erreur lors de la question de suivi');
      }

      if (response.data?.success && response.data?.phase === 'followup') {
        const newFollowup: Followup = {
          id: `temp-${Date.now()}`,
          question: response.data.question,
          answer: response.data.answer,
          created_at: new Date().toISOString()
        };
        
        setFollowups(prev => [...prev, newFollowup]);
        setNewQuestion("");

        toast({
          title: "Réponse reçue",
          description: "Votre question de suivi a été traitée",
        });

        // Recharger les followups pour avoir les IDs corrects
        setTimeout(() => loadFollowups(), 1000);
      } else {
        console.error('❌ Réponse inattendue:', response.data);
        throw new Error(response.data?.error || 'Erreur inconnue');
      }

    } catch (error: any) {
      console.error('❌ Erreur question de suivi:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de traiter la question",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copié",
      description: "Le contenu a été copié dans le presse-papiers",
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isSubmitting) {
      e.preventDefault();
      handleSubmitQuestion();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-blue-600" />
        <span className="font-medium text-sm">Questions de suivi</span>
        {followups.length > 0 && (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
            {followups.length} question{followups.length > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Historique des questions/réponses */}
      {followups.length > 0 && (
        <div className="space-y-4">
          <div className="space-y-4">
            {followups.map((followup, index) => (
              <div key={followup.id} className="space-y-3">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="text-xs mt-1 shrink-0">
                    Q{index + 1}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-800 bg-blue-50 p-3 rounded-md border border-blue-200">
                      {followup.question}
                    </p>
                  </div>
                </div>
                
                <div className="ml-8 relative">
                  <div className="bg-gray-50 rounded-md border border-gray-200">
                    <div className="flex justify-end p-2 border-b border-gray-200">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(followup.answer)}
                        className="h-6 text-xs"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copier
                      </Button>
                    </div>
                    <div className="p-3">
                      <div className="max-h-[300px] overflow-y-auto">
                        <DeepSearchContent text={followup.answer} sources={[]} />
                      </div>
                    </div>
                  </div>
                </div>
                
                {index < followups.length - 1 && <Separator className="my-4" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Champ de nouvelle question */}
      {deepSearchId && deepSearchId !== 'temp' && (
        <div className="space-y-3">
          <div className="bg-blue-50 p-3 rounded-md border-l-4 border-blue-400">
            <p className="text-xs text-blue-800 mb-1 font-medium">
              💬 Posez une question de suivi
            </p>
            <p className="text-xs text-blue-700">
              Votre question sera traitée avec tout le contexte de la recherche précédente
            </p>
          </div>
          
          <div className="flex gap-2">
            <Input
              placeholder="Posez votre question de suivi..."
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isSubmitting}
              className="text-sm"
            />
            <Button 
              onClick={handleSubmitQuestion}
              disabled={isSubmitting || !newQuestion.trim()}
              size="sm"
              className="shrink-0"
            >
              {isSubmitting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
