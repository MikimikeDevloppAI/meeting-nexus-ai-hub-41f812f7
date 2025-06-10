
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, CheckCircle, AlertCircle, User, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: AssistantAction[];
}

interface AssistantAction {
  type: 'create_todo' | 'update_todo' | 'delete_todo' | 'update_summary' | 'create_recommendation' | 'update_recommendation';
  data: any;
  explanation: string;
}

interface MeetingAssistantProps {
  meetingId: string;
  onDataUpdate?: () => void;
}

export const MeetingAssistant = ({ meetingId, onDataUpdate }: MeetingAssistantProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState<AssistantAction[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const executeActions = async (actions: AssistantAction[]) => {
    try {
      for (const action of actions) {
        console.log('Exécution action:', action.type, action.data);
        
        switch (action.type) {
          case 'create_todo':
            await supabase
              .from('todos')
              .insert({
                meeting_id: meetingId,
                description: action.data.description,
                status: 'confirmed'
              });
            break;
            
          case 'update_todo':
            await supabase
              .from('todos')
              .update({ description: action.data.description })
              .eq('id', action.data.id);
            break;
            
          case 'delete_todo':
            await supabase
              .from('todos')
              .delete()
              .eq('id', action.data.id);
            break;
            
          case 'update_summary':
            await supabase
              .from('meetings')
              .update({ summary: action.data.summary })
              .eq('id', meetingId);
            break;
            
          case 'create_recommendation':
            await supabase
              .from('todo_ai_recommendations')
              .insert({
                todo_id: action.data.todo_id,
                recommendation_text: action.data.recommendation,
                email_draft: action.data.email_draft
              });
            break;
            
          case 'update_recommendation':
            await supabase
              .from('todo_ai_recommendations')
              .update({
                recommendation_text: action.data.recommendation,
                email_draft: action.data.email_draft
              })
              .eq('todo_id', action.data.todo_id);
            break;
        }
      }
      
      onDataUpdate?.();
      toast({
        title: "Actions exécutées",
        description: `${actions.length} action(s) appliquée(s) avec succès`,
      });
    } catch (error) {
      console.error('Erreur exécution actions:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'exécuter certaines actions",
        variant: "destructive",
      });
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const { data, error } = await supabase.functions.invoke('meeting-assistant-agent', {
        body: {
          meetingId,
          userMessage: inputValue,
          conversationHistory
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        actions: data.actions
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.needsConfirmation) {
        setPendingActions(data.actions);
        setConfirmationMessage(data.confirmationMessage);
        setShowConfirmation(true);
      } else if (data.actions && data.actions.length > 0) {
        await executeActions(data.actions);
      }

    } catch (error) {
      console.error('Erreur assistant:', error);
      toast({
        title: "Erreur",
        description: "Impossible de communiquer avec l'assistant",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmActions = async () => {
    await executeActions(pendingActions);
    setPendingActions([]);
    setShowConfirmation(false);
    setConfirmationMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-600" />
          Assistant de réunion IA
          <Badge variant="outline" className="ml-auto">
            {messages.length} échange{messages.length > 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col gap-3 p-4">
        {/* Zone de messages */}
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Bot className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">
                  Bonjour ! Je peux vous aider à modifier les tâches, recommandations et résumé de cette réunion.
                </p>
                <p className="text-xs mt-2">
                  Exemple : "Ajoute une tâche pour contacter le fournisseur ABC" ou "Modifie le résumé pour inclure..."
                </p>
              </div>
            )}
            
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
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
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    {message.actions && message.actions.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs font-medium mb-1">Actions proposées :</p>
                        {message.actions.map((action, idx) => (
                          <div key={idx} className="text-xs flex items-center gap-1 mt-1">
                            <CheckCircle className="h-3 w-3 text-green-600" />
                            <span>{action.explanation}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-xs mt-2 opacity-70">
                      {message.timestamp.toLocaleTimeString('fr-FR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Confirmation d'actions */}
        {showConfirmation && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-800">Confirmation requise</p>
                  <p className="text-sm text-orange-700 mt-1">{confirmationMessage}</p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={handleConfirmActions} className="bg-orange-600 hover:bg-orange-700">
                      Confirmer
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowConfirmation(false)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Zone de saisie */}
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Tapez votre message... (Entrée pour envoyer)"
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
