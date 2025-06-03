
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Bot, User, Globe, Database, Loader2, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import TaskValidationDialog from "@/components/TaskValidationDialog";

interface TaskAction {
  type: 'create' | 'update' | 'delete' | 'complete';
  data: {
    description?: string;
    assigned_to?: string;
    due_date?: string;
    meeting_id?: string;
    status?: string;
    id?: string;
  };
}

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  sources?: any[];
  internetSources?: any[];
  hasInternetContext?: boolean;
  contextFound?: boolean;
  taskAction?: TaskAction;
}

const Assistant = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Bonjour ! Je suis votre assistant IA spécialisé pour le cabinet médical. J'ai accès à l'historique complet de vos réunions et transcripts, et je peux rechercher des informations actuelles sur internet quand nécessaire. Je peux aussi vous aider à gérer vos tâches - avant de créer, modifier ou supprimer une tâche, je vous demanderai toujours votre validation. Posez-moi des questions !",
      isUser: false,
      timestamp: new Date(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingTaskAction, setPendingTaskAction] = useState<TaskAction | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const parseTaskAction = (content: string): TaskAction | null => {
    const actionMatch = content.match(/\[ACTION_TACHE:\s*TYPE=([^,]+),\s*(.+?)\]/);
    if (!actionMatch) return null;

    const type = actionMatch[1] as TaskAction['type'];
    const paramsStr = actionMatch[2];
    
    const data: TaskAction['data'] = {};
    
    // Parse parameters
    const params = paramsStr.split(',').map(p => p.trim());
    params.forEach(param => {
      const [key, value] = param.split('=').map(s => s.trim());
      if (key && value) {
        const cleanValue = value.replace(/^["']|["']$/g, '');
        data[key.toLowerCase() as keyof TaskAction['data']] = cleanValue;
      }
    });

    return { type, data };
  };

  const executeTaskAction = async (action: TaskAction) => {
    try {
      switch (action.type) {
        case 'create':
          const { error: createError } = await supabase
            .from('todos')
            .insert({
              description: action.data.description!,
              assigned_to: action.data.assigned_to,
              due_date: action.data.due_date,
              meeting_id: action.data.meeting_id,
              status: 'pending'
            });
          if (createError) throw createError;
          break;
          
        case 'update':
          const { error: updateError } = await supabase
            .from('todos')
            .update({
              description: action.data.description,
              assigned_to: action.data.assigned_to,
              due_date: action.data.due_date,
              status: action.data.status
            })
            .eq('id', action.data.id!);
          if (updateError) throw updateError;
          break;
          
        case 'delete':
          const { error: deleteError } = await supabase
            .from('todos')
            .delete()
            .eq('id', action.data.id!);
          if (deleteError) throw deleteError;
          break;
          
        case 'complete':
          const { error: completeError } = await supabase
            .from('todos')
            .update({ status: 'completed' })
            .eq('id', action.data.id!);
          if (completeError) throw completeError;
          break;
      }
      
      toast({
        title: "Tâche mise à jour",
        description: `L'action "${action.type}" a été exécutée avec succès.`,
      });
      
      // Add confirmation message
      const confirmationMessage: Message = {
        id: Date.now().toString(),
        content: `✅ Action validée et exécutée : ${action.type === 'create' ? 'Tâche créée' : 
                  action.type === 'update' ? 'Tâche modifiée' : 
                  action.type === 'delete' ? 'Tâche supprimée' : 
                  'Tâche marquée comme terminée'} avec succès.`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, confirmationMessage]);
      
    } catch (error: any) {
      console.error('Error executing task action:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'exécuter l'action sur la tâche",
        variant: "destructive",
      });
    }
  };

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
      const { data, error } = await supabase.functions.invoke('ai-agent', {
        body: { 
          message: inputMessage
        }
      });

      if (error) {
        console.error('[ASSISTANT] Error:', error);
        throw error;
      }

      // Parse task action from response
      const taskAction = parseTaskAction(data.response);
      
      // Clean the response content by removing the action syntax
      let cleanContent = data.response;
      if (taskAction) {
        cleanContent = cleanContent.replace(/\[ACTION_TACHE:[^\]]+\]/g, '').trim();
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: cleanContent || "Désolé, je n'ai pas pu traiter votre demande.",
        isUser: false,
        timestamp: new Date(),
        sources: data.sources || [],
        internetSources: data.internetSources || [],
        hasInternetContext: data.hasInternetContext,
        contextFound: data.contextFound,
        taskAction: taskAction,
      };

      setMessages(prev => [...prev, aiMessage]);

      // If there's a task action, show validation dialog
      if (taskAction) {
        setPendingTaskAction(taskAction);
        setIsTaskDialogOpen(true);
      }

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

  const handleTaskValidation = (action: TaskAction) => {
    executeTaskAction(action);
  };

  const handleTaskRejection = () => {
    const rejectionMessage: Message = {
      id: Date.now().toString(),
      content: "❌ Action annulée par l'utilisateur.",
      isUser: false,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, rejectionMessage]);
    
    toast({
      title: "Action annulée",
      description: "L'action sur la tâche a été annulée.",
    });
  };

  return (
    <div className="animate-fade-in h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Assistant IA</h1>
        <p className="text-muted-foreground">
          Chat avec un assistant IA qui a accès à toutes les données de votre cabinet et à internet
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
              <Badge variant="outline" className="text-xs">
                <Globe className="h-3 w-3 mr-1" />
                Recherche automatique
              </Badge>
            </div>
          </div>
          <CardDescription>
            L'assistant utilise automatiquement internet et vos données internes selon vos besoins
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
                      
                      {/* Task Action Buttons */}
                      {!message.isUser && message.taskAction && (
                        <div className="mt-3 pt-2 border-t border-gray-200">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              Action proposée:
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {message.taskAction.type === 'create' ? 'Créer tâche' :
                               message.taskAction.type === 'update' ? 'Modifier tâche' :
                               message.taskAction.type === 'delete' ? 'Supprimer tâche' :
                               'Terminer tâche'}
                            </Badge>
                          </div>
                        </div>
                      )}
                      
                      {!message.isUser && (
                        <div className="mt-3 space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {message.contextFound && (
                              <Badge variant="outline" className="text-xs">
                                <Database className="h-3 w-3 mr-1" />
                                Données internes
                              </Badge>
                            )}
                            {message.hasInternetContext && (
                              <Badge variant="outline" className="text-xs">
                                <Globe className="h-3 w-3 mr-1" />
                                Données internet
                              </Badge>
                            )}
                            {message.sources && message.sources.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {message.sources.length} source(s) interne(s)
                              </Badge>
                            )}
                          </div>
                          
                          {message.internetSources && message.internetSources.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <div className="text-xs font-medium mb-1 text-muted-foreground">
                                Sources consultées :
                              </div>
                              <div className="space-y-1">
                                {message.internetSources.map((source: any, index: number) => (
                                  <div key={index} className="text-xs">
                                    <a 
                                      href={source.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      {source.title || source.url}
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </div>
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
                    <span className="text-sm">L'assistant réfléchit et recherche...</span>
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
              placeholder="Posez une question, demandez des conseils ou gérez vos tâches..."
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
            💡 Exemples: "Résume les dernières décisions", "Crée une tâche pour la formation du personnel", "Trouve des fournisseurs d'équipement médical"
          </div>
        </CardContent>
      </Card>

      <TaskValidationDialog
        isOpen={isTaskDialogOpen}
        onClose={() => setIsTaskDialogOpen(false)}
        taskAction={pendingTaskAction}
        onValidate={handleTaskValidation}
        onReject={handleTaskRejection}
      />
    </div>
  );
};

export default Assistant;
