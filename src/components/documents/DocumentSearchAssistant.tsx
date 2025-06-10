
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Bot, User, Loader2, FileText, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  sources?: Array<{
    documentId: string;
    documentName: string;
    relevantText: string;
    similarity: number;
    chunkIndex?: number;
  }>;
}

export const DocumentSearchAssistant = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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
      // Utiliser l'agent AI avec recherche dans les embeddings
      const { data, error } = await supabase.functions.invoke('ai-agent', {
        body: { 
          message: inputMessage,
          context: {
            searchDocuments: true,
            useEmbeddings: true
          }
        }
      });

      if (error) {
        console.error('[SEARCH_ASSISTANT] Error:', error);
        throw error;
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || "Désolé, je n'ai pas trouvé d'informations pertinentes dans vos documents.",
        isUser: false,
        timestamp: new Date(),
        sources: data.sources || []
      };

      setMessages(prev => [...prev, aiMessage]);

    } catch (error: any) {
      console.error('[SEARCH_ASSISTANT] Error sending message:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'effectuer la recherche",
        variant: "destructive",
      });

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Désolé, je rencontre un problème technique lors de la recherche. Pouvez-vous réessayer ?",
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
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Assistant de Recherche dans les Documents
        </CardTitle>
        <CardDescription>
          Posez des questions et je rechercherai dans tous vos documents pour vous donner les meilleures réponses avec les sources exactes utilisées.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg h-96 flex flex-col">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                <div className="flex items-center justify-center mb-4">
                  <MessageSquare className="h-12 w-12 text-muted-foreground" />
                </div>
                <p className="mb-2">Posez une question pour rechercher dans vos documents</p>
                <p className="text-xs">
                  Exemples : "Quels sont les contrats de 2024 ?" ou "Trouve-moi des informations sur les budgets"
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className="space-y-2">
                    <div className={`flex gap-3 ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex gap-3 max-w-[85%] ${message.isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          message.isUser ? 'bg-primary' : 'bg-secondary'
                        }`}>
                          {message.isUser ? (
                            <User className="h-4 w-4 text-primary-foreground" />
                          ) : (
                            <Bot className="h-4 w-4" />
                          )}
                        </div>
                        
                        <div className={`rounded-lg p-3 ${
                          message.isUser 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          <div className="whitespace-pre-wrap text-sm">
                            {message.content}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sources utilisées avec plus de détails */}
                    {!message.isUser && message.sources && message.sources.length > 0 && (
                      <div className="ml-11 space-y-3">
                        <div className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Documents sources utilisés ({message.sources.length}):
                        </div>
                        {message.sources.map((source, index) => (
                          <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-blue-600" />
                                <span className="font-medium text-blue-800 text-sm">
                                  {source.documentName}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="text-xs">
                                  Pertinence: {(source.similarity * 100).toFixed(1)}%
                                </Badge>
                                {source.chunkIndex && (
                                  <Badge variant="outline" className="text-xs">
                                    Partie #{source.chunkIndex}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-blue-400 italic">
                              "{source.relevantText.length > 200 
                                ? source.relevantText.substring(0, 200) + "..." 
                                : source.relevantText}"
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Recherche dans les documents...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t bg-muted/20">
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Rechercher dans vos documents..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button 
                onClick={sendMessage} 
                disabled={isLoading || !inputMessage.trim()}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              🔍 Recherche intelligente avec traçabilité des sources
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
