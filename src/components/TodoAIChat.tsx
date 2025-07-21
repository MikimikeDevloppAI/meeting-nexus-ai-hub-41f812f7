
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Bot, User, Loader2, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { renderMessageWithLinks, sanitizeHtml } from "@/utils/linkRenderer";
import { useUnifiedChatHistory } from "@/hooks/useUnifiedChatHistory";

interface TodoAIChatProps {
  todoId: string;
  todoDescription: string;
}

export const TodoAIChat = ({ todoId, todoDescription }: TodoAIChatProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const { 
    messages, 
    addMessage, 
    clearHistory, 
    getFormattedHistory 
  } = useUnifiedChatHistory({
    storageKey: `todo-chat-${todoId}`,
    initialMessage: `Je suis votre assistant IA spécialisé OphtaCare pour vous aider avec cette tâche : "${todoDescription}". 

`,
    maxHistoryLength: 50,
    maxSentHistory: 20
  });

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      content: inputMessage,
      isUser: true,
      timestamp: new Date(),
    };

    addMessage(userMessage);
    const currentMessage = inputMessage;
    setInputMessage("");
    setIsLoading(true);

    try {
      console.log('[TODO_AI_CHAT] 📤 Envoi avec historique:', getFormattedHistory().length, 'messages');

      // Récupérer les subtasks
      const { data: subtasks } = await supabase
        .from('todo_subtasks')
        .select('*')
        .eq('todo_id', todoId)
        .order('created_at', { ascending: true });

      // Récupérer les pièces jointes avec texte extrait
      const { data: attachments, error: attachmentsError } = await supabase
        .from('todo_attachments')
        .select('*')
        .eq('todo_id', todoId)
        .order('created_at', { ascending: false });

      console.log('[TODO_AI_CHAT] 📎 Attachments récupérés:', attachments);
      if (attachmentsError) {
        console.error('[TODO_AI_CHAT] ❌ Erreur attachments:', attachmentsError);
      }

      // Construire le contexte des subtasks
      let subtasksContext = '';
      if (subtasks && subtasks.length > 0) {
        subtasksContext = '\n\nSOUS-TÂCHES ASSOCIÉES :\n';
        subtasks.forEach((subtask, index) => {
          const status = subtask.completed ? '✅ Terminée' : '⏳ En cours';
          subtasksContext += `${index + 1}. ${subtask.description} (${status})\n`;
        });
      }

      // Construire le contexte des fichiers joints
      let attachmentsContext = '';
      if (attachments && attachments.length > 0) {
        console.log('[TODO_AI_CHAT] 📎 Traitement de', attachments.length, 'attachments');
        attachments.forEach((attachment) => {
          console.log('[TODO_AI_CHAT] 📄 Attachment:', attachment.file_name, 'extractedText length:', attachment.extracted_text?.length || 0);
          if (attachment.extracted_text && attachment.extracted_text.trim()) {
            attachmentsContext += `\n\nFICHIER JOINT À LA TÂCHE - ${attachment.file_name} :\n`;
            attachmentsContext += `Voici son contenu :\n${attachment.extracted_text}\n`;
          }
        });
      }
      
      console.log('[TODO_AI_CHAT] 🔤 Contexte attachments final length:', attachmentsContext.length);
      console.log('[TODO_AI_CHAT] 🔤 Contexte attachments:', attachmentsContext.substring(0, 200) + '...');

      // Message contextualisé pour assistance tâche OphtaCare
      const contextualizedMessage = `ASSISTANCE SPÉCIALISÉE TÂCHE OPHTACARE

CONTEXTE TÂCHE SPÉCIFIQUE :
- ID tâche : ${todoId}
- Description : "${todoDescription}"
- Cabinet : OphtaCare (Dr Tabibian, Genève)
- Type : Assistance administrative pour accomplissement${subtasksContext}${attachmentsContext}

DEMANDE UTILISATEUR :
${currentMessage}

INSTRUCTIONS ASSISTANT :
Tu es l'assistant IA spécialisé pour le cabinet ophtalmologique de geneve OphtaCare pour aider à accomplir cette tâche spécifique.
Concentre-toi sur l'aide pratique en utilisant toutes les données internes disponibles.
Si des fichiers sont joints, utilise leur contenu pour enrichir tes réponses.
Si des sous-tâches existent, prends-les en compte dans tes conseils.
Fournis des conseils concrets, des étapes détaillées et des suggestions contextuelles.
Reste dans le contexte du cabinet d'ophtalmologie OphtaCare.
Ne propose PAS de créer de nouvelles tâches, aide seulement à accomplir celle-ci.`;

      const { data, error } = await supabase.functions.invoke('ai-agent', {
        body: { 
          message: contextualizedMessage,
          todoId: todoId,
          conversationHistory: getFormattedHistory(),
          taskContext: {
            todoId,
            description: todoDescription,
            type: 'task_assistance',
            cabinet: 'OphtaCare',
            subtasks: subtasks || [],
            attachments: attachments || []
          }
        }
      });

      if (error) throw error;

      // Nettoyage de la réponse (supprimer syntaxes techniques)
      let cleanContent = data.response || "Désolé, je n'ai pas pu traiter votre demande.";
      
      // Suppression des syntaxes techniques et contextes non nécessaires
      cleanContent = cleanContent
        .replace(/\[ACTION_TACHE:[^\]]*\]/gs, '')
        .replace(/\s*CONTEXT_PARTICIPANTS:.*$/gi, '')
        .replace(/\s*CONTEXT_UTILISATEURS:.*$/gi, '')
        .replace(/\s*CONTEXTE TÂCHE SPÉCIFIQUE:.*$/gi, '')
        .trim();

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        content: cleanContent,
        isUser: false,
        timestamp: new Date(),
        sources: data.sources || []
      };

      addMessage(aiMessage);

      // Toast informatif pour données utilisées
      if (data.searchMetrics?.totalDataPoints > 0) {
        toast({
          title: "Réponse enrichie",
          description: `${data.searchMetrics.totalDataPoints} sources OphtaCare utilisées`,
          variant: "default",
        });
      }

    } catch (error: any) {
      console.error('[TODO_AI_CHAT] ❌ Erreur:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le message. Réessayez.",
        variant: "destructive",
      });

      const errorMessage = {
        id: (Date.now() + 1).toString(),
        content: "Désolé, je rencontre un problème technique temporaire. Pouvez-vous réessayer ? L'assistant OphtaCare reste disponible pour vous aider.",
        isUser: false,
        timestamp: new Date(),
      };

      addMessage(errorMessage);
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
        className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-green-50 hover:from-blue-100 hover:to-green-100 border-blue-200"
      >
        <Bot className="h-4 w-4 text-blue-600" />
        <span className="text-blue-700 font-medium">Assistant IA OphtaCare</span>
      </Button>
    );
  }

  return (
    <Card className="mt-3 border-blue-200 shadow-lg">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700">Assistant IA OphtaCare</span>
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
              Aide Tâche
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              className="h-6 w-6 p-0 hover:bg-orange-50"
              title="Effacer l'historique"
            >
              <Trash2 className="h-3 w-3 text-gray-500 hover:text-orange-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6 p-0 hover:bg-red-50"
            >
              <X className="h-3 w-3 text-gray-500 hover:text-red-600" />
            </Button>
          </div>
        </div>

        <div className="space-y-3 max-h-80 overflow-y-auto mb-3 pr-1">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2 ${message.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-2 max-w-[90%] ${message.isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.isUser 
                    ? 'bg-blue-500 shadow-md' 
                    : 'bg-gradient-to-br from-blue-100 to-green-100 border border-blue-200'
                }`}>
                  {message.isUser ? (
                    <User className="h-3 w-3 text-white" />
                  ) : (
                    <Bot className="h-3 w-3 text-blue-600" />
                  )}
                </div>
                
                <div className={`rounded-lg p-3 text-sm shadow-sm ${
                  message.isUser 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gradient-to-br from-gray-50 to-blue-50 border border-gray-200'
                }`}>
                  <div 
                    className="leading-relaxed"
                    dangerouslySetInnerHTML={{ 
                      __html: sanitizeHtml(renderMessageWithLinks(message.content))
                    }}
                  />
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 text-xs text-blue-600">
                      📄 {message.sources.length} source(s) utilisée(s)
                    </div>
                  )}
                  <div className={`text-xs mt-2 ${
                    message.isUser ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-2 justify-start">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-100 to-green-100 border border-blue-200 flex items-center justify-center flex-shrink-0">
                <Bot className="h-3 w-3 text-blue-600" />
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-blue-50 border border-gray-200 rounded-lg p-3 flex items-center gap-2 shadow-sm">
                <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                <span className="text-sm text-blue-700">Analyse OphtaCare optimisée...</span>
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
            className="text-sm h-9 border-blue-200 focus:border-blue-400 focus:ring-blue-200"
          />
          <Button 
            onClick={sendMessage} 
            disabled={isLoading || !inputMessage.trim()}
            size="sm"
            className="h-9 px-3 bg-blue-500 hover:bg-blue-600 text-white shadow-md"
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="text-xs text-gray-500 mt-2 text-center">
          Assistant spécialisé cabinet OphtaCare • {messages.length} message(s) en mémoire
        </div>
      </CardContent>
    </Card>
  );
};
