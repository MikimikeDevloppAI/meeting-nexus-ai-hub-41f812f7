
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Loader2, User, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUnifiedChatHistory, ChatMessage } from "@/hooks/useUnifiedChatHistory";

interface TodoAssistantFullscreenProps {
  isOpen: boolean;
  onClose: () => void;
  todoId: string;
  todoDescription: string;
  onUpdate?: () => void;
  currentMessages?: ChatMessage[]; // Ajout des messages actuels
}

export const TodoAssistantFullscreen = ({ 
  isOpen, 
  onClose, 
  todoId, 
  todoDescription, 
  onUpdate,
  currentMessages = [] // Messages passés depuis le composant parent
}: TodoAssistantFullscreenProps) => {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const { toast } = useToast();

  const {
    messages,
    addMessage,
    clearHistory,
    getFormattedHistory,
    isInitialized,
    setMessages
  } = useUnifiedChatHistory({
    storageKey: `todo-assistant-${todoId}`,
    initialMessage: "Bonjour ! Je suis l'assistant IA pour cette tâche. Je peux vous aider avec des conseils, des suggestions ou répondre à vos questions en utilisant le contexte de la tâche et de la réunion associée.",
    maxHistoryLength: 100,
    maxSentHistory: 50
  });

  // Synchroniser avec les messages actuels quand le dialog s'ouvre
  useEffect(() => {
    if (isOpen && currentMessages.length > 0 && isInitialized) {
      console.log('🔄 Synchronisation historique plein écran:', currentMessages.length, 'messages');
      setMessages(currentMessages);
    }
  }, [isOpen, currentMessages, isInitialized, setMessages]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading || !isInitialized) return;

    const userMessage = {
      id: Date.now().toString(),
      content: inputValue,
      isUser: true,
      timestamp: new Date()
    };

    const currentInput = inputValue;
    setInputValue("");
    setIsLoading(true);
    setIsTyping(true);
    addMessage(userMessage);

    const typingMessage = {
      id: `typing-${Date.now()}`,
      content: "L'assistant réfléchit...",
      isUser: false,
      timestamp: new Date()
    };
    addMessage(typingMessage);

    try {
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

      const history = getFormattedHistory();

      const { data, error } = await supabase.functions.invoke('todo-assistant-enhanced', {
        body: {
          todoId,
          todoDescription,
          userMessage: currentInput,
          conversationHistory: history,
          todoData: todoData || null
        }
      });

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

      // Remplacer le message de typing par la vraie réponse
      setMessages(prev => [
        ...prev.filter(msg => !msg.content.includes("réfléchit")),
        assistantMessage
      ]);

      if (data.updated && onUpdate) {
        onUpdate();
        toast({
          title: "✅ Tâche mise à jour",
          description: data.explanation || "La tâche a été modifiée par l'assistant",
        });
      }

      if (data.hasInternetContext) {
        toast({
          title: "🌐 Recherche internet effectuée",
          description: "Des informations récentes ont été trouvées pour enrichir la réponse",
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
      
      // Remplacer le message de typing par l'erreur
      setMessages(prev => [
        ...prev.filter(msg => !msg.content.includes("réfléchit")),
        errorMessage
      ]);
      
      toast({
        title: "⚠️ Erreur",
        description: "Impossible de traiter la demande. Réessayez.",
        variant: "destructive",
      });

    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isInitialized) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-[95vw] max-h-[95vh] w-full h-full flex flex-col p-0" 
        hideCloseButton={true}
      >
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-green-600" />
              <span>Assistant IA - Plein écran</span>
              {isTyping && (
                <div className="flex items-center gap-1 ml-2">
                  <Bot className="h-4 w-4 text-green-500 animate-pulse" />
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1 h-1 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1 h-1 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                onClick={clearHistory}
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
              >
                Effacer l'historique
              </Button>
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col px-6 py-4 min-h-0">
          <ScrollArea className="flex-1 pr-4 mb-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={message.id || index}
                  className={`flex gap-4 ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-4 max-w-[80%] ${message.isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.isUser ? 'bg-primary' : 'bg-secondary'
                    }`}>
                      {message.isUser ? (
                        <User className="h-4 w-4 text-primary-foreground" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    
                    <div className={`rounded-lg p-4 ${
                      message.isUser 
                        ? 'bg-primary text-primary-foreground' 
                        : message.content.includes('réfléchit')
                          ? 'bg-yellow-100 text-yellow-800 animate-pulse'
                          : 'bg-muted'
                    }`}>
                      <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                      <div className="text-xs opacity-70 mt-2">
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

          <div className="flex gap-3 border-t pt-4">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isLoading ? "Traitement en cours..." : "Posez votre question à l'assistant IA..."}
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={sendMessage} 
              disabled={isLoading || !inputValue.trim()}
              className={`px-6 ${isLoading ? 'animate-pulse' : ''}`}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
