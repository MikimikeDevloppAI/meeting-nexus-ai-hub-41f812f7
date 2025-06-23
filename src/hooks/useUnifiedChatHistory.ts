
import { useState, useEffect } from 'react';

export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  taskContext?: any;
  databaseContext?: any;
  hasRelevantContext?: boolean;
  actuallyUsedDocuments?: string[];
  sources?: Array<{
    documentId: string;
    documentName: string;
    maxSimilarity: number;
    chunksCount: number;
    documentType?: string;
    relevantChunks?: string[];
  }>;
  debugInfo?: any;
}

interface UseUnifiedChatHistoryProps {
  storageKey: string;
  initialMessage?: string;
  maxHistoryLength?: number;
  maxSentHistory?: number;
}

export const useUnifiedChatHistory = ({
  storageKey,
  initialMessage,
  maxHistoryLength = 50,
  maxSentHistory = 20
}: UseUnifiedChatHistoryProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Charger l'historique au démarrage
  useEffect(() => {
    const savedHistory = localStorage.getItem(storageKey);
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory);
        // Reconvertir les timestamps en objets Date
        const messagesWithDates = parsedHistory.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(messagesWithDates);
        console.log(`[CHAT_HISTORY] ✅ Historique chargé (${storageKey}):`, messagesWithDates.length, 'messages');
      } catch (error) {
        console.error(`[CHAT_HISTORY] ❌ Erreur chargement historique (${storageKey}):`, error);
        // En cas d'erreur, initialiser proprement
        initializeWithWelcome();
      }
    } else {
      // Première visite, initialiser avec le message d'accueil si fourni
      initializeWithWelcome();
    }
    setIsInitialized(true);
  }, [storageKey]);

  // Sauvegarder l'historique à chaque modification
  useEffect(() => {
    if (isInitialized && messages.length > 0) {
      // Limiter la taille de l'historique sauvegardé
      const limitedMessages = messages.slice(-maxHistoryLength);
      localStorage.setItem(storageKey, JSON.stringify(limitedMessages));
      console.log(`[CHAT_HISTORY] 💾 Historique sauvegardé (${storageKey}):`, limitedMessages.length, 'messages');
    }
  }, [messages, storageKey, maxHistoryLength, isInitialized]);

  const initializeWithWelcome = () => {
    if (initialMessage) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome-1',
        content: initialMessage,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  };

  const addMessage = (message: ChatMessage) => {
    setMessages(prev => {
      // Éviter les doublons de messages d'accueil
      if (!message.isUser && message.content.includes("Bonjour ! Je suis l'assistant IA")) {
        const hasWelcome = prev.some(msg => 
          !msg.isUser && msg.content.includes("Bonjour ! Je suis l'assistant IA")
        );
        if (hasWelcome) {
          console.log('[CHAT_HISTORY] 🚫 Éviter doublon message d\'accueil');
          return prev;
        }
      }
      
      const newMessages = [...prev, message];
      return newMessages.length > maxHistoryLength 
        ? newMessages.slice(-maxHistoryLength)
        : newMessages;
    });
  };

  const clearHistory = () => {
    localStorage.removeItem(storageKey);
    if (initialMessage) {
      initializeWithWelcome();
    } else {
      setMessages([]);
    }
    console.log(`[CHAT_HISTORY] 🗑️ Historique effacé (${storageKey})`);
  };

  // Obtenir l'historique formaté pour l'envoi aux Edge Functions (sans doublons d'accueil)
  const getFormattedHistory = () => {
    return messages
      .filter(msg => 
        msg.isUser || !msg.content.includes("Bonjour ! Je suis l'assistant IA pour cette tâche")
      )
      .slice(-maxSentHistory)
      .map(msg => ({
        isUser: msg.isUser,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        sources: msg.sources
      }));
  };

  return {
    messages,
    setMessages,
    addMessage,
    clearHistory,
    getFormattedHistory,
    isInitialized
  };
};
