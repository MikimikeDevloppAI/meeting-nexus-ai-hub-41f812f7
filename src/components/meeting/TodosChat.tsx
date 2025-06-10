
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckSquare, Send, Loader2, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface TodosChatProps {
  meetingId: string;
  onTodosUpdate?: () => void;
}

export const TodosChat = ({ meetingId, onTodosUpdate }: TodosChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const { toast } = useToast();

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setInputValue("");
    setIsLoading(true);
    setIsTyping(true);
    setMessages(prev => [...prev, userMessage]);

    // Animation de typing
    const typingMessage: Message = {
      role: 'assistant',
      content: "L'assistant travaille sur vos tâches...",
      timestamp: new Date()
    };
    setMessages(prev => [...prev, typingMessage]);

    try {
      console.log('📤 Envoi demande todos:', inputValue);
      
      // Timeout côté client de 12s
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout client (12s)')), 12000)
      );

      const requestPromise = supabase.functions.invoke('todos-chat', {
        body: {
          meetingId,
          userMessage: inputValue
        }
      });

      const { data, error } = await Promise.race([requestPromise, timeoutPromise]) as any;

      console.log('📥 Réponse reçue:', data);

      // Retirer le message de typing
      setMessages(prev => prev.slice(0, -1));
      setIsTyping(false);

      if (error) {
        throw new Error(`Erreur: ${error.message}`);
      }

      if (!data || data.success === false) {
        throw new Error(data?.error || 'Erreur inconnue');
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response || "Action effectuée",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.success) {
        console.log('🔄 Mise à jour des todos');
        onTodosUpdate?.();
        
        toast({
          title: "✅ Tâches mises à jour",
          description: data.explanation || "Les tâches ont été modifiées",
        });
      }

    } catch (error: any) {
      console.error('❌ Erreur:', error);
      
      // Retirer le message de typing en cas d'erreur
      setMessages(prev => prev.slice(0, -1));
      setIsTyping(false);
      
      const errorMessage: Message = {
        role: 'assistant',
        content: `❌ ${error.message}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "⚠️ Erreur",
        description: "Impossible de modifier les tâches. Réessayez.",
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

  return (
    <Card className="h-[300px] flex flex-col border-dashed border-green-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CheckSquare className="h-4 w-4 text-green-600" />
          Assistant Tâches
          {isTyping && (
            <div className="flex items-center gap-1 ml-2">
              <Bot className="h-3 w-3 text-green-500 animate-pulse" />
              <div className="flex gap-1">
                <div className="w-1 h-1 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1 h-1 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1 h-1 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col gap-3 p-4">
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                <p className="text-xs">
                  Gérez les tâches : "Ajoute une tâche...", "Supprime la tâche...", "Modifie..."
                </p>
              </div>
            )}
            
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`rounded-lg p-2 max-w-[80%] text-xs ${
                  message.role === 'user' 
                    ? 'bg-green-600 text-white' 
                    : message.content.includes('travaille') 
                      ? 'bg-yellow-100 text-yellow-800 animate-pulse'
                      : 'bg-gray-100 text-gray-900'
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
            ))}
          </div>
        </ScrollArea>

        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isLoading ? "Traitement en cours..." : "Gérer les tâches..."}
            disabled={isLoading}
            className="flex-1 text-xs"
          />
          <Button 
            onClick={sendMessage} 
            disabled={isLoading || !inputValue.trim()}
            size="sm"
            className={isLoading ? 'animate-pulse' : ''}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
