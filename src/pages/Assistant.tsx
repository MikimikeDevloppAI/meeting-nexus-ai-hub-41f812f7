import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Bot, User, Globe, Database, Loader2, ExternalLink, Trash2, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import EditableTaskValidationDialog from "@/components/EditableTaskValidationDialog";

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
      content: "Bonjour ! Je suis l'assistant IA spécialisé du cabinet OphtaCare du Dr Tabibian. 🏥\n\nJ'ai maintenant une architecture d'agents intelligents améliorée :\n• 🧠 **Coordinateur** : Analyse sémantique avec expansion des termes de recherche\n• 🗄️ **Base de données** : Recherche intelligente avec extraction ciblée\n• 🎯 **Embeddings** : Recherche itérative avec synonymes et fallback\n• 🌐 **Internet** : Enrichissement contextuel stratégique\n\nQue puis-je faire pour vous ?",
      isUser: false,
      timestamp: new Date(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingTaskAction, setPendingTaskAction] = useState<TaskAction | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [users, setUsers] = useState<{id: string, name: string, email: string}[]>([]);
  const [participants, setParticipants] = useState<{id: string, name: string, email: string}[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchUsers();
    fetchParticipants();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email")
        .eq("approved", true)
        .order("name");

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from("participants")
        .select("id, name, email")
        .order("name");

      if (error) throw error;
      setParticipants(data || []);
    } catch (error: any) {
      console.error("Error fetching participants:", error);
    }
  };

  const clearChatHistory = () => {
    setMessages([
      {
        id: '1',
        content: "Bonjour ! Je suis l'assistant IA spécialisé du cabinet OphtaCare du Dr Tabibian. 🏥\n\nJ'ai maintenant une architecture d'agents intelligents améliorée :\n• 🧠 **Coordinateur** : Analyse sémantique avec expansion des termes de recherche\n• 🗄️ **Base de données** : Recherche intelligente avec extraction ciblée\n• 🎯 **Embeddings** : Recherche itérative avec synonymes et fallback\n• 🌐 **Internet** : Enrichissement contextuel stratégique\n\nQue puis-je faire pour vous ?",
        isUser: false,
        timestamp: new Date(),
      }
    ]);
    
    toast({
      title: "Historique effacé",
      description: "La conversation a été remise à zéro avec l'assistant amélioré.",
    });
  };

  const findParticipantByName = (name: string) => {
    if (!name) return null;
    
    const lowerName = name.toLowerCase();
    return participants.find(p => 
      p.name.toLowerCase().includes(lowerName) ||
      lowerName.includes(p.name.toLowerCase()) ||
      p.email.toLowerCase().includes(lowerName)
    );
  };

  const parseTaskAction = (content: string): TaskAction | null => {
    console.log('Parsing task action from content:', content);
    
    // Improved regex to handle the syntax properly
    const actionMatch = content.match(/\[ACTION_TACHE:\s*TYPE=([^,\]]+)(?:,\s*(.+?))?\]/s);
    if (!actionMatch) {
      console.log('No action match found');
      return null;
    }

    const type = actionMatch[1].trim() as TaskAction['type'];
    let paramsStr = actionMatch[2] || '';
    
    console.log('Found action type:', type);
    console.log('Params string:', paramsStr);
    
    const data: TaskAction['data'] = {};
    
    if (paramsStr) {
      // Clean the params string by removing CONTEXT_PARTICIPANTS
      paramsStr = paramsStr.replace(/\s*CONTEXT_PARTICIPANTS:[^,}]*(?:,|$)/gi, '');
      
      // Handle both key="value" and key=value formats
      const paramRegex = /(\w+)=(?:"([^"]*)"|([^,\]]+))/g;
      let match;
      
      while ((match = paramRegex.exec(paramsStr)) !== null) {
        const key = match[1].toLowerCase();
        let value = match[2] || match[3] || '';
        
        console.log(`Found param: ${key} = ${value}`);
        
        // Clean up description
        if (key === 'description') {
          value = value.replace(/\s*CONTEXT_PARTICIPANTS:.*$/gi, '').trim();
          value = value.replace(/\n+/g, ' ').trim();
        }
        
        // Handle assigned_to specially - try to find participant by name first
        if (key === 'assigned_to') {
          const participant = findParticipantByName(value);
          if (participant) {
            console.log(`Found participant for assignment: ${participant.name} (${participant.id})`);
            data[key as keyof TaskAction['data']] = participant.id;
          } else {
            const lowerValue = value.toLowerCase();
            const user = users.find(u => 
              u.name.toLowerCase().includes(lowerValue) ||
              u.email.toLowerCase().includes(lowerValue) ||
              lowerValue.includes(u.name.toLowerCase())
            );
            
            if (user) {
              console.log(`Found user for assignment: ${user.name} (${user.id})`);
              data[key as keyof TaskAction['data']] = user.id;
            } else {
              console.log(`No participant or user found for: ${value}, keeping as text`);
              data[key as keyof TaskAction['data']] = value;
            }
          }
        } else {
          data[key as keyof TaskAction['data']] = value;
        }
      }
    }

    const taskAction = { type, data };
    console.log('Final parsed task action:', taskAction);
    return taskAction;
  };

  const executeTaskAction = async (action: TaskAction) => {
    try {
      console.log('Executing task action:', action);
      
      switch (action.type) {
        case 'create':
          const { data: newTodo, error: createError } = await supabase
            .from('todos')
            .insert({
              description: action.data.description!,
              assigned_to: action.data.assigned_to,
              due_date: action.data.due_date,
              meeting_id: action.data.meeting_id,
              status: action.data.status || 'pending'
            })
            .select()
            .single();
            
          if (createError) {
            console.error('Error creating todo:', createError);
            throw createError;
          }
          
          console.log('Todo created successfully:', newTodo);
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

      // Include participants list in the context for the AI
      const contextMessage = `${inputMessage}\n\nCONTEXT_PARTICIPANTS: ${participants.map(p => `${p.name} (${p.email}, ID: ${p.id})`).join(', ')}`;
      
      const { data, error } = await supabase.functions.invoke('ai-agent', {
        body: { 
          message: contextMessage,
          conversationHistory: conversationHistory
        }
      });

      if (error) {
        console.error('[ASSISTANT] Error:', error);
        throw error;
      }

      console.log('[ASSISTANT] Response data:', data);

      // Parse task action from response
      const taskAction = parseTaskAction(data.response);
      
      // Clean the response content by removing the action syntax and CONTEXT_PARTICIPANTS
      let cleanContent = data.response;
      if (taskAction) {
        cleanContent = cleanContent.replace(/\[ACTION_TACHE:[^\]]*\]/gs, '').trim();
      }
      cleanContent = cleanContent.replace(/\s*CONTEXT_PARTICIPANTS:.*$/gi, '').trim();

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
        console.log('[ASSISTANT] Found task action, opening dialog:', taskAction);
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
    setIsTaskDialogOpen(false);
    setPendingTaskAction(null);
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
    
    setIsTaskDialogOpen(false);
    setPendingTaskAction(null);
  };

  return (
    <div className="animate-fade-in h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Assistant IA OphtaCare</h1>
        <p className="text-muted-foreground">
          Assistant intelligent optimisé pour le cabinet OphtaCare
        </p>
      </div>

      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle>Assistant OphtaCare</CardTitle>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearChatHistory}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Effacer
              </Button>
            </div>
          </div>
          <CardDescription>
            Assistant intelligent optimisé pour le cabinet OphtaCare
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
                      <div 
                        className="text-sm whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ 
                          __html: message.isUser ? message.content : renderMessageWithLinks(message.content)
                        }}
                      />
                      
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
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPendingTaskAction(message.taskAction!);
                                setIsTaskDialogOpen(true);
                              }}
                              className="ml-2"
                            >
                              Valider
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {!message.isUser && (
                        <div className="mt-3 space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {message.contextFound && (
                              <Badge variant="outline" className="text-xs">
                                <Database className="h-3 w-3 mr-1" />
                                OphtaCare
                              </Badge>
                            )}
                            {message.hasInternetContext && (
                              <Badge variant="outline" className="text-xs">
                                <Globe className="h-3 w-3 mr-1" />
                                Enrichi
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
                    <span className="text-sm">Assistant OphtaCare optimisé...</span>
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
              placeholder="Tapez votre message..."
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
        </CardContent>
      </Card>

      <EditableTaskValidationDialog
        isOpen={isTaskDialogOpen}
        onClose={() => {
          setIsTaskDialogOpen(false);
          setPendingTaskAction(null);
        }}
        taskAction={pendingTaskAction}
        onValidate={handleTaskValidation}
        onReject={handleTaskRejection}
      />
    </div>
  );
};

export default Assistant;
