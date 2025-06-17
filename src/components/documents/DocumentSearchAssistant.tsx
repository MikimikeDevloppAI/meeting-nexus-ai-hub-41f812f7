
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Bot, User, Loader2, X, Search, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { renderMessageWithLinks, sanitizeHtml } from "@/utils/linkRenderer";
import { useUnifiedChatHistory } from "@/hooks/useUnifiedChatHistory";

export const DocumentSearchAssistant = () => {
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
    storageKey: 'document-search-assistant-history',
    initialMessage: "Bonjour ! Je suis l'assistant de recherche documentaire OphtaCare. Je peux vous aider à trouver des informations dans vos documents et meetings.\n\n**Je peux vous assister pour :**\n• Rechercher des informations dans vos documents uploadés\n• Analyser le contenu de vos meetings et transcripts\n• Retrouver des données spécifiques selon vos critères\n• Répondre à des questions sur le contenu de votre base documentaire\n\nQue recherchez-vous dans vos documents ?",
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
      console.log('[DOCUMENT_SEARCH] 📤 Envoi avec historique:', getFormattedHistory().length, 'messages');

      const { data, error } = await supabase.functions.invoke('ai-agent', {
        body: { 
          message: currentMessage,
          conversationHistory: getFormattedHistory(),
          context: {
            documentSearchMode: true,
            forceEmbeddingsPriority: true,
            vectorSearchOnly: false // Permet la recherche hybride
          }
        }
      });

      if (error) throw error;

      let cleanContent = data.response || "Désolé, je n'ai pas pu traiter votre demande.";
      
      // Suppression des syntaxes techniques
      cleanContent = cleanContent
        .replace(/\[ACTION_TACHE:[^\]]*\]/gs, '')
        .replace(/\s*CONTEXT_PARTICIPANTS:.*$/gi, '')
        .replace(/\s*CONTEXT_UTILISATEURS:.*$/gi, '')
        .replace(/\s*CONTEXTE.*?:/gi, '')
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
          title: "Recherche effectuée",
          description: `${data.searchMetrics.totalDataPoints} sources trouvées dans vos documents`,
          variant: "default",
        });
      } else if (data.sources && data.sources.length > 0) {
        toast({
          title: "Documents trouvés",
          description: `${data.sources.length} document(s) pertinent(s)`,
          variant: "default",
        });
      }

    } catch (error: any) {
      console.error('[DOCUMENT_SEARCH] ❌ Erreur:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'effectuer la recherche. Réessayez.",
        variant: "destructive",
      });

      const errorMessage = {
        id: (Date.now() + 1).toString(),
        content: "Désolé, je rencontre un problème technique temporaire. Pouvez-vous réessayer ? L'assistant de recherche documentaire reste disponible.",
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
        className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 border-purple-200"
      >
        <Search className="h-4 w-4 text-purple-600" />
        <span className="text-purple-700 font-medium">Assistant Recherche</span>
      </Button>
    );
  }

  return (
    <Card className="mt-3 border-purple-200 shadow-lg">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-semibold text-purple-700">Assistant Recherche Documentaire</span>
            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
              Contexte Maintenu
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
              <FileText className="h-3 w-3 text-gray-500 hover:text-orange-600" />
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
                    ? 'bg-purple-500 shadow-md' 
                    : 'bg-gradient-to-br from-purple-100 to-blue-100 border border-purple-200'
                }`}>
                  {message.isUser ? (
                    <User className="h-3 w-3 text-white" />
                  ) : (
                    <Search className="h-3 w-3 text-purple-600" />
                  )}
                </div>
                
                <div className={`rounded-lg p-3 text-sm shadow-sm ${
                  message.isUser 
                    ? 'bg-purple-500 text-white' 
                    : 'bg-gradient-to-br from-gray-50 to-purple-50 border border-gray-200'
                }`}>
                  <div 
                    className="leading-relaxed"
                    dangerouslySetInnerHTML={{ 
                      __html: sanitizeHtml(renderMessageWithLinks(message.content))
                    }}
                  />
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 text-xs text-purple-600">
                      📄 {message.sources.length} source(s) utilisée(s)
                    </div>
                  )}
                  <div className={`text-xs mt-2 ${
                    message.isUser ? 'text-purple-100' : 'text-gray-500'
                  }`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-2 justify-start">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 border border-purple-200 flex items-center justify-center flex-shrink-0">
                <Search className="h-3 w-3 text-purple-600" />
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-purple-50 border border-gray-200 rounded-lg p-3 flex items-center gap-2 shadow-sm">
                <Loader2 className="h-3 w-3 animate-spin text-purple-600" />
                <span className="text-sm text-purple-700">Recherche dans vos documents...</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Recherchez dans vos documents..."
            disabled={isLoading}
            className="text-sm h-9 border-purple-200 focus:border-purple-400 focus:ring-purple-200"
          />
          <Button 
            onClick={sendMessage} 
            disabled={isLoading || !inputMessage.trim()}
            size="sm"
            className="h-9 px-3 bg-purple-500 hover:bg-purple-600 text-white shadow-md"
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="text-xs text-gray-500 mt-2 text-center">
          Assistant spécialisé recherche documentaire • {messages.length} message(s) en mémoire
        </div>
      </CardContent>
    </Card>
  );
};
