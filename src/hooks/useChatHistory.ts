
import { useState, useEffect } from 'react';

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  sources?: any[];
  internetSources?: any[];
  hasInternetContext?: boolean;
  contextFound?: boolean;
  taskAction?: any;
}

const CHAT_HISTORY_KEY = 'assistant-chat-history';

export const useChatHistory = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Charger l'historique au démarrage
  useEffect(() => {
    const savedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory);
        // Reconvertir les timestamps en objets Date
        const messagesWithDates = parsedHistory.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(messagesWithDates);
        console.log('[CHAT_HISTORY] ✅ Historique chargé:', messagesWithDates.length, 'messages');
      } catch (error) {
        console.error('[CHAT_HISTORY] ❌ Erreur chargement historique:', error);
        // En cas d'erreur, démarrer avec le message d'accueil
        initializeChat();
      }
    } else {
      // Première visite, initialiser avec le message d'accueil
      initializeChat();
    }
  }, []);

  // Sauvegarder l'historique à chaque modification
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
      console.log('[CHAT_HISTORY] 💾 Historique sauvegardé:', messages.length, 'messages');
    }
  }, [messages]);

  const initializeChat = () => {
    const welcomeMessage: ChatMessage = {
      id: '1',
      content: "Bonjour ! Je suis l'assistant IA spécialisé du cabinet OphtaCare\n\nComment puis-je vous aider ?",
      isUser: false,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  };

  const addMessage = (message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  };

  const clearHistory = () => {
    localStorage.removeItem(CHAT_HISTORY_KEY);
    initializeChat();
    console.log('[CHAT_HISTORY] 🗑️ Historique effacé');
  };

  return {
    messages,
    setMessages,
    addMessage,
    clearHistory
  };
};
