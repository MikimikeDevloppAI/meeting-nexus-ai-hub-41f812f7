
import React from 'react';
import { Bot, User } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ChatMessage } from "@/hooks/useUnifiedChatHistory";
import { SmartDocumentSources } from "@/components/documents/SmartDocumentSources";

interface AssistantChatMessageProps {
  message: ChatMessage;
}

const AssistantChatMessage = ({ message }: AssistantChatMessageProps) => {
  return (
    <div className="space-y-2">
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
          
          <div className={`rounded-lg p-3 break-words ${
            message.isUser 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted'
          }`}>
            <div className="text-sm whitespace-pre-wrap break-words word-wrap overflow-wrap-anywhere">
              {message.content}
            </div>
            <div className="text-xs opacity-70 mt-2">
              {format(message.timestamp, "d MMM yyyy 'à' HH:mm", { locale: fr })}
            </div>
          </div>
        </div>
      </div>

      {/* Affichage des documents sources pour les réponses de l'IA - SEULEMENT si réellement utilisés */}
      {!message.isUser && message.sources && message.sources.length > 0 && (
        <div className="ml-11">
          <SmartDocumentSources 
            sources={message.sources} 
            title="Documents du cabinet utilisés par l'IA"
          />
        </div>
      )}
    </div>
  );
};

export default AssistantChatMessage;
