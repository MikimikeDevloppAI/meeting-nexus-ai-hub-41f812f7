import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AIActionValidationDialog } from "@/components/AIActionValidationDialog";
import { useUnifiedChatHistory, ChatMessage } from "@/hooks/useUnifiedChatHistory";
import AssistantHeader from "@/components/assistant/AssistantHeader";
import AssistantSettings from "@/components/assistant/AssistantSettings";
import AssistantChat from "@/components/assistant/AssistantChat";
import { PreAgent, PreAgentAnalysis } from "@/components/assistant/PreAgent";

const Assistant = () => {
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
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
    originalRequest?: string;
    details?: any;
  } | null>(null);
  const [isValidationDialogOpen, setIsValidationDialogOpen] = useState(false);

  // Fonction pour filtrer les sources par documents explicitement utilisés par l'IA (même logique que DocumentSearchAssistant)
  const filterByActuallyUsedDocuments = (sources: any[], actuallyUsedDocuments: string[]) => {
    if (!sources || sources.length === 0 || !actuallyUsedDocuments || actuallyUsedDocuments.length === 0) {
      console.log('[ASSISTANT] ⚠️ Pas de documents explicitement utilisés ou pas de sources');
      return [];
    }

    console.log('[ASSISTANT] 🎯 Documents explicitement utilisés par l\'IA:', actuallyUsedDocuments);
    console.log('[ASSISTANT] 📄 Sources disponibles:', sources.length);

    // Filtrer les sources pour ne garder que celles explicitement utilisées
    const filteredSources = sources.filter(source => 
      actuallyUsedDocuments.includes(source.documentId || source.document_id)
    );

    console.log('[ASSISTANT] ✅ Sources filtrées par utilisation réelle:', filteredSources.length);

    return filteredSources;
  };

  // Fonction pour générer du contenu simplifié pour les actions via l'agent principal
  const generateSimplifiedContent = async (userRequest: string, actionType: 'task' | 'meeting_point') => {
    console.log('[ASSISTANT] 🎯 Génération contenu pour:', actionType, 'demande:', userRequest);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const prompt = actionType === 'task' 
        ? `Reformule cette demande en une description de tâche claire et professionnelle pour un cabinet médical : "${userRequest}"`
        : `Reformule ce point en un point d'ordre du jour clair pour une réunion médicale : "${userRequest}"`;

      console.log('[ASSISTANT] 📝 Utilisation de l\'agent principal pour reformulation');

      // Utiliser l'agent principal comme pour les autres requêtes
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
              databaseSearch: false,
              documentSearch: false,
              internetSearch: false,
              todoManagement: false,
              meetingPoints: false,
              reformulationMode: true // Mode spécial pour reformulation
            },
            conversationHistory: []
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        let reformulatedContent = data.response || userRequest;
        
        console.log('[ASSISTANT] 📨 Réponse agent principal reçue:', reformulatedContent);
        
        // NETTOYAGE COMPLET des balises d'action et formatage indésirable
        reformulatedContent = reformulatedContent.replace(/\[ACTION_TACHE:[^\]]*\]/g, '');
        reformulatedContent = reformulatedContent.replace(/\[ACTION_TASK:[^\]]*\]/g, '');
        reformulatedContent = reformulatedContent.replace(/\[ACTION_REUNION:[^\]]*\]/g, '');
        reformulatedContent = reformulatedContent.replace(/\[ACTION_MEETING:[^\]]*\]/g, '');
        reformulatedContent = reformulatedContent.replace(/\[ACTION:[^\]]*\]/g, '');
        
        // Nettoyage pour s'assurer qu'on n'a que le contenu reformulé
        reformulatedContent = reformulatedContent.replace(/^(voici|voilà|description|tâche|point|agenda|reformulé|reformulée)[\s:.-]+/i, '');
        reformulatedContent = reformulatedContent.replace(/^["'`]+|["'`]+$/g, '');
        reformulatedContent = reformulatedContent.trim();
        
        // Si après nettoyage il ne reste rien, extraire le contenu des balises
        if (!reformulatedContent) {
          const match = data.response.match(/\[ACTION_[^:]+:([^\]]+)\]/);
          if (match) {
            reformulatedContent = match[1].trim();
          }
        }
        
        console.log('[ASSISTANT] ✅ Contenu reformulé final:', reformulatedContent);
        
        return reformulatedContent || userRequest;
      } else {
        const errorText = await response.text();
        console.error('[ASSISTANT] ❌ Erreur agent principal:', errorText);
        return userRequest;
      }
    } catch (error) {
      console.error('[ASSISTANT] ❌ Erreur génération contenu:', error);
      return userRequest; // Fallback vers la demande originale
    }
  };

  // Fonction ULTRA-INTELLIGENTE pour détecter les demandes d'actions
  const isExplicitActionRequest = (userMessage: string): boolean => {
    const lowerMessage = userMessage.toLowerCase();
    
    // Normalisation pour éliminer la ponctuation et les accents
    const normalizeText = (text: string) => {
      return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
        .replace(/[^a-z0-9\s]/g, ' ') // Remplace la ponctuation par des espaces
        .replace(/\s+/g, ' ') // Remplace les espaces multiples par un seul
        .trim();
    };
    
    const normalizedMessage = normalizeText(lowerMessage);
    
    console.log('[ASSISTANT] 🔍 Message normalisé:', normalizedMessage);
    
    // =================== PATTERNS TÂCHES ===================
    const taskPatterns = [
      // Demandes directes avec verbes d'action
      /(?:peux tu|pourrais tu|pourrait tu|tu peux|peut tu|peus tu|peut on|peux on|pourrais on|pourrait on)\s+(?:cree|creer|faire|ajouter|crée|créer|mettre|donner|assigner|demander|dire)/,
      
      // Formulations avec "demander à" + prénom
      /(?:demander|dire|confier|assigner|donner|prevenir|rappeler|informer)\s+(?:a|à)\s+(?:emilie|david|leila|hortensia)/,
      
      // Actions vers des personnes spécifiques
      /(?:emilie|david|leila|hortensia)\s+(?:doit|devrait|peut|pourrait|va|dois)\s+(?:faire|acheter|organiser|preparer|mettre|donner|creer|créer)/,
      
      // Demandes d'achat/action spécifiques
      /(?:acheter|achat|commander|commande|organiser|preparer|faire|creer|créer)\s+(?:du|de la|des|le|la|les|un|une)/,
      
      // Patterns généraux d'action
      /(?:nouvelle|nouveau|une)\s+(?:tache|task|travail|mission|action|activite|todo)/,
      /(?:formation|reunion|meeting|rendez vous|rdv).*(?:personnel|equipe|tout le monde|tous)/,
      
      // Patterns avec infinitifs
      /(?:faire|organiser|planifier|preparer|mettre en place|acheter|commander|creer|créer|ajouter)/,
      
      // Patterns très flexibles pour toute action
      /(?:il faut|faut|devrait|doit|peut|pourrait).*(?:faire|acheter|organiser|preparer|creer|créer|preparer|mettre|demander|dire|confier|assigner)/
    ];
    
    // =================== PATTERNS RÉUNIONS ===================
    const meetingPatterns = [
      /(?:peux tu|pourrais tu|tu peux|peut tu|peus tu)\s+(?:ajouter|mettre|noter|inscrire).*(?:point|sujet|ordre|agenda|reunion)/,
      /(?:ajouter|mettre|noter|inscrire|rajouter).*(?:point|sujet|ordre|agenda|reunion)/,
      /(?:point|sujet|ordre|agenda).*(?:reunion|prochaine|suivante)/,
      /ordre\s+du\s+jour/,
      /prochaine\s+reunion/,
    ];
    
    // Test des patterns pour tâches
    const hasTaskPattern = taskPatterns.some(pattern => {
      const match = pattern.test(normalizedMessage);
      if (match) {
        console.log('[ASSISTANT] ✅ Pattern tâche trouvé:', pattern.source);
      }
      return match;
    });
    
    // Test des patterns pour réunions
    const hasMeetingPattern = meetingPatterns.some(pattern => {
      const match = pattern.test(normalizedMessage);
      if (match) {
        console.log('[ASSISTANT] ✅ Pattern réunion trouvé:', pattern.source);
      }
      return match;
    });
    
    // =================== ANALYSE CONTEXTUELLE ===================
    
    // Mots-clés pour les tâches (plus large)
    const taskKeywords = /(?:tache|task|travail|mission|action|activite|todo|formation|organiser|planifier|acheter|achat|commander|commande|faire|creer|créer|preparer|mettre)/;
    
    // Mots-clés pour les réunions
    const meetingKeywords = /(?:reunion|point|ordre|agenda|meeting)/;
    
    // Verbes d'action généraux
    const actionVerbs = /(?:peux|peut|pourrais|pourrait|demander|dire|confier|assigner|donner|prevenir|rappeler|informer|doit|devrait|va|dois|acheter|organiser|faire|creer|créer|ajouter|mettre|noter|inscrire)/;
    
    // Noms de personnes du cabinet
    const personNames = /(?:emilie|david|leila|hortensia|personnel|equipe)/;
    
    // Indicateurs d'urgence ou d'importance
    const urgencyIndicators = /(?:urgent|important|rapidement|vite|asap|bientot|maintenant|aujourd hui|demain)/;
    
    // =================== LOGIQUE DE DÉTECTION INTELLIGENTE ===================
    
    const hasTaskKeywords = taskKeywords.test(normalizedMessage);
    const hasMeetingKeywords = meetingKeywords.test(normalizedMessage);
    const hasActionVerbs = actionVerbs.test(normalizedMessage);
    const hasPersonNames = personNames.test(normalizedMessage);
    const hasUrgencyIndicators = urgencyIndicators.test(normalizedMessage);
    
    // Logique de décision intelligente
    let isTaskRequest = hasTaskPattern;
    let isMeetingRequest = hasMeetingPattern;
    
    // Si pas de pattern direct mais combinaison d'indicateurs
    if (!isTaskRequest && !isMeetingRequest) {
      // Forte probabilité de tâche si action + personne + verbe
      if (hasActionVerbs && hasPersonNames && (hasTaskKeywords || hasUrgencyIndicators)) {
        isTaskRequest = true;
        console.log('[ASSISTANT] 🧠 Tâche détectée par analyse contextuelle (action + personne + contexte)');
      }
      
      // Forte probabilité de tâche si verbe d'action seul avec contexte clair
      if (hasActionVerbs && hasTaskKeywords && !hasMeetingKeywords) {
        isTaskRequest = true;
        console.log('[ASSISTANT] 🧠 Tâche détectée par analyse contextuelle (action + contexte tâche)');
      }
      
      // Forte probabilité de réunion si contexte réunion
      if (hasActionVerbs && hasMeetingKeywords && !hasTaskKeywords) {
        isMeetingRequest = true;
        console.log('[ASSISTANT] 🧠 Réunion détectée par analyse contextuelle (action + contexte réunion)');
      }
    }
    
    console.log('[ASSISTANT] 🧠 Analyse intelligente complète:', {
      normalizedMessage,
      hasTaskPattern,
      hasMeetingPattern,
      hasTaskKeywords,
      hasMeetingKeywords,
      hasActionVerbs,
      hasPersonNames,
      hasUrgencyIndicators,
      isTaskRequest,
      isMeetingRequest
    });
    
    return isTaskRequest || isMeetingRequest;
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
      // =================== ÉTAPE 1: PRÉ-AGENT ===================
      console.log('[ASSISTANT] 🚀 Étape 1 - Analyse pré-agent');
      const preAnalysis: PreAgentAnalysis = PreAgent.analyzeRequest(userMessage);
      
      console.log('[ASSISTANT] 📊 Résultat pré-agent:', preAnalysis);
      
      // =================== GESTION DIRECTE DES ACTIONS ===================
      if (preAnalysis.type === 'task_creation' && preAnalysis.confidence > 0.8) {
        console.log('[ASSISTANT] ⚡ CRÉATION TÂCHE - Traitement immédiat');
        
        const simplifiedDescription = await generateSimplifiedContent(userMessage, 'task');
        console.log('[ASSISTANT] 🎯 Description simplifiée générée:', simplifiedDescription);
        
        setPendingAction({
          type: 'create_task',
          description: simplifiedDescription,
          originalRequest: userMessage,
          details: { preAgentAnalysis: preAnalysis }
        });
        setIsValidationDialogOpen(true);
        setIsLoading(false);
        
        const confirmationMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          content: "🎯 **Création de tâche détectée**\n\nJe vais créer une tâche. Veuillez confirmer dans la fenêtre qui s'ouvre.",
          isUser: false,
          timestamp: new Date(),
        };
        addMessage(confirmationMessage);
        
        return;
      }
      
      if (preAnalysis.type === 'meeting_point' && preAnalysis.confidence > 0.8) {
        console.log('[ASSISTANT] ⚡ POINT RÉUNION - Traitement immédiat');
        
        const simplifiedDescription = await generateSimplifiedContent(userMessage, 'meeting_point');
        console.log('[ASSISTANT] 🎯 Description simplifiée générée:', simplifiedDescription);
        
        setPendingAction({
          type: 'add_meeting_point',
          description: simplifiedDescription,
          originalRequest: userMessage,
          details: { preAgentAnalysis: preAnalysis }
        });
        setIsValidationDialogOpen(true);
        setIsLoading(false);
        
        const confirmationMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          content: "📅 **Point de réunion détecté**\n\nJe vais ajouter un point à l'ordre du jour. Veuillez confirmer dans la fenêtre qui s'ouvre.",
          isUser: false,
          timestamp: new Date(),
        };
        addMessage(confirmationMessage);
        
        return;
      }
      
      // =================== ÉTAPE 2: ASSISTANT NORMAL ===================
      console.log('[ASSISTANT] 💬 Étape 2 - Assistant normal pour requête:', preAnalysis.type);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      const agentContext = {
        userId: user?.id,
        databaseSearch: databaseSearchEnabled,
        documentSearch: documentSearchEnabled,
        internetSearch: internetSearchEnabled,
        todoManagement: todoEnabled,
        meetingPoints: meetingPointsEnabled,
        documentSearchMode: documentSearchEnabled,
        preAgentAnalysis: preAnalysis // Inclure l'analyse du pré-agent
      };

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
      
      console.log('[ASSISTANT] 📨 Réponse complète de l\'agent:', data);

      let cleanedResponse = data.response;
      if (cleanedResponse) {
        cleanedResponse = cleanedResponse.replace(/\[ACTION_TACHE:[^\]]+\]/g, '');
        cleanedResponse = cleanedResponse.replace(/\[ACTION_TASK:[^\]]+\]/g, '');
        cleanedResponse = cleanedResponse.replace(/\[ACTION_REUNION:[^\]]+\]/g, '');
        cleanedResponse = cleanedResponse.replace(/\[ACTION_MEETING:[^\]]+\]/g, '');
        cleanedResponse = cleanedResponse.replace(/\[ACTION:[^\]]+\]/g, '');
        cleanedResponse = cleanedResponse.trim();
      }

      let transformedSources = [];
      
      if (data.actuallyUsedDocuments && data.actuallyUsedDocuments.length > 0 && data.sources) {
        const rawSources = data.sources.map((source: any) => ({
          documentId: source.document_id,
          documentName: source.document_name || 'Document inconnu',
          maxSimilarity: source.similarity || 0,
          chunksCount: 1,
          documentType: source.document_type || 'document',
          relevantChunks: source.chunk_text ? [source.chunk_text] : []
        }));
        
        transformedSources = filterByActuallyUsedDocuments(rawSources, data.actuallyUsedDocuments);
        
        console.log('[ASSISTANT] Sources filtrées:', transformedSources.length, 'documents réellement utilisés');
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: cleanedResponse,
        isUser: false,
        timestamp: new Date(),
        databaseContext: data.databaseContext,
        hasRelevantContext: data.hasRelevantContext,
        actuallyUsedDocuments: data.actuallyUsedDocuments,
        sources: transformedSources
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

  const handleActionConfirm = async (selectedParticipants?: string[], modifiedDescription?: string) => {
    if (!pendingAction) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const finalDescription = modifiedDescription || pendingAction.description;
      
      if (pendingAction.type === 'create_task') {
        const { data: newTodo, error } = await supabase
          .from('todos')
          .insert([{
            description: finalDescription,
            status: 'confirmed',
            created_at: new Date().toISOString(),
          }])
          .select()
          .single();

        if (error) throw error;

        if (selectedParticipants && selectedParticipants.length > 0 && newTodo) {
          const participantInserts = selectedParticipants.map(participantId => ({
            todo_id: newTodo.id,
            participant_id: participantId
          }));

          const { error: participantError } = await supabase
            .from('todo_participants')
            .insert(participantInserts);

          if (participantError) {
            console.error('Erreur assignation participants:', participantError);
          }

          if (selectedParticipants.length > 0) {
            await supabase
              .from('todos')
              .update({ assigned_to: selectedParticipants[0] })
              .eq('id', newTodo.id);
          }
        }

        toast({
          title: "Tâche créée",
          description: `Tâche créée avec succès${selectedParticipants && selectedParticipants.length > 0 ? ` et assignée à ${selectedParticipants.length} participant(s)` : ''}`,
        });
      } else if (pendingAction.type === 'add_meeting_point') {
        const { error } = await supabase
          .from('meeting_preparation_custom_points')
          .insert([{
            point_text: finalDescription,
            created_by: user?.id
          }]);

        if (error) throw error;

        toast({
          title: "Point ajouté",
          description: "Le point a été ajouté à l'ordre du jour",
        });
      }

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
      <AssistantHeader />

      <AssistantSettings
        databaseSearchEnabled={databaseSearchEnabled}
        setDatabaseSearchEnabled={setDatabaseSearchEnabled}
        documentSearchEnabled={documentSearchEnabled}
        setDocumentSearchEnabled={setDocumentSearchEnabled}
        internetSearchEnabled={internetSearchEnabled}
        setInternetSearchEnabled={setInternetSearchEnabled}
        todoEnabled={todoEnabled}
        setTodoEnabled={setTodoEnabled}
        meetingPointsEnabled={meetingPointsEnabled}
        setMeetingPointsEnabled={setMeetingPointsEnabled}
      />

      <AssistantChat
        messages={messages}
        isLoading={isLoading}
        inputMessage={inputMessage}
        setInputMessage={setInputMessage}
        onSendMessage={handleSendMessage}
        onClearHistory={handleClearHistory}
        onKeyPress={handleKeyPress}
      />
      
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
