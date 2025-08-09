import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Send, Bot, User } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface MedicalLetterChatProps {
  rawTranscript: string;
  letterContent: string;
  onLetterUpdate?: (newContent: string) => void;
}

export const MedicalLetterChat: React.FC<MedicalLetterChatProps> = ({
  rawTranscript,
  letterContent,
  onLetterUpdate
}) => {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  const sendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;

    const userMessage = currentMessage.trim();
    setCurrentMessage('');
    setIsLoading(true);

    // Ajouter le message utilisateur à l'historique
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    };

    setChatHistory(prev => [...prev, newUserMessage]);

    try {
      const response = await fetch('https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/medical-letter-chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage,
          rawTranscript,
          letterContent,
          chatHistory
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data?.success && data?.response) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.response,
          timestamp: Date.now()
        };

        setChatHistory(prev => [...prev, assistantMessage]);

        // Si une lettre modifiée est retournée, la mettre à jour
        if (data.modifiedLetter && onLetterUpdate) {
          const normalized = data.modifiedLetter
            .replace(/\\r\\n/g, '\n')
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\n');
          onLetterUpdate(normalized);
        }

        toast({
          title: "Lettre modifiée",
          description: "L'assistant a modifié votre lettre médicale",
        });
      } else {
        throw new Error(data?.error || "Erreur de communication avec l'assistant");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Erreur de communication",
        description: error.message || "Impossible de communiquer avec l'assistant",
        variant: "destructive",
      });
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
    <div className="bg-card text-card-foreground rounded-lg border shadow-sm">
      <div className="p-6 pb-0">
        <h3 className="text-lg font-semibold mb-4">Assistant de Modification de Lettre</h3>
      </div>
      
      <div className="p-6 pt-0">
        {/* Zone de chat */}
        <div className="border rounded-lg mb-4">
          <div className="h-80 overflow-y-auto p-4 space-y-4">
            {chatHistory.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>Demandez-moi de modifier votre lettre médicale</p>
                <p className="text-sm mt-2">
                  Exemples: "Corrige les fautes", "Rends le plus professionnel", "Ajoute une recommandation de suivi"
                </p>
              </div>
            ) : (
              chatHistory.map((message, index) => (
                <div key={index} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0">
                      <Bot className="h-8 w-8 text-blue-600" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}>
                    <pre className="text-sm whitespace-pre-wrap font-sans">{message.content}</pre>
                  </div>
                  {message.role === 'user' && (
                    <div className="flex-shrink-0">
                      <User className="h-8 w-8 text-primary" />
                    </div>
                  )}
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0">
                  <Bot className="h-8 w-8 text-blue-600" />
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-muted-foreground">L'assistant réfléchit...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Zone de saisie */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <textarea
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Tapez votre message... (Entrée pour envoyer, Shift+Entrée pour nouvelle ligne)"
                className="flex-1 min-h-[60px] resize-none border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !currentMessage.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed h-[60px] px-4 rounded-md flex items-center gap-2 text-sm font-medium transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};