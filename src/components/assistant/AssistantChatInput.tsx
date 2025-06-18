
import React from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";

interface AssistantChatInputProps {
  inputMessage: string;
  setInputMessage: (value: string) => void;
  isLoading: boolean;
  onSendMessage: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
}

const AssistantChatInput = ({
  inputMessage,
  setInputMessage,
  isLoading,
  onSendMessage,
  onKeyPress,
}: AssistantChatInputProps) => {
  return (
    <div className="space-y-2">
      <div className="flex gap-2 pt-4 border-t flex-shrink-0">
        <Input
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder="Tapez votre message ici..."
          disabled={isLoading}
          className="flex-1"
        />
        <Button 
          onClick={onSendMessage} 
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

      <div className="text-xs text-muted-foreground">
        💡 Configurez les fonctionnalités actives dans les paramètres ci-dessus pour personnaliser l'assistant.
      </div>
    </div>
  );
};

export default AssistantChatInput;
