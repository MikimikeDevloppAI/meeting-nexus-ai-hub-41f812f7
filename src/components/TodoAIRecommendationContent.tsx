
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Lightbulb, Mail, ChevronDown, ChevronUp, Phone, Globe, MapPin, 
  Send, Loader2, MessageSquare, User, Bot
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";

interface TodoAIRecommendationContentProps {
  todoId: string;
  autoOpenEmail?: boolean;
}

interface ContactInfo {
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
}

interface AIRecommendation {
  id: string;
  recommendation_text: string;
  email_draft?: string;
  created_at: string;
  contacts?: ContactInfo[];
  estimated_cost?: string;
}

interface EmailChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const TodoAIRecommendationContent = ({ todoId, autoOpenEmail = false }: TodoAIRecommendationContentProps) => {
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showEmailDraft, setShowEmailDraft] = useState(autoOpenEmail);
  const [showContacts, setShowContacts] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // États pour le chat de modification d'email
  const [emailChatMessages, setEmailChatMessages] = useState<EmailChatMessage[]>([]);
  const [emailChatInput, setEmailChatInput] = useState("");
  const [isEmailChatLoading, setIsEmailChatLoading] = useState(false);
  const [showEmailChat, setShowEmailChat] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    fetchRecommendation();
  }, [todoId]);

  const fetchRecommendation = async () => {
    try {
      const { data, error } = await supabase
        .from("todo_ai_recommendations")
        .select("*")
        .eq("todo_id", todoId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching AI recommendation:", error);
        return;
      }

      if (data) {
        // Parser les contacts depuis la recommandation si disponibles
        try {
          const contactPattern = /\*\*Contact(?:s)?\*\*:?\s*([\s\S]*?)(?:\n\n|\*\*|$)/i;
          const contactMatch = data.recommendation_text.match(contactPattern);
          
          let parsedContacts: ContactInfo[] = [];
          
          if (contactMatch) {
            const contactText = contactMatch[1];
            const lines = contactText.split('\n').filter(line => line.trim());
            
            let currentContact: Partial<ContactInfo> = {};
            
            for (const line of lines) {
              const trimmedLine = line.trim();
              
              if (!trimmedLine.includes(':') && trimmedLine.length > 3 && !currentContact.name) {
                if (Object.keys(currentContact).length > 1) {
                  parsedContacts.push(currentContact as ContactInfo);
                }
                currentContact = { name: trimmedLine };
              } else {
                const phoneMatch = trimmedLine.match(/(?:📞|Tél|Phone|Téléphone)?\s*:?\s*(\+?\d[\d\s\-\.]{8,})/i);
                const emailMatch = trimmedLine.match(/(?:✉️|E-?mail|Courriel)?\s*:?\s*([\w\.-]+@[\w\.-]+\.\w+)/i);
                const websiteMatch = trimmedLine.match(/(?:🌐|Site|Web|URL)?\s*:?\s*((?:https?:\/\/)?[\w\.-]+\.[a-z]{2,})/i);
                const addressMatch = trimmedLine.match(/(?:📍|Adresse)?\s*:?\s*(.+(?:Genève|Geneva|CH|Suisse|Switzerland).+)/i);
                
                if (phoneMatch) currentContact.phone = phoneMatch[1];
                if (emailMatch) currentContact.email = emailMatch[1];
                if (websiteMatch) {
                  let website = websiteMatch[1];
                  if (!website.startsWith('http')) website = `https://${website}`;
                  currentContact.website = website;
                }
                if (addressMatch) currentContact.address = addressMatch[1];
              }
            }
            
            if (Object.keys(currentContact).length > 1) {
              parsedContacts.push(currentContact as ContactInfo);
            }
          }
          
          if (parsedContacts.length > 0) {
            data.contacts = parsedContacts;
          }
        } catch (parseError) {
          console.error("Error parsing contacts:", parseError);
        }
      }
      
      setRecommendation(data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecommendationToggle = (newIsOpen: boolean) => {
    setIsOpen(newIsOpen);
    if (newIsOpen && recommendation?.email_draft && autoOpenEmail) {
      setShowEmailDraft(true);
    }
  };

  const sendEmailChatMessage = async () => {
    if (!emailChatInput.trim() || isEmailChatLoading || !recommendation) return;

    const userMessage: EmailChatMessage = {
      role: 'user',
      content: emailChatInput,
      timestamp: new Date(),
    };

    setEmailChatMessages(prev => [...prev, userMessage]);
    const currentInput = emailChatInput;
    setEmailChatInput("");
    setIsEmailChatLoading(true);

    try {
      console.log('📧 Envoi demande modification email:', currentInput);
      
      // Récupérer les informations de la tâche
      const { data: todoData, error: todoError } = await supabase
        .from("todos")
        .select("description")
        .eq("id", todoId)
        .single();

      if (todoError) throw todoError;

      const { data, error } = await supabase.functions.invoke('email-modification-agent', {
        body: {
          todoId,
          todoDescription: todoData.description,
          currentEmail: recommendation.email_draft,
          userRequest: currentInput,
          conversationHistory: emailChatMessages,
          recommendation: recommendation.recommendation_text
        }
      });

      if (error) {
        throw new Error(`Erreur: ${error.message}`);
      }

      if (!data || data.success === false) {
        throw new Error(data?.error || 'Erreur inconnue');
      }

      const assistantMessage: EmailChatMessage = {
        role: 'assistant',
        content: data.explanation || "Email modifié avec succès",
        timestamp: new Date(),
      };

      setEmailChatMessages(prev => [...prev, assistantMessage]);

      // Mettre à jour l'email dans l'état local ET en base de données
      if (data.modifiedEmail) {
        setRecommendation(prev => prev ? {
          ...prev,
          email_draft: data.modifiedEmail
        } : null);

        // Sauvegarder en base de données
        const { error: updateError } = await supabase
          .from('todo_ai_recommendations')
          .update({ 
            email_draft: data.modifiedEmail,
            updated_at: new Date().toISOString()
          })
          .eq('todo_id', todoId);

        if (updateError) {
          console.error('Erreur sauvegarde email:', updateError);
        }

        toast({
          title: "✅ Email modifié",
          description: "L'email a été mis à jour automatiquement",
        });
      }

    } catch (error: any) {
      console.error('❌ Erreur modification email:', error);
      
      const errorMessage: EmailChatMessage = {
        role: 'assistant',
        content: `❌ ${error.message}`,
        timestamp: new Date()
      };
      
      setEmailChatMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "⚠️ Erreur",
        description: "Impossible de modifier l'email. Réessayez.",
        variant: "destructive",
      });

    } finally {
      setIsEmailChatLoading(false);
    }
  };

  const handleEmailChatKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendEmailChatMessage();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-foreground p-4 bg-gray-100 rounded min-h-[80px]">
        <Lightbulb className="h-4 w-4 animate-pulse text-yellow-500" />
        <span>Analyse IA...</span>
      </div>
    );
  }

  if (!recommendation) {
    return null;
  }

  const hasContactInfo = recommendation.contacts && recommendation.contacts.length > 0;
  const hasRecommendation = recommendation.recommendation_text && !recommendation.recommendation_text.includes('Aucune recommandation spécifique');

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={handleRecommendationToggle}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-16 flex flex-col items-center justify-center gap-1 text-foreground hover:text-foreground hover:bg-gray-200/50 px-2"
          >
            <Lightbulb className="h-4 w-4 text-yellow-500 flex-shrink-0" />
            <span className="text-xs font-medium text-black text-center leading-tight">Recommandation IA</span>
            <div className="flex items-center gap-1">
              {recommendation.email_draft && <Mail className="h-2 w-2" />}
              {hasContactInfo && <Phone className="h-2 w-2" />}
              {isOpen ? <ChevronUp className="h-2 w-2" /> : <ChevronDown className="h-2 w-2" />}
            </div>
          </Button>
        </CollapsibleTrigger>

        {isOpen && (
          <CollapsibleContent className="col-span-full">
            <Card className="mt-2 border-muted/50">
              <CardContent className="p-4">
                <div className="space-y-3">
                  {hasRecommendation && (
                    <div className="text-sm text-muted-foreground">
                      {recommendation.recommendation_text.split('\n').map((line, index) => {
                        if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
                          return (
                            <div key={index} className="font-medium text-foreground mt-2 mb-1">
                              {line.replace(/\*\*/g, '')}
                            </div>
                          );
                        }
                        if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
                          return (
                            <div key={index} className="ml-3 mb-1">
                              {line.trim().substring(2)}
                            </div>
                          );
                        }
                        return line.trim() ? (
                          <div key={index} className="mb-1">{line}</div>
                        ) : (
                          <div key={index} className="h-1" />
                        );
                      })}
                      
                      {recommendation.estimated_cost && (
                        <div className="mt-3 p-2 bg-muted/50 rounded text-sm">
                          <strong>Coût estimé :</strong> {recommendation.estimated_cost}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Section contacts */}
                  {hasContactInfo && (
                    <div className={hasRecommendation ? "border-t pt-3" : ""}>
                      <Collapsible open={showContacts} onOpenChange={setShowContacts}>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <Phone className="h-3 w-3" />
                              <span>Contacts ({recommendation.contacts.length})</span>
                            </div>
                            {showContacts ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </Button>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="mt-2 space-y-2">
                            {recommendation.contacts.map((contact, index) => (
                              <div key={index} className="bg-muted/50 rounded p-2">
                                <div className="font-medium text-sm">{contact.name}</div>
                                <div className="text-xs text-muted-foreground space-y-1 mt-1">
                                  {contact.phone && (
                                    <div className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="hover:underline">
                                        {contact.phone}
                                      </a>
                                    </div>
                                  )}
                                  {contact.email && (
                                    <div className="flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      <a href={`mailto:${contact.email}`} className="hover:underline break-all">
                                        {contact.email}
                                      </a>
                                    </div>
                                  )}
                                  {contact.website && (
                                    <div className="flex items-center gap-1">
                                      <Globe className="h-3 w-3" />
                                      <a 
                                        href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="hover:underline break-all"
                                      >
                                        {contact.website.replace(/^https?:\/\//i, '')}
                                      </a>
                                    </div>
                                  )}
                                  {contact.address && (
                                    <div className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      <a 
                                        href={`https://maps.google.com/?q=${encodeURIComponent(contact.address)}`}
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="hover:underline"
                                      >
                                        {contact.address}
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  )}

                  {/* Section email avec chat de modification */}
                  {recommendation.email_draft && (
                    <div className={(hasRecommendation || hasContactInfo) ? "border-t pt-3" : ""}>
                      <Collapsible open={showEmailDraft} onOpenChange={setShowEmailDraft}>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <Mail className="h-3 w-3" />
                              <span>Email pré-rédigé</span>
                            </div>
                            {showEmailDraft ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </Button>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="mt-2 space-y-3">
                            {/* Chat de modification d'email */}
                            <div className="border rounded-lg p-3 bg-blue-50/50">
                              <Collapsible open={showEmailChat} onOpenChange={setShowEmailChat}>
                                <CollapsibleTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-between text-sm mb-2"
                                  >
                                    <div className="flex items-center gap-2">
                                      <MessageSquare className="h-3 w-3 text-blue-600" />
                                      <span className="text-blue-800">Modifier cet email avec l'IA</span>
                                    </div>
                                    {showEmailChat ? (
                                      <ChevronUp className="h-3 w-3" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>

                                <CollapsibleContent>
                                  <div className="space-y-2">
                                    {/* Messages du chat email */}
                                    <ScrollArea className="h-[150px] pr-2">
                                      <div className="space-y-2">
                                        {emailChatMessages.length === 0 && (
                                          <div className="text-center py-2 text-muted-foreground">
                                            <p className="text-xs">
                                              Demandez des modifications à l'email (ton, contenu, structure...)
                                            </p>
                                          </div>
                                        )}
                                        
                                        {emailChatMessages.map((message, index) => (
                                          <div
                                            key={index}
                                            className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                          >
                                            <div className={`flex gap-2 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                message.role === 'user' ? 'bg-blue-500' : 'bg-blue-200'
                                              }`}>
                                                {message.role === 'user' ? (
                                                  <User className="h-2 w-2 text-white" />
                                                ) : (
                                                  <Bot className="h-2 w-2 text-blue-600" />
                                                )}
                                              </div>
                                              
                                              <div className={`rounded-lg p-2 text-xs ${
                                                message.role === 'user' 
                                                  ? 'bg-blue-500 text-white' 
                                                  : 'bg-blue-100 text-blue-800'
                                              }`}>
                                                <p className="whitespace-pre-wrap">{message.content}</p>
                                                <div className="text-xs opacity-70 mt-1">
                                                  {message.timestamp.toLocaleTimeString('fr-FR', { 
                                                    hour: '2-digit', 
                                                    minute: '2-digit' 
                                                  })}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </ScrollArea>

                                    {/* Input du chat email */}
                                    <div className="flex gap-2">
                                      <Input
                                        value={emailChatInput}
                                        onChange={(e) => setEmailChatInput(e.target.value)}
                                        onKeyPress={handleEmailChatKeyPress}
                                        placeholder="Modifier l'email (ex: rendre plus formel, ajouter des détails...)"
                                        disabled={isEmailChatLoading}
                                        className="flex-1 text-xs h-7"
                                      />
                                      <Button 
                                        onClick={sendEmailChatMessage} 
                                        disabled={isEmailChatLoading || !emailChatInput.trim()}
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                      >
                                        {isEmailChatLoading ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Send className="h-3 w-3" />
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            </div>

                            {/* Email content */}
                            <div className="bg-muted/50 rounded p-3">
                              <pre className="text-xs whitespace-pre-wrap font-sans">
                                {recommendation.email_draft}
                              </pre>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  navigator.clipboard.writeText(recommendation.email_draft || '');
                                  toast({
                                    title: "Email copié",
                                    description: "L'email a été copié dans le presse-papiers",
                                  });
                                }}
                                className="w-full mt-3"
                              >
                                Copier l'email
                              </Button>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground text-right">
                    {new Date(recommendation.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        )}
      </Collapsible>
    </>
  );
};
