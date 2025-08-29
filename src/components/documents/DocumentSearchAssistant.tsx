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
  const [debugMode, setDebugMode] = useState(false);
  const { toast } = useToast();

  const { 
    messages, 
    addMessage, 
    clearHistory, 
    getFormattedHistory 
  } = useUnifiedChatHistory({
    storageKey: 'document-search-assistant-history',
    initialMessage: "Bonjour ! Je suis l'assistant de recherche documentaire. Je peux maintenant faire des liens contextuels intelligents et trouver des informations connexes dans vos documents (ex: yeux/paupières, chirurgie/laser). Posez-moi vos questions !",
    maxHistoryLength: 50,
    maxSentHistory: 20
  });

  // NOUVELLE FONCTION: Afficher TOUS les documents pertinents trouvés
  const transformAllSources = (sources: RawSource[]): TransformedSource[] => {
    if (!sources || sources.length === 0) {
      console.log('[DOCUMENT_SEARCH] ⚠️ Aucune source à transformer');
      return [];
    }

    console.log('[DOCUMENT_SEARCH] 📄 Transformation de TOUTES les sources:', sources.length);

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

    // Convertir en tableau et trier par similarité
    const allSources = Object.values(groupedByDocument)
      .sort((a, b) => b.maxSimilarity - a.maxSimilarity);

    console.log('[DOCUMENT_SEARCH] ✅ Sources transformées:', allSources.length, 'documents');
    return allSources;
  };

  // Fonction pour filtrer les sources par documents explicitement utilisés par l'IA (CONSERVÉE pour comparaison)
  const filterByActuallyUsedDocuments = (sources: RawSource[], actuallyUsedDocuments: string[]): TransformedSource[] => {
    if (!sources || sources.length === 0 || !actuallyUsedDocuments || actuallyUsedDocuments.length === 0) {
      console.log('[DOCUMENT_SEARCH] ⚠️ Filtrage impossible:', {
        sourcesLength: sources?.length || 0,
        usedDocsLength: actuallyUsedDocuments?.length || 0
      });
      return [];
    }

    console.log('[DOCUMENT_SEARCH] 🎯 Documents explicitement utilisés par l\'IA:', actuallyUsedDocuments);
    console.log('[DOCUMENT_SEARCH] 📄 Sources disponibles:', sources.length);

    // Filtrer les sources pour ne garder que celles explicitement utilisées
    const filteredSources = sources.filter(source => 
      actuallyUsedDocuments.includes(source.document_id)
    );

    console.log('[DOCUMENT_SEARCH] ✅ Sources filtrées par utilisation réelle:', filteredSources.length);

    // Grouper les chunks par document
    const groupedByDocument = filteredSources.reduce((acc: Record<string, TransformedSource>, source: RawSource) => {
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

    // Convertir en tableau - plus de filtre par similarité, on fait confiance à l'IA
    return Object.values(groupedByDocument);
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

      console.log('[DOCUMENT_SEARCH] 📋 DONNÉES BRUTES REÇUES:', data);

      let cleanContent = data.response || "Désolé, je n'ai pas pu traiter votre demande.";
      
      // Suppression des syntaxes techniques
      cleanContent = cleanContent
        .replace(/\[ACTION_TACHE:[^\]]*\]/gs, '')
        .replace(/\s*CONTEXT_PARTICIPANTS:.*$/gi, '')
        .replace(/\s*CONTEXT_UTILISATEURS:.*$/gi, '')
        .replace(/\s*CONTEXTE.*?:/gi, '')
        .replace(/DOCS_USED:.*?END_DOCS/gs, '')
        .trim();

      // NOUVELLE APPROCHE: Afficher TOUS les documents trouvés
      const actuallyUsedDocuments = data.actuallyUsedDocuments || [];
      const allTransformedSources = transformAllSources(data.sources || []);
      const explicitlyUsedSources = filterByActuallyUsedDocuments(data.sources || [], actuallyUsedDocuments);

      // Décider quelles sources afficher : si l'IA a utilisé des documents spécifiques, les montrer,
      // sinon montrer tous les documents trouvés pour plus de transparence
      const sourcesToDisplay = explicitlyUsedSources.length > 0 ? explicitlyUsedSources : allTransformedSources;

      console.log('[DOCUMENT_SEARCH] 📊 RÉSUMÉ DE L\'ANALYSE AMÉLIORÉE:');
      console.log('- Sources originales:', data.sources?.length || 0);
      console.log('- Documents explicitement utilisés:', actuallyUsedDocuments.length);
      console.log('- Tous les documents trouvés:', allTransformedSources.length);
      console.log('- Sources finales affichées:', sourcesToDisplay.length);
      console.log('- Affichage:', explicitlyUsedSources.length > 0 ? 'EXPLICITEMENT_UTILISÉS' : 'TOUS_TROUVÉS');
      console.log('- Debug info:', data.debugInfo);

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        content: cleanContent,
        isUser: false,
        timestamp: new Date(),
        sources: sourcesToDisplay,
        debugInfo: debugMode ? data.debugInfo : undefined
      };

      addMessage(aiMessage);

      // Toast informatif pour données utilisées avec plus de détails
      if (sourcesToDisplay.length > 0) {
        const toastMessage = explicitlyUsedSources.length > 0 
          ? `L'IA a utilisé ${explicitlyUsedSources.length} document(s) spécifique(s) pour sa réponse`
          : `${allTransformedSources.length} document(s) pertinent(s) trouvé(s) dans le cabinet`;
          
        toast({
          title: "Documents trouvés",
          description: toastMessage,
          variant: "default",
        });
      } else if (actuallyUsedDocuments.length === 0) {
        toast({
          title: "Recherche améliorée activée",
          description: data.debugInfo?.restrictionMode === 'FLEXIBLE_CONTEXTUAL' ? 
            "L'assistant utilise maintenant une recherche contextuelle plus flexible" :
            "L'IA se limite aux informations des documents disponibles",
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
        content: "Désolé, je rencontre un problème technique temporaire. L'assistant de recherche documentaire amélioré reste disponible pour consulter vos documents avec plus de flexibilité.",
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
    <div className="w-full">
      <Card className="mt-4 mb-4 bg-white">
        <CardHeader className="pb-3 shadow-md hover:shadow-lg transition-shadow">
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
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="max-h-[600px] overflow-y-auto space-y-4">
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
                          📄 {message.sources.length} document(s) pertinent(s) trouvé(s)
                        </div>
                      )}
                      {debugMode && message.debugInfo && (
                        <div className="text-xs opacity-70 mt-2 bg-orange-100 dark:bg-orange-900 p-2 rounded">
                          <strong>Debug:</strong> {JSON.stringify(message.debugInfo)}
                        </div>
                      )}
                      <div className="text-xs opacity-70 mt-2">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Affichage des documents sources pour les réponses de l'IA avec titre amélioré */}
                {!message.isUser && message.sources && message.sources.length > 0 && (
                  <div className="ml-11">
                    <SmartDocumentSources 
                      sources={message.sources} 
                      title="Documents pertinents trouvés dans le cabinet"
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
                  <span className="text-sm">Recherche contextuelle en cours...</span>
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
        </CardContent>
      </Card>
    </div>
  );
};
