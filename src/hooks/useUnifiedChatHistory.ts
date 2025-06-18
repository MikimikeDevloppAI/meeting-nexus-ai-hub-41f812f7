
import { useState, useEffect } from 'react';

export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  sources?: any[];
  internetSources?: any[];
  hasInternetContext?: boolean;
  contextFound?: boolean;
  taskAction?: any;
  debugInfo?: any;
  taskContext?: any;
  databaseContext?: any;
  hasRelevantContext?: boolean;
  actuallyUsedDocuments?: string[];
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
        // En cas d'erreur, démarrer avec le message d'accueil si fourni
        if (initialMessage) {
          initializeChat();
        }
      }
    } else {
      // Première visite, initialiser avec le message d'accueil si fourni
      if (initialMessage) {
        initializeChat();
      }
    }
  }, [storageKey, initialMessage]);

  // Sauvegarder l'historique à chaque modification
  useEffect(() => {
    if (messages.length > 0) {
      // Limiter la taille de l'historique sauvegardé
      const limitedMessages = messages.slice(-maxHistoryLength);
      localStorage.setItem(storageKey, JSON.stringify(limitedMessages));
      console.log(`[CHAT_HISTORY] 💾 Historique sauvegardé (${storageKey}):`, limitedMessages.length, 'messages');
    }
  }, [messages, storageKey, maxHistoryLength]);

  const initializeChat = () => {
    if (initialMessage) {
      const welcomeMessage: ChatMessage = {
        id: '1',
        content: initialMessage,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  };

  const addMessage = (message: ChatMessage) => {
    setMessages(prev => {
      const newMessages = [...prev, message];
      // Limiter automatiquement si nécessaire
      return newMessages.length > maxHistoryLength 
        ? newMessages.slice(-maxHistoryLength)
        : newMessages;
    });
  };

  const clearHistory = () => {
    localStorage.removeItem(storageKey);
    if (initialMessage) {
      initializeChat();
    } else {
      setMessages([]);
    }
    console.log(`[CHAT_HISTORY] 🗑️ Historique effacé (${storageKey})`);
  };

  // Obtenir l'historique formaté pour l'envoi aux Edge Functions
  const getFormattedHistory = () => {
    return messages
      .slice(-maxSentHistory) // Prendre les N derniers messages
      .map(msg => ({
        isUser: msg.isUser,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        sources: msg.sources,
        taskAction: msg.taskAction
      }));
  };

  return {
    messages,
    setMessages,
    addMessage,
    clearHistory,
    getFormattedHistory
  };
};
