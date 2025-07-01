
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Send, Loader2, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SummaryChatProps {
  meetingId: string;
  onSummaryUpdate?: () => void;
}

export const SummaryChat = ({ meetingId, onSummaryUpdate }: SummaryChatProps) => {
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

    // Animation de typing avec message plus informatif
    const typingMessage: Message = {
      role: 'assistant',
      content: "L'IA analyse le résumé et le transcript... peut prendre 15-20s",
      timestamp: new Date()
    };
    setMessages(prev => [...prev, typingMessage]);

    try {
      console.log('📤 Envoi demande résumé:', inputValue);
      
      // Timeout côté client de 20s (au lieu de 12s)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout client (20s)')), 20000)
      );

      const requestPromise = supabase.functions.invoke('summary-chat', {
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
        content: data.response || "Résumé mis à jour",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.success) {
        console.log('🔄 Mise à jour du résumé');
        onSummaryUpdate?.();
        
        toast({
          title: "✅ Résumé modifié",
          description: data.explanation || "Le résumé a été mis à jour",
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
        description: "Impossible de modifier le résumé. Réessayez.",
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
    <Card className="h-[300px] flex flex-col border-dashed border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-blue-600" />
          Assistant Résumé
          {isTyping && (
            <div className="flex items-center gap-1 ml-2">
              <Bot className="h-3 w-3 text-blue-500 animate-pulse" />
              <div className="flex gap-1">
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
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
                  Modifiez le résumé : "Ajoute plus de détails sur...", "Raccourcis la partie..."
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
                    ? 'bg-blue-600 text-white' 
                    : message.content.includes('analyse le résumé') 
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
            placeholder={isLoading ? "Analyse en cours (15-20s)..." : "Modifie le résumé..."}
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
