
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, CheckCircle, AlertCircle, User, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: AssistantAction[];
  status?: 'processing' | 'completed' | 'error';
  id: string;
}

interface AssistantAction {
  type: string;
  data: any;
  explanation: string;
  success?: boolean;
  result?: string;
  error?: string;
}

interface MeetingAssistantProps {
  meetingId: string;
  onDataUpdate?: () => void;
}

export const MeetingAssistant = ({ meetingId, onDataUpdate }: MeetingAssistantProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateMessageId = () => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  };

  const sendMessage = async (retryMessage?: string) => {
    const messageToSend = retryMessage || inputValue;
    if (!messageToSend.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content: messageToSend,
      timestamp: new Date()
    };

    if (!retryMessage) {
      setInputValue("");
    }
    setIsLoading(true);

    // Ajouter le message utilisateur
    setMessages(prev => [...prev, userMessage]);

    // Créer un message de traitement
    const processingMessageId = generateMessageId();
    const processingMessage: Message = {
      id: processingMessageId,
      role: 'assistant',
      content: "🧠 Analyse de votre demande en cours...",
      timestamp: new Date(),
      status: 'processing'
    };
    
    setMessages(prev => [...prev, processingMessage]);

    try {
      console.log('📤 Envoi à simple-assistant:', messageToSend);
      
      const conversationHistory = messages.slice(-8).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Timeout côté client plus court
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: La demande prend trop de temps (15s)')), 15000)
      );

      // Appeler le nouvel agent simplifié
      const requestPromise = supabase.functions.invoke('meeting-assistant-simple', {
        body: {
          meetingId,
          userMessage: messageToSend,
          conversationHistory
        }
      });

      const { data, error } = await Promise.race([requestPromise, timeoutPromise]) as any;

      console.log('📥 Réponse assistant simple:', data);

      if (error) {
        throw new Error(`Erreur fonction: ${error.message}`);
      }

      if (!data) {
        throw new Error('Réponse vide de l\'assistant');
      }

      // Vérifier si c'est une erreur déguisée
      if (data.success === false) {
        throw new Error(data.error || 'Erreur inconnue de l\'assistant');
      }

      // Mettre à jour le message de traitement avec la vraie réponse
      setMessages(prev => {
        return prev.map(msg => {
          if (msg.id === processingMessageId) {
            return {
              ...msg,
              content: data.response || "Réponse reçue mais vide",
              actions: data.actions || [],
              status: 'completed' as const
            };
          }
          return msg;
        });
      });

      // Déclencher la mise à jour des données si des actions ont été exécutées
      const hasSuccessfulActions = data.actions?.some((action: AssistantAction) => action.success);

      if (hasSuccessfulActions) {
        console.log('🔄 Mise à jour des données après actions réussies');
        onDataUpdate?.();
        
        toast({
          title: "Actions exécutées",
          description: `${data.actions.filter((a: AssistantAction) => a.success).length} action(s) réalisée(s) avec succès`,
        });
      }

      // Reset retry count on success
      setRetryCount(0);

    } catch (error) {
      console.error('❌ Erreur assistant simple:', error);
      
      // Remplacer le message de traitement par un message d'erreur
      setMessages(prev => {
        return prev.map(msg => {
          if (msg.id === processingMessageId) {
            let errorMessage = `❌ Erreur: ${error.message}`;
            
            if (error.message.includes('timeout') || error.message.includes('Timeout')) {
              errorMessage += '\n\n💡 Suggestion: Essayez une demande plus simple ou réessayez dans quelques instants.';
            } else if (error.message.includes('OpenAI')) {
              errorMessage += '\n\n💡 Suggestion: Le service IA est temporairement indisponible. Réessayez dans quelques minutes.';
            } else if (retryCount < 2) {
              errorMessage += '\n\n💡 Vous pouvez cliquer sur "Réessayer" pour tenter à nouveau.';
            }
            
            return {
              ...msg,
              content: errorMessage,
              status: 'error' as const
            };
          }
          return msg;
        });
      });
      
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });

      setRetryCount(prev => prev + 1);
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

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="h-3 w-3 animate-spin text-blue-600" />;
      case 'completed':
        return <CheckCircle className="h-3 w-3 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-600" />;
      default:
        return null;
    }
  };

  const retryLastMessage = () => {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (lastUserMessage) {
      sendMessage(lastUserMessage.content);
    }
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-600" />
          Assistant IA Simplifié
          <Badge variant="outline" className="ml-auto">
            {messages.filter(m => m.role === 'user').length} échange{messages.filter(m => m.role === 'user').length > 1 ? 's' : ''}
          </Badge>
          {retryCount > 0 && (
            <Button
              onClick={retryLastMessage}
              size="sm"
              variant="outline"
              className="ml-2"
              disabled={isLoading}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Réessayer
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col gap-3 p-4">
        {/* Zone de messages */}
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-8 text-gray-500 animate-fade-in">
                <Bot className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">
                  Bonjour ! Je peux vous aider avec les tâches, le résumé et les recommandations de cette réunion.
                </p>
                <p className="text-xs mt-2">
                  Exemple : "Ajoute une tâche pour...", "Modifie le résumé pour inclure...", "Crée une recommandation pour..."
                </p>
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 animate-fade-in ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-2 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className="flex-shrink-0">
                    {message.role === 'user' ? (
                      <User className="h-6 w-6 text-gray-600 mt-1" />
                    ) : (
                      <Bot className="h-6 w-6 text-blue-600 mt-1" />
                    )}
                  </div>
                  <div className={`rounded-lg p-3 ${
                    message.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : message.status === 'error'
                      ? 'bg-red-50 text-red-900 border border-red-200'
                      : message.status === 'processing'
                      ? 'bg-blue-50 text-blue-900 border border-blue-200'
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    
                    {/* Affichage des actions exécutées */}
                    {message.actions && message.actions.length > 0 && message.status !== 'processing' && (
                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                        <p className="text-xs font-medium">Actions exécutées :</p>
                        {message.actions.map((action, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            {action.success ? (
                              <CheckCircle className="h-3 w-3 text-green-600" />
                            ) : (
                              <AlertCircle className="h-3 w-3 text-red-600" />
                            )}
                            <span className="text-gray-600">
                              {action.explanation}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="text-xs opacity-70">
                        {message.timestamp.toLocaleTimeString('fr-FR', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                      {getStatusIcon(message.status)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Zone de saisie */}
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isLoading ? "L'assistant traite votre demande..." : "Tapez votre message... (Entrée pour envoyer)"}
            disabled={isLoading}
            className="flex-1"
          />
          <Button 
            onClick={() => sendMessage()} 
            disabled={isLoading || !inputValue.trim()}
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
