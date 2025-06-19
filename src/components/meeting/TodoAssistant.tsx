import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, Loader2, MessageSquare, User, ChevronUp, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  action?: string;
}

interface TodoAssistantProps {
  todoId: string;
  todoDescription: string;
  onUpdate?: () => void;
}

export const TodoAssistant = ({ todoId, todoDescription, onUpdate }: TodoAssistantProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<'modify_description' | 'modify_recommendation' | 'modify_email'>('modify_description');
  const { toast } = useToast();

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
      action: activeAction
    };

    setInputValue("");
    setIsLoading(true);
    setMessages(prev => [...prev, userMessage]);

    try {
      console.log('📤 Envoi demande todo assistant:', inputValue, 'action:', activeAction);
      
      const { data, error } = await supabase.functions.invoke('todo-assistant', {
        body: {
          todoId,
          userMessage: inputValue,
          action: activeAction
        }
      });

      console.log('📥 Réponse reçue:', data);

      if (error) {
        throw new Error(`Erreur: ${error.message}`);
      }

      if (!data || data.success === false) {
        throw new Error(data?.error || 'Erreur inconnue');
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response || "Modification effectuée",
        timestamp: new Date(),
        action: activeAction
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.success) {
        console.log('🔄 Mise à jour todo');
        onUpdate?.();
        
        const actionLabels = {
          modify_description: "Description modifiée",
          modify_recommendation: "Recommandation modifiée", 
          modify_email: "Email modifié"
        };
        
        toast({
          title: `✅ ${actionLabels[activeAction]}`,
          description: data.explanation || "La modification a été effectuée",
        });
      }

    } catch (error: any) {
      console.error('❌ Erreur:', error);
      
      const errorMessage: Message = {
        role: 'assistant',
        content: `❌ ${error.message}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "⚠️ Erreur",
        description: "Impossible d'effectuer la modification. Réessayez.",
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

  const actionLabels = {
    modify_description: 'Description',
    modify_recommendation: 'Recommandation',
    modify_email: 'Email'
  };

  return (
    <div className={`${isOpen ? 'col-span-full' : ''}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-20 flex flex-col items-center justify-center gap-2 text-foreground hover:text-foreground hover:bg-blue-100/50"
          >
            <Bot className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium text-black">Assistant IA</span>
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </div>
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-2">
          <Card className="border-dashed">
            <CardContent className="p-3">
              <div className="space-y-3">
                {/* Action selector */}
                <div className="flex flex-wrap gap-1">
                  {Object.entries(actionLabels).map(([action, label]) => (
                    <Badge
                      key={action}
                      variant={activeAction === action ? "default" : "outline"}
                      className="cursor-pointer text-xs h-5"
                      onClick={() => setActiveAction(action as any)}
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
                
                {/* Messages */}
                <ScrollArea className="h-[200px] pr-2">
                  <div className="space-y-2">
                    {messages.length === 0 && (
                      <div className="text-center py-2 text-muted-foreground">
                        <p className="text-xs">
                          Modifiez cette tâche avec l'IA
                        </p>
                      </div>
                    )}
                    
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex gap-3 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                            message.role === 'user' ? 'bg-primary' : 'bg-secondary'
                          }`}>
                            {message.role === 'user' ? (
                              <User className="h-3 w-3 text-primary-foreground" />
                            ) : (
                              <Bot className="h-3 w-3" />
                            )}
                          </div>
                          
                          <div className={`rounded-lg p-2 text-xs ${
                            message.role === 'user' 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-muted'
                          }`}>
                            {message.action && (
                              <div className="text-xs opacity-70 mb-1">
                                {actionLabels[message.action as keyof typeof actionLabels]}
                              </div>
                            )}
                            <p className="whitespace-pre-wrap">{message.content}</p>
                            <div className="text-xs opacity-70 mt-1">
                              {message.timestamp.toLocaleTimeString('fr-FR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Input */}
                <div className="flex gap-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={`Modifier ${actionLabels[activeAction].toLowerCase()}...`}
                    disabled={isLoading}
                    className="flex-1 text-xs h-7"
                  />
                  <Button 
                    onClick={sendMessage} 
                    disabled={isLoading || !inputValue.trim()}
                    size="sm"
                    className="h-7 w-7 p-0"
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
