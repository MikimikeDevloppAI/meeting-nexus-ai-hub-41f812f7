
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
        const messagesWithDates = parsedHistory.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(messagesWithDates);
        console.log(`[CHAT_HISTORY] ✅ Historique chargé (${storageKey}):`, messagesWithDates.length, 'messages');
      } catch (error) {
        console.error(`[CHAT_HISTORY] ❌ Erreur chargement historique (${storageKey}):`, error);
        initializeWithWelcome();
      }
    } else {
      initializeWithWelcome();
    }
    setIsInitialized(true);
  }, [storageKey]);

  // Sauvegarder l'historique à chaque modification
  useEffect(() => {
    if (isInitialized && messages.length > 0) {
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

  const getFormattedHistory = () => {
    return messages
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
