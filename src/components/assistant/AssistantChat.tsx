
import React, { useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Trash2, Loader2 } from "lucide-react";
import { ChatMessage } from "@/hooks/useUnifiedChatHistory";
import AssistantChatMessage from './AssistantChatMessage';
import AssistantChatInput from './AssistantChatInput';

interface AssistantChatProps {
  messages: ChatMessage[];
  isLoading: boolean;
  inputMessage: string;
  setInputMessage: (value: string) => void;
  onSendMessage: () => void;
  onClearHistory: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
}

const AssistantChat = ({
  messages,
  isLoading,
  inputMessage,
  setInputMessage,
  onSendMessage,
  onClearHistory,
  onKeyPress,
}: AssistantChatProps) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom on new message
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-4 flex-shrink-0">
        <div className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Conversation avec l'assistant</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearHistory}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Effacer l'historique
          </Button>
        </div>
        <CardDescription>
          Posez vos questions et gérez vos tâches avec l'assistant IA.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4 min-h-0">
        <ScrollArea className="flex-1 pr-4 mb-4" ref={chatContainerRef}>
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Bonjour ! Comment puis-je vous aider ?</p>
                <p className="text-sm">
                  Je peux vous aider avec la gestion de vos tâches, documents, réunions et bien plus encore.
                </p>
              </div>
            )}
            
            {messages.map((message) => (
              <AssistantChatMessage key={message.id} message={message} />
            ))}
            
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">L'assistant réfléchit...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <AssistantChatInput
          inputMessage={inputMessage}
          setInputMessage={setInputMessage}
          isLoading={isLoading}
          onSendMessage={onSendMessage}
          onKeyPress={onKeyPress}
        />
      </CardContent>
    </Card>
  );
};

export default AssistantChat;
