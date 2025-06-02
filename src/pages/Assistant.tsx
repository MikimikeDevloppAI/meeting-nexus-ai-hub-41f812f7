
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Bot, User, Globe, Database, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  sources?: any[];
  hasInternetContext?: boolean;
  contextFound?: boolean;
}

const Assistant = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Bonjour ! Je suis votre assistant IA spécialisé pour le cabinet médical. J'ai accès à l'historique complet de vos réunions et transcripts. Posez-moi des questions sur vos activités, demandez des conseils, ou cherchez des informations dans vos données !",
      isUser: false,
      timestamp: new Date(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [useInternet, setUseInternet] = useState(false);
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
      console.log('[ASSISTANT] Sending message to AI agent...');
      const { data, error } = await supabase.functions.invoke('ai-agent', {
        body: { 
          message: inputMessage,
          useInternet: useInternet
        }
      });

      if (error) {
        console.error('[ASSISTANT] Error:', error);
        throw error;
      }

      console.log('[ASSISTANT] Response received:', data);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || "Désolé, je n'ai pas pu traiter votre demande.",
        isUser: false,
        timestamp: new Date(),
        sources: data.sources || [],
        hasInternetContext: data.hasInternetContext,
        contextFound: data.contextFound,
      };

      setMessages(prev => [...prev, aiMessage]);

    } catch (error: any) {
      console.error('[ASSISTANT] Error sending message:', error);
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
    <div className="animate-fade-in h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Assistant IA</h1>
        <p className="text-muted-foreground">
          Chat avec un assistant IA qui a accès à toutes les données de votre cabinet
        </p>
      </div>

      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle>Assistant Intelligent</CardTitle>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="internet-mode" className="text-sm">
                Recherche internet
              </Label>
              <Switch
                id="internet-mode"
                checked={useInternet}
                onCheckedChange={setUseInternet}
              />
              <Globe className={`h-4 w-4 ${useInternet ? 'text-green-500' : 'text-gray-400'}`} />
            </div>
          </div>
          <CardDescription>
            Posez des questions sur vos réunions, demandez des conseils, ou recherchez des informations
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[80%] ${message.isUser ? 'flex-row-reverse' : 'flex-row'}`}>
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
                      <div className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </div>
                      
                      {!message.isUser && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {message.contextFound && (
                            <Badge variant="outline" className="text-xs">
                              <Database className="h-3 w-3 mr-1" />
                              Données internes
                            </Badge>
                          )}
                          {message.hasInternetContext && (
                            <Badge variant="outline" className="text-xs">
                              <Globe className="h-3 w-3 mr-1" />
                              Données externes
                            </Badge>
                          )}
                          {message.sources && message.sources.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {message.sources.length} source(s)
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      <div className="text-xs opacity-70 mt-2">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">L'assistant réfléchit...</span>
                  </div>
                </div>
              )}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>

          <div className="flex gap-2 pt-4 border-t">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Posez une question sur vos réunions, demandez des conseils..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={sendMessage} 
              disabled={isLoading || !inputMessage.trim()}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="mt-2 text-xs text-muted-foreground">
            💡 Exemples: "Résume les dernières décisions sur la climatisation", "Quelles sont les meilleures solutions de formation pour le personnel ?", "Quels prestataires avons-nous contactés récemment ?"
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Assistant;
