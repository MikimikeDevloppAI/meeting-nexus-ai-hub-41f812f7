import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, File, Paperclip, CheckCircle, AlertCircle, Plus, Calendar, Bot, User, Loader2, Database, FileText, Globe, ListTodo, Users, Trash2 } from "lucide-react";
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
import { useUnifiedChatHistory, ChatMessage } from "@/hooks/useUnifiedChatHistory";

interface Task {
  id: string;
  description: string;
  status: string;
  assigned_to: string;
  due_date: string | null;
}

const Assistant = () => {
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Utilisation du hook unifié pour l'historique
  const { messages, addMessage, clearHistory, getFormattedHistory } = useUnifiedChatHistory({
    storageKey: 'assistant-chat-history',
    initialMessage: "Bonjour ! Je suis l'assistant IA spécialisé du cabinet OphtaCare du Dr Tabibian à Genève.\n\nComment puis-je vous aider aujourd'hui ?",
    maxHistoryLength: 100,
    maxSentHistory: 20
  });
  
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
  }, [messages]);

  // Fonction pour générer du contenu enrichi pour les actions
  const generateEnrichedContent = async (userRequest: string, actionType: 'task' | 'meeting_point') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const prompt = actionType === 'task' 
        ? `Génère une description détaillée de tâche basée sur cette demande: "${userRequest}". 
           Contexte: Cabinet d'ophtalmologie Dr Tabibian à Genève avec équipe (Leïla, Émilie, Parmis).
           Format: Description claire et actionnable avec étapes concrètes si nécessaire.
           IMPORTANT: Réponds UNIQUEMENT avec la description de la tâche, sans aucun pattern d'action comme [ACTION_TACHE:...] ou autres balises.`
        : `Génère un point d'ordre du jour détaillé basé sur cette demande: "${userRequest}".
           Contexte: Cabinet d'ophtalmologie Dr Tabibian à Genève avec équipe (Leïla, Émilie, Parmis).
           Format: Utilise un markdown structuré avec :
           # Titre du point
           ## Description
           ## Objectifs
           ## Points à discuter
           - Point 1
           - Point 2
           etc.
           IMPORTANT: Réponds UNIQUEMENT avec le contenu markdown structuré, sans aucun pattern d'action comme [ACTION_REUNION:...] ou autres balises.`;

      const response = await fetch(
        "https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/ai-agent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk`,
          },
          body: JSON.stringify({
            message: prompt,
            context: { 
              userId: user?.id,
              contentGeneration: true,
              actionType: actionType
            },
            conversationHistory: []
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        let cleanedContent = data.response || userRequest;
        
        // Nettoyage exhaustif des patterns d'action
        cleanedContent = cleanedContent.replace(/\[ACTION_TACHE:[^\]]+\]/g, '');
        cleanedContent = cleanedContent.replace(/\[ACTION_REUNION:[^\]]+\]/g, '');
        cleanedContent = cleanedContent.replace(/\[ACTION:[^\]]+\]/g, '');
        cleanedContent = cleanedContent.trim();
        
        return cleanedContent;
      }
    } catch (error) {
      console.error('Erreur génération contenu:', error);
    }
    
    return userRequest; // Fallback
  };

  // Fonction pour détecter si l'utilisateur demande explicitement une action
  const isExplicitActionRequest = (userMessage: string): boolean => {
    const lowerMessage = userMessage.toLowerCase();
    
    // Mots-clés très explicites pour création de tâche
    const taskKeywords = [
      'créé une tâche',
      'créer une tâche',
      'nouvelle tâche',
      'ajouter une tâche',
      'faire une tâche',
      'crée une tâche'
    ];
    
    // Mots-clés très explicites pour ajout de point à la réunion
    const meetingKeywords = [
      'ajouter un point',
      'ajoute un point',
      'point à la réunion',
      'point à l\'ordre du jour',
      'ordre du jour',
      'prochaine réunion'
    ];
    
    const hasTaskKeyword = taskKeywords.some(keyword => lowerMessage.includes(keyword));
    const hasMeetingKeyword = meetingKeywords.some(keyword => lowerMessage.includes(keyword));
    
    return hasTaskKeyword || hasMeetingKeyword;
  };

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

    addMessage(newUserMessage);
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

      // Utiliser l'historique formaté
      const formattedHistory = getFormattedHistory();
      
      const response = await fetch(
        "https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/ai-agent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk`,
          },
          body: JSON.stringify({
            message: userMessage,
            context: agentContext,
            conversationHistory: formattedHistory
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('[ASSISTANT] Réponse complète de l\'agent:', data);
      
      // NOUVELLE LOGIQUE : Vérifier uniquement si l'utilisateur a fait une demande explicite
      const isExplicitRequest = isExplicitActionRequest(userMessage);
      
      if (isExplicitRequest) {
        console.log('[ASSISTANT] Demande explicite détectée, vérification des actions...');
        
        // Vérifier si une action doit être interceptée AVANT d'ajouter le message
        const responseText = data.response || '';
        
        // 1. Vérifier les patterns d'action dans la réponse
        const taskMatch = responseText.match(/\[ACTION_TACHE:([^\]]+)\]/);
        const meetingMatch = responseText.match(/\[ACTION_REUNION:([^\]]+)\]/);
        
        // 2. Vérifier aussi les résultats des agents
        const hasTaskAction = data.taskContext?.taskCreated;
        const hasMeetingAction = data.meetingPreparationResult?.actionPerformed || data.meetingPreparationResult?.action === 'add';
        
        console.log('[ASSISTANT] Détection d\'actions:', {
          taskMatch: !!taskMatch,
          meetingMatch: !!meetingMatch,
          hasTaskAction,
          hasMeetingAction,
          meetingResult: data.meetingPreparationResult
        });
        
        // 3. Gérer les actions détectées avec génération de contenu enrichi
        if (taskMatch || hasTaskAction) {
          console.log('[ASSISTANT] Action tâche détectée, génération de contenu...');
          
          const enrichedDescription = await generateEnrichedContent(userMessage, 'task');
          
          setPendingAction({
            type: 'create_task',
            description: enrichedDescription,
            details: data.taskContext
          });
          setIsValidationDialogOpen(true);
          setIsLoading(false);
          return; // Arrêter ici, ne pas ajouter le message
        }
        
        if (meetingMatch || hasMeetingAction) {
          console.log('[ASSISTANT] Action réunion détectée, génération de contenu...');
          
          const enrichedDescription = await generateEnrichedContent(userMessage, 'meeting_point');
          
          setPendingAction({
            type: 'add_meeting_point',
            description: enrichedDescription
          });
          setIsValidationDialogOpen(true);
          setIsLoading(false);
          return; // Arrêter ici, ne pas ajouter le message
        }
      } else {
        console.log('[ASSISTANT] Pas de demande explicite, traitement normal...');
      }

      // 4. Si aucune action détectée ou pas de demande explicite, ajouter le message normalement
      // Nettoyer la réponse des patterns d'action avant affichage
      let cleanedResponse = data.response;
      if (cleanedResponse) {
        cleanedResponse = cleanedResponse.replace(/\[ACTION_TACHE:[^\]]+\]/g, '');
        cleanedResponse = cleanedResponse.replace(/\[ACTION_REUNION:[^\]]+\]/g, '');
        cleanedResponse = cleanedResponse.replace(/\[ACTION:[^\]]+\]/g, '');
        cleanedResponse = cleanedResponse.trim();
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: cleanedResponse,
        isUser: false,
        timestamp: new Date(),
        taskContext: data.taskContext,
        databaseContext: data.databaseContext,
        hasRelevantContext: data.hasRelevantContext,
        actuallyUsedDocuments: data.actuallyUsedDocuments
      };

      addMessage(assistantMessage);
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
        // Créer la tâche en base de données
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
          description: "La tâche a été créée avec succès",
        });
      } else if (pendingAction.type === 'add_meeting_point') {
        // Ajouter le point à la préparation de réunion
        const { error } = await supabase
          .from('meeting_preparation_custom_points')
          .insert([{
            point_text: pendingAction.description,
            created_by: user?.id
          }]);

        if (error) throw error;

        toast({
          title: "Point ajouté",
          description: "Le point a été ajouté à l'ordre du jour",
        });
      }

      // Ajouter un message de succès au chat
      const successMessage: ChatMessage = {
        id: Date.now().toString(),
        content: `✅ Action confirmée : ${pendingAction.type === 'create_task' ? 'Tâche créée' : 'Point ajouté à l\'ordre du jour'}`,
        isUser: false,
        timestamp: new Date(),
      };

      addMessage(successMessage);

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
      content: `❌ Action rejetée : ${pendingAction.type === 'create_task' ? 'Création de tâche annulée' : 'Ajout de point annulé'}`,
      isUser: false,
      timestamp: new Date(),
    };

    addMessage(rejectMessage);
    
    toast({
      title: "Action rejetée",
      description: "L'action proposée par l'assistant a été rejetée",
    });
  };

  const handleClearHistory = () => {
    clearHistory();
    toast({
      title: "Historique effacé",
      description: "L'historique de la conversation a été supprimé",
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
          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Conversation avec l'assistant</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearHistory}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Effacer l'historique
            </Button>
          </div>
          <CardDescription>
            Posez vos questions et gérez vos tâches avec l'assistant IA.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-4">
          <ScrollArea className="flex-1 pr-4 mb-4" ref={chatContainerRef}>
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Bonjour ! Comment puis-je vous aider ?</p>
                  <p className="text-sm">
                    Je peux vous aider avec la gestion de vos tâches, documents, réunions et bien plus encore.
                  </p>
                </div>
              )}
              
              {messages.map((message) => (
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
