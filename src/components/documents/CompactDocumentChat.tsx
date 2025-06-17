
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Bot, User, Loader2, X, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UnifiedDocumentItem } from "@/types/unified-document";
import { useUnifiedChatHistory } from "@/hooks/useUnifiedChatHistory";

interface CompactDocumentChatProps {
  document: UnifiedDocumentItem;
}

export const CompactDocumentChat = ({ document }: CompactDocumentChatProps) => {
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const isMeeting = document.type === 'meeting';
  const documentName = document.ai_generated_name || document.original_name;

  const { 
    messages, 
    addMessage, 
    clearHistory, 
    getFormattedHistory 
  } = useUnifiedChatHistory({
    storageKey: `chat-${document.type}-${document.id}`,
    initialMessage: `Bonjour ! Je suis votre assistant IA pour ${isMeeting ? 'le meeting' : 'le document'} "${documentName}". Posez-moi toutes vos questions !`,
    maxHistoryLength: 50,
    maxSentHistory: 20
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      content: inputMessage,
      isUser: true,
      timestamp: new Date(),
    };

    addMessage(userMessage);
    const currentMessage = inputMessage;
    setInputMessage("");
    setIsLoading(true);

    try {
      console.log(`[COMPACT_CHAT_${document.type.toUpperCase()}] 📤 Envoi avec historique:`, getFormattedHistory().length, 'messages');

      let response;
      
      if (isMeeting) {
        // Pour les meetings, utiliser ai-agent avec mode recherche vectorielle
        const { data, error } = await supabase.functions.invoke('ai-agent', {
          body: { 
            message: currentMessage,
            conversationHistory: getFormattedHistory(),
            context: {
              documentSearchMode: true,
              forceEmbeddingsPriority: true,
              vectorSearchOnly: false,
              meetingId: document.id
            }
          }
        });

        if (error) throw error;
        response = data;
      } else {
        // Pour les documents, utiliser document-chat avec historique
        const { data, error } = await supabase.functions.invoke('document-chat', {
          body: { 
            message: currentMessage,
            documentId: document.id,
            conversationHistory: getFormattedHistory()
          }
        });

        if (error) throw error;
        response = data;
      }

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        content: response.response || "Désolé, je n'ai pas pu traiter votre demande.",
        isUser: false,
        timestamp: new Date(),
        sources: response.sources || []
      };

      addMessage(aiMessage);

      // Toast informatif pour les sources
      if (response.sources && response.sources.length > 0) {
        toast({
          title: "Contexte enrichi",
          description: `${response.sources.length} source(s) utilisée(s)`,
          variant: "default",
        });
      }

    } catch (error: any) {
      console.error(`[COMPACT_CHAT_${document.type.toUpperCase()}] ❌ Erreur:`, error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer le message",
        variant: "destructive",
      });

      const errorMessage = {
        id: (Date.now() + 1).toString(),
        content: "Désolé, je rencontre un problème technique. Pouvez-vous réessayer ?",
        isUser: false,
        timestamp: new Date(),
      };

      addMessage(errorMessage);
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
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h3 className="font-medium text-sm">
              Chat avec {isMeeting ? 'le meeting' : 'le document'}
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearHistory}
            className="h-6 w-6 p-0 hover:bg-orange-50"
            title="Effacer l'historique"
          >
            <Trash2 className="h-3 w-3 text-gray-500 hover:text-orange-600" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {documentName} • {messages.length} message(s) en mémoire
        </p>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2 ${message.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-2 max-w-[85%] ${message.isUser ? 'flex-row-reverse' : 'flex-row'}`}>
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
                  <div className="whitespace-pre-wrap">
                    {message.content}
                  </div>
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-1 text-xs opacity-70">
                      📄 {message.sources.length} source(s)
                    </div>
                  )}
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
          
          {isLoading && (
            <div className="flex gap-2 justify-start">
              <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                <Bot className="h-3 w-3" />
              </div>
              <div className="bg-muted rounded-lg p-2 flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs">L'assistant analyse...</span>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Posez une question sur ${isMeeting ? 'ce meeting' : 'ce document'}...`}
            disabled={isLoading}
            className="flex-1 text-xs h-8"
          />
          <Button 
            onClick={sendMessage} 
            disabled={isLoading || !inputMessage.trim()}
            size="sm"
            className="h-8 px-2"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
          </Button>
        </div>

        <div className="mt-2 text-xs text-muted-foreground">
          💡 {isMeeting 
            ? 'Contexte maintenu - Posez des questions sur le meeting, les participants, les décisions...' 
            : 'Contexte maintenu - Posez des questions sur le contenu, demandez des résumés...'}
        </div>
      </div>
    </div>
  );
};
