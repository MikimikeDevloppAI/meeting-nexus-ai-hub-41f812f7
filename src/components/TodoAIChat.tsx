
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Bot, User, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface TodoAIChatProps {
  todoId: string;
  todoDescription: string;
}

export const TodoAIChat = ({ todoId, todoDescription }: TodoAIChatProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: `Je suis ici pour vous aider avec cette tâche spécifique : "${todoDescription}". 

Je peux vous aider à :
• Analyser les étapes nécessaires pour accomplir cette tâche
• Vous suggérer des ressources ou des contacts utiles
• Vous donner des conseils pratiques pour la réalisation
• Répondre à vos questions sur cette tâche

Que puis-je faire pour vous aider avec cette tâche ?`,
      isUser: false,
      timestamp: new Date(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      isUser: true,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputMessage("");
    setIsLoading(true);

    try {
      // Get the last 10 messages for conversation history (excluding the current user message we just added)
      const conversationHistory = updatedMessages
        .slice(-11, -1) // Get last 10 messages (excluding the current one)
        .map(msg => ({
          isUser: msg.isUser,
          content: msg.content,
          timestamp: msg.timestamp.toISOString()
        }));

      // Create a specialized context for this specific task
      const taskContextMessage = `AIDE SPÉCIALISÉE POUR TÂCHE SPÉCIFIQUE

CONTEXTE DE LA TÂCHE :
- ID de la tâche : ${todoId}
- Description de la tâche : "${todoDescription}"
- Type de demande : Assistance pour accomplir cette tâche

QUESTION DE L'UTILISATEUR :
${inputMessage}

INSTRUCTIONS SPÉCIALES :
Tu es un assistant spécialisé pour aider l'utilisateur à accomplir cette tâche spécifique du cabinet OphtaCare. 
Concentre-toi uniquement sur cette tâche et fournis des conseils pratiques, des étapes détaillées, et des suggestions utiles pour la mener à bien.
Ne propose pas de créer de nouvelles tâches, mais aide à accomplir celle-ci.`;

      const { data, error } = await supabase.functions.invoke('ai-agent', {
        body: { 
          message: taskContextMessage,
          todoId: todoId,
          conversationHistory: conversationHistory,
          taskContext: {
            todoId,
            description: todoDescription,
            type: 'task_assistance'
          }
        }
      });

      if (error) throw error;

      // Clean the response content
      let cleanContent = data.response || "Désolé, je n'ai pas pu traiter votre demande.";
      
      // Remove any task action syntax since this is for assistance only
      cleanContent = cleanContent.replace(/\[ACTION_TACHE:[^\]]*\]/gs, '').trim();
      cleanContent = cleanContent.replace(/\s*CONTEXT_PARTICIPANTS:.*$/gi, '').trim();

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: cleanContent,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);

    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le message",
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

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2"
      >
        <Bot className="h-4 w-4" />
        Assistant IA Tâche
      </Button>
    );
  }

  return (
    <Card className="mt-3">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Assistant IA Spécialisé</span>
            <Badge variant="outline" className="text-xs">Aide Tâche</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        <div className="space-y-3 max-h-64 overflow-y-auto mb-3">
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
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  <div className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
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
                <span className="text-xs">Analyse de la tâche...</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Comment puis-je vous aider avec cette tâche ?"
            disabled={isLoading}
            className="text-xs h-8"
          />
          <Button 
            onClick={sendMessage} 
            disabled={isLoading || !inputMessage.trim()}
            size="sm"
            className="h-8 px-2"
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
