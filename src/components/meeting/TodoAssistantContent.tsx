
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Loader2, User, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUnifiedChatHistory } from "@/hooks/useUnifiedChatHistory";

interface TodoAssistantContentProps {
  todoId: string;
  todoDescription: string;
  onUpdate?: () => void;
}

interface AIRecommendation {
  id: string;
  recommendation_text: string;
  created_at: string;
}

export const TodoAssistantContent = ({ todoId, todoDescription, onUpdate }: TodoAssistantContentProps) => {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(true);
  const { toast } = useToast();

  // Utiliser le hook unifié pour l'historique avec une clé unique pour cette tâche
  const {
    messages,
    addMessage,
    clearHistory,
    getFormattedHistory
  } = useUnifiedChatHistory({
    storageKey: `todo-assistant-${todoId}`,
    initialMessage: "Bonjour ! Je suis l'assistant IA pour cette tâche. Je peux vous aider avec des conseils, des suggestions ou répondre à vos questions en utilisant le contexte de la tâche et de la réunion associée.",
    maxHistoryLength: 50,
    maxSentHistory: 20
  });

  useEffect(() => {
    fetchRecommendation();
  }, [todoId]);

  const fetchRecommendation = async () => {
    try {
      const { data, error } = await supabase
        .from("todo_ai_recommendations")
        .select("*")
        .eq("todo_id", todoId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching AI recommendation:", error);
        return;
      }

      setRecommendation(data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoadingRecommendation(false);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      content: inputValue,
      isUser: true,
      timestamp: new Date()
    };

    setInputValue("");
    setIsLoading(true);
    addMessage(userMessage);

    try {
      console.log('📤 Envoi demande assistant IA:', inputValue);
      
      // Récupérer les informations de la tâche et de la réunion
      const { data: todoData, error: todoError } = await supabase
        .from("todos")
        .select(`
          *,
          meetings(title, summary, transcript)
        `)
        .eq("id", todoId)
        .single();

      if (todoError) {
        console.error('Erreur récupération tâche:', todoError);
      }

      const { data, error } = await supabase.functions.invoke('todo-assistant-enhanced', {
        body: {
          todoId,
          todoDescription,
          userMessage: inputValue,
          conversationHistory: getFormattedHistory(),
          todoData: todoData || null,
          recommendation: recommendation?.recommendation_text || null
        }
      });

      console.log('📥 Réponse reçue:', data);

      if (error) {
        throw new Error(`Erreur: ${error.message}`);
      }

      if (!data || data.success === false) {
        throw new Error(data?.error || 'Erreur inconnue');
      }

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        content: data.response || "Réponse reçue",
        isUser: false,
        timestamp: new Date()
      };

      addMessage(assistantMessage);

      if (data.updated && onUpdate) {
        console.log('🔄 Mise à jour tâche');
        onUpdate();
        
        toast({
          title: "✅ Tâche mise à jour",
          description: data.explanation || "La tâche a été modifiée par l'assistant",
        });
      }

    } catch (error: any) {
      console.error('❌ Erreur:', error);
      
      const errorMessage = {
        id: (Date.now() + 2).toString(),
        content: `❌ ${error.message}`,
        isUser: false,
        timestamp: new Date()
      };
      
      addMessage(errorMessage);
      
      toast({
        title: "⚠️ Erreur",
        description: "Impossible de traiter la demande. Réessayez.",
        variant: "destructive",
      });

    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className="border-dashed">
      <CardContent className="p-3">
        <div className="space-y-3">
          {/* Recommandations IA en premier */}
          {loadingRecommendation ? (
            <div className="flex items-center justify-center gap-2 text-sm text-foreground p-4 bg-blue-50 rounded">
              <Lightbulb className="h-4 w-4 animate-pulse text-blue-500" />
              <span>Chargement des recommandations...</span>
            </div>
          ) : recommendation ? (
            <div className="bg-blue-50/50 rounded p-3 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-sm text-blue-800">Recommandations IA</span>
              </div>
              <div className="text-xs text-blue-700 whitespace-pre-wrap">
                {recommendation.recommendation_text}
              </div>
            </div>
          ) : (
            <div className="text-center py-2 text-muted-foreground">
              <p className="text-xs">Aucune recommandation disponible</p>
            </div>
          )}
          
          {/* Chat IA dédié */}
          <div className="border-t pt-3">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="h-4 w-4 text-green-600" />
              <span className="font-medium text-sm">Assistant IA</span>
              <Button
                onClick={clearHistory}
                variant="ghost"
                size="sm"
                className="ml-auto h-6 px-2 text-xs"
              >
                Effacer
              </Button>
            </div>
            
            <ScrollArea className="h-[200px] pr-2">
              <div className="space-y-2">
                {messages.map((message, index) => (
                  <div
                    key={message.id || index}
                    className={`flex gap-3 ${message.isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-3 max-w-[85%] ${message.isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.isUser ? 'bg-primary' : 'bg-secondary'
                      }`}>
                        {message.isUser ? (
                          <User className="h-3 w-3 text-primary-foreground" />
                        ) : (
                          <Bot className="h-3 w-3" />
                        )}
                      </div>
                      
                      <div className={`rounded-lg p-2 text-xs ${
                        message.isUser 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted'
                      }`}>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        <div className="text-xs opacity-70 mt-1">
                          {message.timestamp.toLocaleTimeString('fr-FR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Input du chat */}
            <div className="flex gap-2 mt-3">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Posez votre question à l'assistant IA..."
                disabled={isLoading}
                className="flex-1 text-xs h-7"
              />
              <Button 
                onClick={sendMessage} 
                disabled={isLoading || !inputValue.trim()}
                size="sm"
                className="h-7 w-7 p-0"
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
