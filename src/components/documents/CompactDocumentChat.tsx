
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Bot, User, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface CompactDocumentChatProps {
  document: {
    id: string;
    ai_generated_name: string | null;
    original_name: string;
    ai_summary: string | null;
  };
}

export const CompactDocumentChat = ({ document }: CompactDocumentChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('document-chat', {
        body: { 
          message: inputMessage,
          documentId: document.id
        }
      });

      if (error) {
        console.error('[DOCUMENT_CHAT] Error:', error);
        throw error;
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || "Désolé, je n'ai pas pu traiter votre demande.",
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);

    } catch (error: any) {
      console.error('[DOCUMENT_CHAT] Error sending message:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer le message",
        variant: "destructive",
      });

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Désolé, je rencontre un problème technique. Pouvez-vous réessayer ?",
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
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
    <div className="border rounded-lg bg-background">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Chat avec le document</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </div>

      {/* Chat Content */}
      {isExpanded && (
        <div className="border-t">
          {/* Messages */}
          <ScrollArea className="h-64 p-3">
            {messages.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                Posez une question sur ce document pour commencer...
              </div>
            ) : (
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
                      
                      <div className={`rounded-lg p-2 text-sm ${
                        message.isUser 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted'
                      }`}>
                        <div className="whitespace-pre-wrap">
                          {message.content}
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
                      <span className="text-sm">Analyse en cours...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t bg-muted/20">
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Posez une question..."
                disabled={isLoading}
                className="flex-1 text-sm"
              />
              <Button 
                onClick={sendMessage} 
                disabled={isLoading || !inputMessage.trim()}
                size="sm"
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
              </Button>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              💡 Questions spécifiques recommandées
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
