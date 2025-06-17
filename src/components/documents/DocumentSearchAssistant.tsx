
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Bot, User, Loader2, Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SmartDocumentSources } from "./SmartDocumentSources";

interface DocumentSource {
  documentId: string;
  documentName: string;
  maxSimilarity: number;
  chunksCount: number;
  documentType?: string;
  relevantChunks?: string[];
}

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  sources?: DocumentSource[];
}

const DOCUMENT_CHAT_HISTORY_KEY = 'document-search-assistant-history';

export const DocumentSearchAssistant = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Charger l'historique au démarrage
  useEffect(() => {
    const savedHistory = localStorage.getItem(DOCUMENT_CHAT_HISTORY_KEY);
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory);
        // Reconvertir les timestamps en objets Date
        const messagesWithDates = parsedHistory.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(messagesWithDates);
        console.log('[DOCUMENT_SEARCH] ✅ Historique chargé:', messagesWithDates.length, 'messages');
      } catch (error) {
        console.error('[DOCUMENT_SEARCH] ❌ Erreur chargement historique:', error);
        // En cas d'erreur, démarrer avec un historique vide
        setMessages([]);
      }
    }
  }, []);

  // Sauvegarder l'historique à chaque modification
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(DOCUMENT_CHAT_HISTORY_KEY, JSON.stringify(messages));
      console.log('[DOCUMENT_SEARCH] 💾 Historique sauvegardé:', messages.length, 'messages');
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(DOCUMENT_CHAT_HISTORY_KEY);
    toast({
      title: "Chat effacé",
      description: "L'historique de la conversation a été supprimé.",
    });
    console.log('[DOCUMENT_SEARCH] 🗑️ Historique effacé');
  };

  const processDocumentSources = (sources: any[]): DocumentSource[] => {
    if (!sources || sources.length === 0) return [];

    // Grouper les sources par document et calculer les métriques
    const documentsMap = new Map<string, DocumentSource>();

    sources.forEach((source: any) => {
      const docId = source.document_id || source.id;
      const docName = source.document_name || 'Document inconnu';
      const similarity = source.similarity || 0;
      const chunkText = source.chunk_text || '';
      
      if (!documentsMap.has(docId)) {
        documentsMap.set(docId, {
          documentId: docId,
          documentName: docName,
          maxSimilarity: similarity,
          chunksCount: 1,
          documentType: source.type,
          relevantChunks: [chunkText]
        });
      } else {
        const existing = documentsMap.get(docId)!;
        existing.maxSimilarity = Math.max(existing.maxSimilarity, similarity);
        existing.chunksCount += 1;
        existing.relevantChunks!.push(chunkText);
      }
    });

    // Retourner tous les documents triés par pertinence
    return Array.from(documentsMap.values())
      .sort((a, b) => b.maxSimilarity - a.maxSimilarity);
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
      // Préparer l'historique de conversation COMPLET pour l'agent AI
      const conversationHistory = messages.map(msg => ({
        content: msg.content,
        isUser: msg.isUser,
        timestamp: msg.timestamp.toISOString()
      }));

      console.log('[DOCUMENT_SEARCH] Envoi requête avec historique COMPLET:', conversationHistory.length, 'messages précédents');
      console.log('[DOCUMENT_SEARCH] Message actuel:', inputMessage);
      console.log('[DOCUMENT_SEARCH] Contexte de conversation transmis:', conversationHistory);

      // Utiliser l'agent AI avec recherche vectorielle UNIQUEMENT + historique complet
      const { data, error } = await supabase.functions.invoke('ai-agent', {
        body: { 
          message: inputMessage,
          context: {
            // Force STRICTEMENT la recherche vectorielle uniquement
            forceEmbeddingsPriority: true,
            documentSearchMode: true,
            searchDocuments: true,
            useEmbeddings: true,
            // Désactiver complètement les autres sources
            useDatabase: false,
            useTasks: false,
            useInternet: false,
            // HISTORIQUE COMPLET pour la continuité de conversation
            conversationHistory: conversationHistory,
            // Configuration spécifique pour recherche documents avec seuils bas
            minSimilarityThreshold: 0.005,
            vectorSearchOnly: true,
            // Ajout d'un flag pour indiquer que c'est l'assistant de recherche documentaire
            isDocumentSearchAssistant: true
          }
        }
      });

      if (error) {
        console.error('[DOCUMENT_SEARCH] Error:', error);
        throw error;
      }

      console.log('[DOCUMENT_SEARCH] Réponse reçue avec contexte:', data);

      // Traiter toutes les sources de documents
      let documentSources: DocumentSource[] = [];
      if (data.sources && data.sources.length > 0) {
        console.log('[DOCUMENT_SEARCH] Traitement de', data.sources.length, 'sources enrichies');
        documentSources = processDocumentSources(data.sources);
        console.log('[DOCUMENT_SEARCH] Documents sources traités:', documentSources);
      } else {
        console.log('[DOCUMENT_SEARCH] Aucune source trouvée');
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || "Désolé, je n'ai pas trouvé d'informations pertinentes dans vos documents pour répondre à votre question dans le contexte de notre conversation.",
        isUser: false,
        timestamp: new Date(),
        sources: documentSources.length > 0 ? documentSources : undefined
      };

      setMessages(prev => [...prev, aiMessage]);

    } catch (error: any) {
      console.error('[DOCUMENT_SEARCH] Error sending message:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'effectuer la recherche",
        variant: "destructive",
      });

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Désolé, je rencontre un problème technique lors de la recherche. Pouvez-vous réessayer ? Je garde le contexte de notre conversation pour mieux vous aider.",
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

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            <CardTitle>Assistant de Recherche dans les Documents</CardTitle>
          </div>
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearChat}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Effacer
            </Button>
          )}
        </div>
        <CardDescription>
          Posez des questions et je rechercherai dans tous vos documents pour vous donner les meilleures réponses avec les documents sources pertinents. 
          {messages.length > 0 && (
            <span className="text-blue-600 font-medium">
              {" "}(Historique conservé : {messages.length} message{messages.length > 1 ? 's' : ''})
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg h-96 flex flex-col">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                <div className="flex items-center justify-center mb-4">
                  <MessageSquare className="h-12 w-12 text-muted-foreground" />
                </div>
                <p className="mb-2">Posez une question pour rechercher dans vos documents</p>
                <p className="text-xs">
                  Exemples : "Que fait Émilie le jeudi ?" ou "Trouve-moi des informations sur les budgets"
                </p>
                <p className="text-xs mt-2 text-blue-600">
                  💡 Votre historique de conversation sera conservé pour une meilleure continuité
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className="space-y-2">
                    <div className={`flex gap-3 ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex gap-3 max-w-[85%] ${message.isUser ? 'flex-row-reverse' : 'flex-row'}`}>
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
                          <div className="whitespace-pre-wrap text-sm">
                            {message.content}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Affichage intelligent des documents sources */}
                    {!message.isUser && message.sources && message.sources.length > 0 && (
                      <div className="ml-11">
                        <SmartDocumentSources 
                          sources={message.sources}
                          title={message.sources.length === 1 ? "Document source utilisé" : "Documents sources utilisés"}
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
                      <span className="text-sm">Recherche intelligente avec contexte...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t bg-muted/20">
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Rechercher dans vos documents..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button 
                onClick={sendMessage} 
                disabled={isLoading || !inputMessage.trim()}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              🔍 Recherche intelligente avec historique conservé • 
              {messages.length > 0 && (
                <span className="text-blue-600">
                  {" "}{messages.length} message{messages.length > 1 ? 's' : ''} en contexte
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
