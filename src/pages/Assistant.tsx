import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, File, Paperclip, CheckCircle, AlertCircle, Plus, Calendar, Bot, User, Loader2, Database, FileText, Globe, ListTodo, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AIActionValidationDialog } from "@/components/AIActionValidationDialog";

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  sources?: any[];
  taskContext?: any;
  databaseContext?: any;
  hasRelevantContext?: boolean;
  actuallyUsedDocuments?: string[];
}

interface Task {
  id: string;
  description: string;
  status: string;
  assigned_to: string;
  due_date: string | null;
}

const Assistant = () => {
  const [inputMessage, setInputMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Nouveaux états pour les toggles (tous activés par défaut)
  const [databaseSearchEnabled, setDatabaseSearchEnabled] = useState(true);
  const [documentSearchEnabled, setDocumentSearchEnabled] = useState(true);
  const [internetSearchEnabled, setInternetSearchEnabled] = useState(true);
  const [todoEnabled, setTodoEnabled] = useState(true);
  const [meetingPointsEnabled, setMeetingPointsEnabled] = useState(true);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const [pendingAction, setPendingAction] = useState<{
    type: 'create_task' | 'add_meeting_point';
    description: string;
    details?: any;
  } | null>(null);
  const [isValidationDialogOpen, setIsValidationDialogOpen] = useState(false);

  useEffect(() => {
    // Scroll to bottom on new message
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage;
    setInputMessage("");
    
    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      content: userMessage,
      isUser: true,
      timestamp: new Date(),
    };

    const updatedHistory = [...chatHistory, newUserMessage];
    setChatHistory(updatedHistory);
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Construire le contexte avec les toggles activés
      const agentContext = {
        userId: user?.id,
        databaseSearch: databaseSearchEnabled,
        documentSearch: documentSearchEnabled,
        internetSearch: internetSearchEnabled,
        todoManagement: todoEnabled,
        meetingPoints: meetingPointsEnabled,
        // Mode legacy pour compatibilité
        documentSearchMode: documentSearchEnabled
      };
      
      const response = await fetch(
        "https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/ai-agent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemxsamBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMzOTU0OTcsImV4cCI6MjA0ODk3MTQ5N30.Vh4XAp1X6eJlEtqNNzYIoIuTPEweat14VgWCF5vUNAI'}`,
          },
          body: JSON.stringify({
            message: userMessage,
            context: agentContext,
            conversationHistory: updatedHistory.map(msg => ({
              content: msg.content,
              isUser: msg.isUser,
              timestamp: msg.timestamp
            }))
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Check if there's a pending action that needs validation
      if (data.meetingPreparationResult?.actionPerformed || data.taskContext?.taskCreated) {
        // Parse the response to check for action requests
        const responseText = data.response || '';
        
        // Check for task creation pattern
        if (responseText.includes('[ACTION_TACHE:') || data.taskContext?.taskCreated) {
          const taskMatch = responseText.match(/\[ACTION_TACHE:([^\]]+)\]/);
          if (taskMatch) {
            setPendingAction({
              type: 'create_task',
              description: taskMatch[1].trim(),
              details: data.taskContext
            });
            setIsValidationDialogOpen(true);
            return; // Don't add the message yet
          }
        }
        
        // Check for meeting point addition
        if (data.meetingPreparationResult?.action === 'add' && data.meetingPreparationResult?.actionPerformed) {
          setPendingAction({
            type: 'add_meeting_point',
            description: data.meetingPreparationResult.message || 'Point ajouté à l\'ordre du jour'
          });
          setIsValidationDialogOpen(true);
          return; // Don't add the message yet
        }
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        isUser: false,
        timestamp: new Date(),
        sources: data.sources || [],
        taskContext: data.taskContext,
        databaseContext: data.databaseContext,
        hasRelevantContext: data.hasRelevantContext,
        actuallyUsedDocuments: data.actuallyUsedDocuments
      };

      setChatHistory(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'envoi du message",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionConfirm = async () => {
    if (!pendingAction) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (pendingAction.type === 'create_task') {
        // Create the task in the database
        const { error } = await supabase
          .from('todos')
          .insert([{
            description: pendingAction.description,
            status: 'confirmed',
            created_at: new Date().toISOString(),
            assigned_to: user?.id
          }]);

        if (error) throw error;

        toast({
          title: "Tâche créée",
          description: `La tâche "${pendingAction.description}" a été créée avec succès`,
        });
      } else if (pendingAction.type === 'add_meeting_point') {
        // Add point to meeting preparation
        const { error } = await supabase
          .from('meeting_preparation_custom_points')
          .insert([{
            point_text: pendingAction.description,
            created_by: user?.id
          }]);

        if (error) throw error;

        toast({
          title: "Point ajouté",
          description: `Le point "${pendingAction.description}" a été ajouté à l'ordre du jour`,
        });
      }

      // Add success message to chat
      const successMessage: ChatMessage = {
        id: Date.now().toString(),
        content: `✅ Action confirmée : ${pendingAction.description}`,
        isUser: false,
        timestamp: new Date(),
      };

      setChatHistory(prev => [...prev, successMessage]);

    } catch (error) {
      console.error('Error confirming action:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la confirmation de l'action",
        variant: "destructive",
      });
    }
  };

  const handleActionReject = () => {
    if (!pendingAction) return;

    const rejectMessage: ChatMessage = {
      id: Date.now().toString(),
      content: `❌ Action rejetée : ${pendingAction.description}`,
      isUser: false,
      timestamp: new Date(),
    };

    setChatHistory(prev => [...prev, rejectMessage]);
    
    toast({
      title: "Action rejetée",
      description: "L'action proposée par l'assistant a été rejetée",
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Assistant IA - Cabinet Médical</h1>
        <p className="text-muted-foreground">
          Votre assistant intelligent pour la gestion de votre cabinet médical.
        </p>
      </div>

      {/* Settings Card */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Fonctionnalités de l'assistant</CardTitle>
          <CardDescription>
            Activez ou désactivez les différentes fonctionnalités de l'assistant IA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Database Search Toggle */}
            <div className="flex items-center space-x-3 p-3 border rounded-lg">
              <Database className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <Label htmlFor="database-search" className="text-sm font-medium">
                  Recherche base de données
                </Label>
                <p className="text-xs text-muted-foreground">Recherche dans les données du cabinet</p>
              </div>
              <Switch 
                id="database-search" 
                checked={databaseSearchEnabled} 
                onCheckedChange={setDatabaseSearchEnabled} 
              />
            </div>

            {/* Document Search Toggle */}
            <div className="flex items-center space-x-3 p-3 border rounded-lg">
              <FileText className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <Label htmlFor="document-search" className="text-sm font-medium">
                  Recherche documentaire
                </Label>
                <p className="text-xs text-muted-foreground">Recherche dans les documents</p>
              </div>
              <Switch 
                id="document-search" 
                checked={documentSearchEnabled} 
                onCheckedChange={setDocumentSearchEnabled} 
              />
            </div>

            {/* Internet Search Toggle */}
            <div className="flex items-center space-x-3 p-3 border rounded-lg">
              <Globe className="h-5 w-5 text-purple-600" />
              <div className="flex-1">
                <Label htmlFor="internet-search" className="text-sm font-medium">
                  Recherche internet
                </Label>
                <p className="text-xs text-muted-foreground">Recherche d'informations en ligne</p>
              </div>
              <Switch 
                id="internet-search" 
                checked={internetSearchEnabled} 
                onCheckedChange={setInternetSearchEnabled} 
              />
            </div>

            {/* Todo Management Toggle */}
            <div className="flex items-center space-x-3 p-3 border rounded-lg">
              <ListTodo className="h-5 w-5 text-orange-600" />
              <div className="flex-1">
                <Label htmlFor="todo-management" className="text-sm font-medium">
                  Gestion des tâches
                </Label>
                <p className="text-xs text-muted-foreground">Création et suivi des tâches</p>
              </div>
              <Switch 
                id="todo-management" 
                checked={todoEnabled} 
                onCheckedChange={setTodoEnabled} 
              />
            </div>

            {/* Meeting Points Toggle */}
            <div className="flex items-center space-x-3 p-3 border rounded-lg">
              <Users className="h-5 w-5 text-red-600" />
              <div className="flex-1">
                <Label htmlFor="meeting-points" className="text-sm font-medium">
                  Points de réunion
                </Label>
                <p className="text-xs text-muted-foreground">Gestion de l'ordre du jour</p>
              </div>
              <Switch 
                id="meeting-points" 
                checked={meetingPointsEnabled} 
                onCheckedChange={setMeetingPointsEnabled} 
              />
            </div>
          </div>
          
          {/* Status indicator */}
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="font-medium">
                {[databaseSearchEnabled, documentSearchEnabled, internetSearchEnabled, todoEnabled, meetingPointsEnabled].filter(Boolean).length} 
                {" "}fonctionnalité(s) activée(s)
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chat Card */}
      <Card className="h-[600px] flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Conversation avec l'assistant</CardTitle>
          </div>
          <CardDescription>
            Posez vos questions et gérez vos tâches avec l'assistant IA.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-4">
          <ScrollArea className="flex-1 pr-4 mb-4" ref={chatContainerRef}>
            <div className="space-y-4">
              {chatHistory.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Bonjour ! Comment puis-je vous aider ?</p>
                  <p className="text-sm">
                    Je peux vous aider avec la gestion de vos tâches, documents, réunions et bien plus encore.
                  </p>
                </div>
              )}
              
              {chatHistory.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.isUser ? 'justify-end' : 'justify-start'}`}>
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
                      <div className="text-xs opacity-70 mt-2">
                        {format(message.timestamp, "d MMM yyyy 'à' HH:mm", { locale: fr })}
                      </div>

                      {/* Sources d'information */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-opacity-20">
                          <p className="text-xs font-semibold mb-1">Sources :</p>
                          <ul className="list-disc pl-4 text-xs space-y-1">
                            {message.sources.map((source, index) => (
                              <li key={index}>
                                <a href={source.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                  {source.title || source.url}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Documents utilisés */}
                      {message.actuallyUsedDocuments && message.actuallyUsedDocuments.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-opacity-20">
                          <p className="text-xs font-semibold mb-1">Documents utilisés :</p>
                          <div className="flex flex-wrap gap-1">
                            {message.actuallyUsedDocuments.map((docId, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                Doc {docId}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Contexte des tâches */}
                      {message.taskContext && message.taskContext.currentTasks && message.taskContext.currentTasks.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-opacity-20">
                          <p className="text-xs font-semibold mb-1">Tâches associées :</p>
                          <ul className="list-disc pl-4 text-xs space-y-1">
                            {message.taskContext.currentTasks.map((task: Task) => (
                              <li key={task.id}>
                                {task.description} <Badge variant="secondary" className="text-xs ml-1">{task.status}</Badge>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Contexte de la base de données */}
                      {message.databaseContext && (
                        <div className="mt-2 pt-2 border-t border-opacity-20">
                          {message.databaseContext.meetings && message.databaseContext.meetings.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs font-semibold mb-1">Réunions associées :</p>
                              <ul className="list-disc pl-4 text-xs space-y-1">
                                {message.databaseContext.meetings.map((meeting: any) => (
                                  <li key={meeting.id}>
                                    {meeting.title} <Badge variant="outline" className="text-xs ml-1">
                                      {format(new Date(meeting.created_at), "d MMM", { locale: fr })}
                                    </Badge>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {message.databaseContext.documents && message.databaseContext.documents.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold mb-1">Documents associés :</p>
                              <ul className="list-disc pl-4 text-xs space-y-1">
                                {message.databaseContext.documents.map((document: any) => (
                                  <li key={document.id}>
                                    {document.ai_generated_name || document.original_name}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
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
                    <span className="text-sm">L'assistant réfléchit...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex gap-2 pt-4 border-t">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Tapez votre message ici..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={handleSendMessage} 
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
            💡 Configurez les fonctionnalités actives dans les paramètres ci-dessus pour personnaliser l'assistant.
          </div>
        </CardContent>
      </Card>
      
      <AIActionValidationDialog
        isOpen={isValidationDialogOpen}
        onClose={() => {
          setIsValidationDialogOpen(false);
          setPendingAction(null);
        }}
        action={pendingAction}
        onConfirm={handleActionConfirm}
        onReject={handleActionReject}
      />
    </div>
  );
};

export default Assistant;
