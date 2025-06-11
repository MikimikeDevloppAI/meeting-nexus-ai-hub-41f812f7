
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Bot, User, Loader2, FileText, Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface DocumentSource {
  documentId: string;
  documentName: string;
  maxSimilarity: number;
  chunksCount: number;
}

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  sources?: DocumentSource[];
}

export const DocumentSearchAssistant = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const clearChat = () => {
    setMessages([]);
    toast({
      title: "Chat effacé",
      description: "L'historique de la conversation a été supprimé.",
    });
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
      // Préparer l'historique de conversation pour l'agent AI
      const conversationHistory = messages.map(msg => ({
        content: msg.content,
        isUser: msg.isUser,
        timestamp: msg.timestamp.toISOString()
      }));

      console.log('[DOCUMENT_SEARCH] Envoi requête UNIQUEMENT recherche vectorielle:', inputMessage);
      console.log('[DOCUMENT_SEARCH] Historique:', conversationHistory.length, 'messages');

      // Utiliser l'agent AI avec recherche vectorielle UNIQUEMENT
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
            conversationHistory: conversationHistory,
            // Configuration spécifique pour recherche documents avec seuils bas
            minSimilarityThreshold: 0.005,
            vectorSearchOnly: true
          }
        }
      });

      if (error) {
        console.error('[DOCUMENT_SEARCH] Error:', error);
        throw error;
      }

      console.log('[DOCUMENT_SEARCH] Réponse reçue:', data);

      // Traiter les sources et grouper par document unique
      let uniqueDocuments: DocumentSource[] = [];
      if (data.sources && data.sources.length > 0) {
        console.log('[DOCUMENT_SEARCH] Traitement de', data.sources.length, 'sources enrichies');
        
        // Grouper les sources par document_id pour éviter les doublons
        const documentsMap = new Map<string, DocumentSource>();
        
        data.sources.forEach((source: any) => {
          const docId = source.document_id || source.id;
          const docName = source.document_name || 'Document inconnu';
          
          if (!documentsMap.has(docId)) {
            documentsMap.set(docId, {
              documentId: docId,
              documentName: docName,
              maxSimilarity: source.similarity || 0,
              chunksCount: 1
            });
          } else {
            // Mettre à jour avec la meilleure similarité et compter les chunks
            const existing = documentsMap.get(docId)!;
            existing.maxSimilarity = Math.max(existing.maxSimilarity, source.similarity || 0);
            existing.chunksCount += 1;
          }
        });

        uniqueDocuments = Array.from(documentsMap.values())
          .sort((a, b) => b.maxSimilarity - a.maxSimilarity); // Trier par pertinence
      } else {
        console.log('[DOCUMENT_SEARCH] Aucune source trouvée');
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || "Désolé, je n'ai pas trouvé d'informations pertinentes dans vos documents.",
        isUser: false,
        timestamp: new Date(),
        sources: uniqueDocuments
      };

      setMessages(prev => [...prev, aiMessage]);

      // Afficher les résultats dans la console pour debug
      console.log('[DOCUMENT_SEARCH] Documents uniques utilisés:', uniqueDocuments);

    } catch (error: any) {
      console.error('[DOCUMENT_SEARCH] Error sending message:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'effectuer la recherche",
        variant: "destructive",
      });

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Désolé, je rencontre un problème technique lors de la recherche. Pouvez-vous réessayer ?",
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
          Posez des questions et je rechercherai dans tous vos documents pour vous donner les meilleures réponses avec les sources exactes utilisées.
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

                    {/* Documents sources utilisés */}
                    {!message.isUser && message.sources && message.sources.length > 0 && (
                      <div className="ml-11 space-y-3">
                        <div className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Documents sources utilisés ({message.sources.length}):
                        </div>
                        {message.sources.map((document, index) => (
                          <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-blue-600" />
                                <span className="font-medium text-blue-800 text-sm">
                                  {document.documentName}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="text-xs">
                                  Pertinence: {(document.maxSimilarity * 100).toFixed(1)}%
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {document.chunksCount} section{document.chunksCount > 1 ? 's' : ''} utilisée{document.chunksCount > 1 ? 's' : ''}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
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
                      <span className="text-sm">Recherche vectorielle uniquement dans les documents...</span>
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
              🔍 Recherche vectorielle UNIQUEMENT avec noms de documents depuis table 'documents'
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
