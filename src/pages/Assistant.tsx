import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, File, Paperclip, CheckCircle, AlertCircle, Plus, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
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
  const [documentSearchMode, setDocumentSearchMode] = useState(false);
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
      
      const response = await fetch(
        "https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/ai-agent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabase.supabaseKey}`,
          },
          body: JSON.stringify({
            message: userMessage,
            context: { 
              userId: user?.id,
              documentSearchMode: documentSearchMode 
            },
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

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-md p-4">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold">Assistant IA - Cabinet Médical</h1>
          <div className="flex items-center space-x-4">
            <Label htmlFor="document-search-mode" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Mode recherche documents
            </Label>
            <Switch id="document-search-mode" checked={documentSearchMode} onCheckedChange={(checked) => setDocumentSearchMode(checked)} />
            {user ? (
              <Avatar>
                <AvatarImage src={`https://avatar.vercel.sh/${user?.email}.png`} />
                <AvatarFallback>{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            ) : (
              <p>Non connecté</p>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 container mx-auto overflow-hidden">
        <ScrollArea className="h-full rounded-md border p-4" ref={chatContainerRef}>
          <div className="flex flex-col space-y-4">
            {chatHistory.map((message) => (
              <div key={message.id} className={`flex flex-col ${message.isUser ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-3/4 rounded-lg p-3 ${message.isUser ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                  <p className="text-sm whitespace-pre-line">{message.content}</p>
                  <div className="text-xs text-gray-500 mt-2">
                    {format(message.timestamp, "d MMM yyyy 'à' HH:mm", { locale: fr })}
                  </div>
                </div>

                {/* Sources d'information */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold">Sources :</p>
                    <ul className="list-disc pl-4">
                      {message.sources.map((source, index) => (
                        <li key={index} className="text-xs">
                          <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                            {source.title || source.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Documents utilisés */}
                {message.actuallyUsedDocuments && message.actuallyUsedDocuments.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold">Documents utilisés :</p>
                    <ul className="list-disc pl-4">
                      {message.actuallyUsedDocuments.map((docId, index) => (
                        <li key={index} className="text-xs">
                          Document ID: {docId}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Contexte des tâches */}
                {message.taskContext && message.taskContext.currentTasks && message.taskContext.currentTasks.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold">Tâches associées :</p>
                    <ul className="list-disc pl-4">
                      {message.taskContext.currentTasks.map((task: Task) => (
                        <li key={task.id} className="text-xs">
                          {task.description} (Status: {task.status}, Assigné à: {task.assigned_to})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Contexte de la base de données */}
                {message.databaseContext && (
                  <div className="mt-2">
                    {message.databaseContext.meetings && message.databaseContext.meetings.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold">Réunions associées :</p>
                        <ul className="list-disc pl-4">
                          {message.databaseContext.meetings.map((meeting: any) => (
                            <li key={meeting.id} className="text-xs">
                              {meeting.title} (Créée le: {format(new Date(meeting.created_at), "d MMM yyyy", { locale: fr })})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {message.databaseContext.documents && message.databaseContext.documents.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold">Documents associés :</p>
                        <ul className="list-disc pl-4">
                          {message.databaseContext.documents.map((document: any) => (
                            <li key={document.id} className="text-xs">
                              {document.ai_generated_name || document.original_name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <footer className="bg-white border-t p-4">
        <div className="container mx-auto flex items-center">
          <Input
            type="text"
            placeholder="Envoyer un message..."
            className="flex-1 rounded-l-md"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSendMessage();
              }
            }}
          />
          <Button
            onClick={handleSendMessage}
            className="rounded-r-md"
            disabled={isLoading}
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Envoyer
          </Button>
        </div>
      </footer>
      
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
