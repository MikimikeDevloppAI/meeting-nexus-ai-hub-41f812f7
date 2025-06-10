
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, CheckCircle, AlertCircle, User, Loader2, Clock, CheckCheck, Brain, ListTodo, FileText, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: AssistantAction[];
  status?: 'processing' | 'completed' | 'error';
  id: string;
  agentResults?: AgentResult[];
}

interface AssistantAction {
  type: string;
  data: any;
  explanation: string;
  success?: boolean;
  result?: string;
  error?: string;
}

interface AgentResult {
  agent: string;
  success: boolean;
  actions: AssistantAction[];
  summary: string;
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

  const getAgentIcon = (agentType: string) => {
    switch (agentType) {
      case 'todo':
        return <ListTodo className="h-4 w-4 text-blue-600" />;
      case 'summary':
        return <FileText className="h-4 w-4 text-green-600" />;
      case 'recommendations':
        return <Lightbulb className="h-4 w-4 text-yellow-600" />;
      default:
        return <Brain className="h-4 w-4 text-purple-600" />;
    }
  };

  const getAgentLabel = (agentType: string) => {
    switch (agentType) {
      case 'todo':
        return 'Tâches';
      case 'summary':
        return 'Résumé';
      case 'recommendations':
        return 'Recommandations';
      default:
        return 'Agent';
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    const currentInput = inputValue;
    setInputValue("");
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
      console.log('📤 Envoi à coordinator-agent:', currentInput);
      
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Appeler le coordinateur au lieu de l'ancien agent
      const { data, error } = await supabase.functions.invoke('meeting-coordinator-agent', {
        body: {
          meetingId,
          userMessage: currentInput,
          conversationHistory
        }
      });

      console.log('📥 Réponse coordinateur:', data);

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error('Réponse vide du coordinateur');
      }

      // Mettre à jour le message de traitement avec la vraie réponse
      setMessages(prev => {
        return prev.map(msg => {
          if (msg.id === processingMessageId) {
            return {
              ...msg,
              content: data.response || "Réponse reçue mais vide",
              actions: data.actions || [],
              agentResults: data.agentResults || [],
              status: 'completed' as const
            };
          }
          return msg;
        });
      });

      // Déclencher la mise à jour des données si des actions ont été exécutées
      const hasSuccessfulActions = data.agentResults?.some((result: AgentResult) => 
        result.success && result.actions?.some(action => action.success)
      );

      if (hasSuccessfulActions) {
        console.log('🔄 Mise à jour des données après actions réussies');
        onDataUpdate?.();
        
        toast({
          title: "Actions exécutées",
          description: `Les modifications ont été appliquées avec succès`,
        });
      }

    } catch (error) {
      console.error('❌ Erreur coordinateur:', error);
      
      // Remplacer le message de traitement par un message d'erreur
      setMessages(prev => {
        return prev.map(msg => {
          if (msg.id === processingMessageId) {
            return {
              ...msg,
              content: "❌ Désolé, je rencontre un problème technique. Pouvez-vous réessayer votre demande ?",
              status: 'error' as const
            };
          }
          return msg;
        });
      });
      
      toast({
        title: "Erreur",
        description: "Impossible de communiquer avec l'assistant",
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

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="h-3 w-3 animate-spin text-blue-600" />;
      case 'completed':
        return <CheckCheck className="h-3 w-3 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-600" />
          Assistant IA Multi-Agents
          <Badge variant="outline" className="ml-auto">
            {messages.filter(m => m.role === 'user').length} échange{messages.filter(m => m.role === 'user').length > 1 ? 's' : ''}
          </Badge>
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
                <div className="flex items-center justify-center gap-4 mt-4">
                  <div className="flex items-center gap-1 text-xs">
                    {getAgentIcon('todo')}
                    <span>Tâches</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {getAgentIcon('summary')}
                    <span>Résumé</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {getAgentIcon('recommendations')}
                    <span>Recommandations</span>
                  </div>
                </div>
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
                    
                    {/* Affichage des résultats par agent */}
                    {message.agentResults && message.agentResults.length > 0 && message.status !== 'processing' && (
                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                        <p className="text-xs font-medium">Agents utilisés :</p>
                        {message.agentResults.map((result, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            {getAgentIcon(result.agent)}
                            <span className="font-medium">{getAgentLabel(result.agent)}</span>
                            {result.success ? (
                              <CheckCircle className="h-3 w-3 text-green-600" />
                            ) : (
                              <AlertCircle className="h-3 w-3 text-red-600" />
                            )}
                            <span className="text-gray-600">
                              {result.actions?.length || 0} action(s)
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
            placeholder={isLoading ? "L'assistant analyse votre demande..." : "Tapez votre message... (Entrée pour envoyer)"}
            disabled={isLoading}
            className="flex-1"
          />
          <Button 
            onClick={sendMessage} 
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
