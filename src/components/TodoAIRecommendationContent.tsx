
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { 
  Mail, ChevronDown, ChevronUp, Phone, Globe, MapPin, 
  Send, Loader2, MessageSquare, User, Bot, Edit2, Save, X
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
  const [isOpen, setIsOpen] = useState(true);
  const [showContacts, setShowContacts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentEmailDraft, setCurrentEmailDraft] = useState<string>("");
  
  // États pour l'édition directe de l'email
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editedEmail, setEditedEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  
  // États pour le chat de modification d'email
  const [emailChatMessages, setEmailChatMessages] = useState<EmailChatMessage[]>([]);
  const [emailChatInput, setEmailChatInput] = useState("");
  const [isEmailChatLoading, setIsEmailChatLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
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
        
        setRecommendation(data);
        setCurrentEmailDraft(data.email_draft || "");
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditEmail = () => {
    setEditedEmail(currentEmailDraft);
    setIsEditingEmail(true);
  };

  const handleSaveEmail = async () => {
    if (!recommendation) return;
    
    setSavingEmail(true);
    try {
      const { error } = await supabase
        .from("todo_ai_recommendations")
        .update({ 
          email_draft: editedEmail,
          updated_at: new Date().toISOString()
        })
        .eq("id", recommendation.id);

      if (error) throw error;

      setCurrentEmailDraft(editedEmail);
      setIsEditingEmail(false);
      
      toast({
        title: "Email modifié",
        description: "L'email a été mis à jour avec succès",
      });
    } catch (error: any) {
      console.error("Error updating email:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'email",
        variant: "destructive",
      });
    } finally {
      setSavingEmail(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingEmail(false);
    setEditedEmail("");
  };

  const sendEmailChatMessage = async () => {
    if (!emailChatInput.trim() || isEmailChatLoading) return;

    const userMessage: EmailChatMessage = {
      role: 'user',
      content: emailChatInput,
      timestamp: new Date(),
    };

    setEmailChatMessages(prev => [...prev, userMessage]);
    const currentInput = emailChatInput;
    setEmailChatInput("");
    setIsEmailChatLoading(true);
    setIsTyping(true);

    // Ajouter un message de typing temporaire
    const typingMessage: EmailChatMessage = {
      role: 'assistant',
      content: "Je modifie l'email...",
      timestamp: new Date(),
    };
    setEmailChatMessages(prev => [...prev, typingMessage]);

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
          currentEmail: currentEmailDraft,
          userRequest: currentInput,
          conversationHistory: emailChatMessages,
          recommendation: recommendation?.recommendation_text || null
        }
      });

      if (error) {
        throw new Error(`Erreur: ${error.message}`);
      }

      if (!data || data.success === false) {
        throw new Error(data?.error || 'Erreur inconnue');
      }

      // Supprimer le message de typing et ajouter la vraie réponse
      setEmailChatMessages(prev => {
        const filtered = prev.filter(msg => !msg.content.includes('modifie'));
        return [...filtered, {
          role: 'assistant',
          content: data.explanation || "Email modifié avec succès",
          timestamp: new Date(),
        }];
      });

      // Mettre à jour l'email dans l'état local
      if (data.modifiedEmail) {
        setCurrentEmailDraft(data.modifiedEmail);

        // Sauvegarder en base de données
        if (recommendation) {
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
        } else {
          // Créer une nouvelle recommandation avec l'email
          const { error: insertError } = await supabase
            .from('todo_ai_recommendations')
            .insert({
              todo_id: todoId,
              recommendation_text: "Email généré par l'assistant IA",
              email_draft: data.modifiedEmail,
              created_at: new Date().toISOString()
            });

          if (insertError) {
            console.error('Erreur création recommandation:', insertError);
          } else {
            // Recharger la recommandation
            fetchRecommendation();
          }
        }

        toast({
          title: "✅ Email modifié",
          description: "L'email a été mis à jour automatiquement",
        });
      }

    } catch (error: any) {
      console.error('❌ Erreur modification email:', error);
      
      // Supprimer le message de typing et ajouter l'erreur
      setEmailChatMessages(prev => {
        const filtered = prev.filter(msg => !msg.content.includes('modifie'));
        return [...filtered, {
          role: 'assistant',
          content: `❌ ${error.message}`,
          timestamp: new Date()
        }];
      });
      
      toast({
        title: "⚠️ Erreur",
        description: "Impossible de modifier l'email. Réessayez.",
        variant: "destructive",
      });

    } finally {
      setIsEmailChatLoading(false);
      setIsTyping(false);
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
        <Mail className="h-4 w-4 animate-pulse text-blue-500" />
        <span>Chargement communication...</span>
      </div>
    );
  }

  const hasContactInfo = recommendation?.contacts && recommendation.contacts.length > 0;

  return (
    <Card className="border-muted/50">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Email content first */}
          {currentEmailDraft ? (
            <div className="bg-muted/50 rounded p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-sm">Email de communication</span>
                </div>
                {!isEditingEmail && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleEditEmail}
                    className="h-6 px-2"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              
              {isEditingEmail ? (
                <div className="space-y-3">
                  <Textarea
                    value={editedEmail}
                    onChange={(e) => setEditedEmail(e.target.value)}
                    className="min-h-[150px] text-sm"
                    placeholder="Modifier l'email..."
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveEmail}
                      disabled={savingEmail}
                      className="flex-1"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      {savingEmail ? "Sauvegarde..." : "Sauvegarder"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={savingEmail}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <pre className="text-xs whitespace-pre-wrap font-sans mb-3 cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors" onClick={handleEditEmail}>
                    {currentEmailDraft}
                  </pre>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(currentEmailDraft);
                      toast({
                        title: "Email copié",
                        description: "L'email a été copié dans le presse-papiers",
                      });
                    }}
                    className="w-full"
                  >
                    Copier l'email
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-muted/50 rounded p-3">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-sm">Email de communication</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Aucun email généré pour cette tâche. Utilisez l'assistant ci-dessous pour créer un email.
              </p>
            </div>
          )}

          {/* Chat de modification d'email */}
          <div className="border rounded-lg p-3 bg-blue-50/50">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              <span className="font-medium text-sm">
                {currentEmailDraft ? "Modifier l'email" : "Créer un email"}
              </span>
              {isTyping && (
                <div className="flex items-center gap-1 ml-2">
                  <Bot className="h-3 w-3 text-blue-500 animate-pulse" />
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {/* Messages du chat email */}
              <ScrollArea className="h-[150px] pr-2">
                <div className="space-y-2">
                  {emailChatMessages.length === 0 && (
                    <div className="text-center py-2 text-muted-foreground">
                      <p className="text-xs">
                        {currentEmailDraft 
                          ? "Demandez des modifications à l'email (ton, contenu, structure...)"
                          : "Demandez la création d'un email (ex: 'Créer un email pour demander un devis', 'Rédiger un email de présentation...')"
                        }
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
                            : message.content.includes('modifie')
                              ? 'bg-yellow-100 text-yellow-800 animate-pulse'
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
                  placeholder={isEmailChatLoading ? "Modification en cours..." : currentEmailDraft ? "Modifier l'email (ex: rendre plus formel, ajouter des détails...)" : "Créer un email (ex: demander un devis, présenter l'entreprise...)"}
                  disabled={isEmailChatLoading}
                  className="flex-1 text-xs h-7"
                />
                <Button 
                  onClick={sendEmailChatMessage} 
                  disabled={isEmailChatLoading || !emailChatInput.trim()}
                  size="sm"
                  className={`h-7 w-7 p-0 ${isEmailChatLoading ? 'animate-pulse' : ''}`}
                >
                  {isEmailChatLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Section contacts */}
          {hasContactInfo && (
            <div className="border-t pt-3">
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

          {recommendation && (
            <div className="text-xs text-muted-foreground text-right">
              {new Date(recommendation.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
