
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, CheckCircle, AlertCircle, User, Loader2, Clock, CheckCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: AssistantAction[];
  status?: 'processing' | 'completed' | 'error';
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
  const [processingMessageId, setProcessingMessageId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const updateMessageStatus = (messageIndex: number, status: 'processing' | 'completed' | 'error') => {
    setMessages(prev => prev.map((msg, idx) => 
      idx === messageIndex ? { ...msg, status } : msg
    ));
  };

  const executeActions = async (actions: AssistantAction[]) => {
    try {
      console.log('🔧 Exécution de', actions.length, 'action(s)...');
      
      const results: string[] = [];
      
      for (const action of actions) {
        console.log('⚡ Exécution action:', action.type, action.data);
        
        switch (action.type) {
          case 'create_todo':
            const { data: newTodo, error: createError } = await supabase
              .from('todos')
              .insert({
                meeting_id: meetingId,
                description: action.data.description,
                status: 'confirmed'
              })
              .select()
              .single();
            
            if (createError) throw createError;
            console.log('✅ Tâche créée:', newTodo?.id);
            results.push(`✅ Tâche créée: "${action.data.description}"`);
            break;
            
          case 'update_todo':
            const { error: updateError } = await supabase
              .from('todos')
              .update({ description: action.data.description })
              .eq('id', action.data.id);
            
            if (updateError) throw updateError;
            console.log('✅ Tâche mise à jour:', action.data.id);
            results.push(`✅ Tâche mise à jour: "${action.data.description}"`);
            break;
            
          case 'delete_todo':
            const { error: deleteError } = await supabase
              .from('todos')
              .delete()
              .eq('id', action.data.id);
            
            if (deleteError) throw deleteError;
            console.log('✅ Tâche supprimée:', action.data.id);
            results.push(`✅ Tâche supprimée`);
            break;
            
          case 'update_summary':
            const { error: summaryError } = await supabase
              .from('meetings')
              .update({ summary: action.data.summary })
              .eq('id', meetingId);
            
            if (summaryError) throw summaryError;
            console.log('✅ Résumé mis à jour');
            results.push(`✅ Résumé de la réunion mis à jour`);
            break;
            
          case 'create_recommendation':
            const { error: createRecError } = await supabase
              .from('todo_ai_recommendations')
              .insert({
                todo_id: action.data.todo_id,
                recommendation_text: action.data.recommendation,
                email_draft: action.data.email_draft
              });
            
            if (createRecError) throw createRecError;
            console.log('✅ Recommandation créée pour tâche:', action.data.todo_id);
            results.push(`✅ Recommandation créée pour la tâche`);
            break;
            
          case 'update_recommendation':
            const { error: updateRecError } = await supabase
              .from('todo_ai_recommendations')
              .update({
                recommendation_text: action.data.recommendation,
                email_draft: action.data.email_draft
              })
              .eq('todo_id', action.data.todo_id);
            
            if (updateRecError) throw updateRecError;
            console.log('✅ Recommandation mise à jour pour tâche:', action.data.todo_id);
            results.push(`✅ Recommandation mise à jour pour la tâche`);
            break;
        }
      }
      
      console.log('🎉 Toutes les actions exécutées avec succès');
      onDataUpdate?.();
      
      // Ajouter un message de compte-rendu
      const reportMessage: Message = {
        role: 'assistant',
        content: `🎉 **Actions terminées avec succès !**\n\n${results.join('\n')}\n\nLes modifications ont été appliquées et sont maintenant visibles dans l'interface.`,
        timestamp: new Date(),
        status: 'completed'
      };
      
      setMessages(prev => [...prev, reportMessage]);
      
      toast({
        title: "Actions exécutées",
        description: `${actions.length} action(s) appliquée(s) avec succès`,
      });
    } catch (error) {
      console.error('❌ Erreur exécution actions:', error);
      
      // Ajouter un message d'erreur
      const errorMessage: Message = {
        role: 'assistant',
        content: `❌ **Erreur lors de l'exécution des actions**\n\nUne erreur s'est produite: ${error.message}\n\nVeuillez réessayer votre demande.`,
        timestamp: new Date(),
        status: 'error'
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
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
    const currentInput = inputValue;
    setInputValue("");
    setIsLoading(true);

    // Ajouter un message de traitement
    const processingMessage: Message = {
      role: 'assistant',
      content: "🤔 Je traite votre demande...",
      timestamp: new Date(),
      status: 'processing'
    };
    
    setMessages(prev => [...prev, processingMessage]);
    const currentMessageIndex = messages.length + 1; // +1 car on vient d'ajouter le message utilisateur
    setProcessingMessageId(currentMessageIndex);

    try {
      console.log('📤 Envoi message à l\'assistant:', currentInput);
      
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const { data, error } = await supabase.functions.invoke('meeting-assistant-agent', {
        body: {
          meetingId,
          userMessage: currentInput,
          conversationHistory
        }
      });

      console.log('📥 Réponse reçue:', data);

      if (error) {
        console.error('❌ Erreur function invoke:', error);
        throw error;
      }

      if (!data || !data.response) {
        console.error('❌ Réponse vide ou invalide:', data);
        throw new Error('Réponse vide de l\'assistant');
      }

      // Remplacer le message de traitement par la vraie réponse
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[currentMessageIndex] = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          actions: data.actions || [],
          status: 'completed'
        };
        return newMessages;
      });

      if (data.needsConfirmation && data.actions && data.actions.length > 0) {
        console.log('⚠️ Confirmation requise pour', data.actions.length, 'action(s)');
        setPendingActions(data.actions);
        setConfirmationMessage(data.confirmationMessage || "Voulez-vous appliquer ces actions ?");
        setShowConfirmation(true);
      } else if (data.actions && data.actions.length > 0) {
        console.log('⚡ Exécution immédiate de', data.actions.length, 'action(s)');
        await executeActions(data.actions);
      }

    } catch (error) {
      console.error('❌ Erreur assistant:', error);
      
      // Remplacer le message de traitement par un message d'erreur
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[currentMessageIndex] = {
          role: 'assistant',
          content: "❌ Désolé, je rencontre un problème technique. Pouvez-vous réessayer votre demande ?",
          timestamp: new Date(),
          status: 'error'
        };
        return newMessages;
      });
      
      toast({
        title: "Erreur",
        description: "Impossible de communiquer avec l'assistant",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setProcessingMessageId(null);
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
          Assistant de réunion IA
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
                    {message.actions && message.actions.length > 0 && message.status !== 'processing' && (
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

        {/* Confirmation d'actions */}
        {showConfirmation && (
          <Card className="border-orange-200 bg-orange-50 animate-scale-in">
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
            placeholder={isLoading ? "L'assistant traite votre demande..." : "Tapez votre message... (Entrée pour envoyer)"}
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
