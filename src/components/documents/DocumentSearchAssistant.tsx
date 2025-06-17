import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Send, Bot, User, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { renderMessageWithLinks, sanitizeHtml } from "@/utils/linkRenderer";
import { useUnifiedChatHistory } from "@/hooks/useUnifiedChatHistory";
import { SmartDocumentSources } from "./SmartDocumentSources";

// Interface pour les sources brutes de l'Edge Function
interface RawSource {
  document_id: string;
  document_name?: string;
  similarity?: number;
  document_type?: string;
  chunk_text?: string;
}

// Interface pour les sources transformées
interface TransformedSource {
  documentId: string;
  documentName: string;
  maxSimilarity: number;
  chunksCount: number;
  documentType: string;
  relevantChunks: string[];
}

export const DocumentSearchAssistant = () => {
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

  // Fonction pour transformer les sources de l'Edge Function au format attendu par SmartDocumentSources
  const transformSourcesForDisplay = (sources: RawSource[]): TransformedSource[] => {
    if (!sources || sources.length === 0) return [];

    // Grouper les chunks par document
    const groupedByDocument = sources.reduce((acc: Record<string, TransformedSource>, source: RawSource) => {
      const docId = source.document_id;
      if (!acc[docId]) {
        acc[docId] = {
          documentId: docId,
          documentName: source.document_name || 'Document inconnu',
          maxSimilarity: source.similarity || 0,
          chunksCount: 0,
          documentType: source.document_type || 'document',
          relevantChunks: []
        };
      }
      
      // Prendre la similarité maximale pour ce document
      if (source.similarity && source.similarity > acc[docId].maxSimilarity) {
        acc[docId].maxSimilarity = source.similarity;
      }
      
      acc[docId].chunksCount += 1;
      if (source.chunk_text) {
        acc[docId].relevantChunks.push(source.chunk_text);
      }
      
      return acc;
    }, {});

    // Convertir en tableau et filtrer par similarité > 35%
    return Object.values(groupedByDocument).filter((doc: TransformedSource) => 
      doc.maxSimilarity > 0.35
    );
  };

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

      // Transformer les sources au format attendu par SmartDocumentSources
      const transformedSources = transformSourcesForDisplay(data.sources || []);

      console.log('[DOCUMENT_SEARCH] 📊 Sources originales:', data.sources?.length || 0);
      console.log('[DOCUMENT_SEARCH] 📋 Sources transformées:', transformedSources.length);

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        content: cleanContent,
        isUser: false,
        timestamp: new Date(),
        sources: transformedSources
      };

      addMessage(aiMessage);

      // Toast informatif pour données utilisées
      if (data.searchMetrics?.totalDataPoints > 0) {
        toast({
          title: "Recherche effectuée",
          description: `${data.searchMetrics.totalDataPoints} sources trouvées dans vos documents`,
          variant: "default",
        });
      } else if (transformedSources.length > 0) {
        toast({
          title: "Documents trouvés",
          description: `${transformedSources.length} document(s) pertinent(s)`,
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

  return (
    <Card className="mt-4 mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <CardTitle className="text-lg">Assistant Recherche Documentaire</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              title="Effacer l'historique"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Recherchez dans vos documents et meetings avec contexte maintenu • {messages.length} message(s) en mémoire
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="max-h-96 overflow-y-auto space-y-4">
          {messages.map((message) => (
            <div key={message.id} className="space-y-2">
              <div className={`flex gap-3 ${message.isUser ? 'justify-end' : 'justify-start'}`}>
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
                        __html: sanitizeHtml(renderMessageWithLinks(message.content))
                      }}
                    />
                    {message.sources && message.sources.length > 0 && (
                      <div className="text-xs opacity-70 mt-2">
                        📄 {message.sources.length} source(s) utilisée(s)
                      </div>
                    )}
                    <div className="text-xs opacity-70 mt-2">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Affichage des documents sources pour les réponses de l'IA avec le même visuel que Documents et Meetings */}
              {!message.isUser && message.sources && message.sources.length > 0 && (
                <div className="ml-11">
                  <SmartDocumentSources 
                    sources={message.sources} 
                    title="Documents utilisés"
                  />
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Recherche dans vos documents...</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Recherchez dans vos documents..."
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

        <div className="text-xs text-muted-foreground text-center">
          💡 Contexte maintenu - Posez des questions sur vos documents ou meetings
        </div>
      </CardContent>
    </Card>
  );
};
