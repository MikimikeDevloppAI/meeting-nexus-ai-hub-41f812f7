
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Lightbulb, Mail, ChevronDown, ChevronUp, Phone, Globe, MapPin, Edit2, Save, X
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface TodoAIRecommendationProps {
  todoId: string;
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

export const TodoAIRecommendation = ({ todoId }: TodoAIRecommendationProps) => {
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showEmailDraft, setShowEmailDraft] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editedEmail, setEditedEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
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

    fetchRecommendation();
  }, [todoId]);

  const handleRecommendationToggle = (newIsOpen: boolean) => {
    setIsOpen(newIsOpen);
    // Auto-open email if there's an email draft when expanding the recommendation
    if (newIsOpen && recommendation?.email_draft) {
      setShowEmailDraft(true);
    }
  };

  const handleEditEmail = () => {
    setEditedEmail(recommendation?.email_draft || "");
    setIsEditingEmail(true);
  };

  const handleSaveEmail = async () => {
    if (!recommendation) return;
    
    setSavingEmail(true);
    try {
      const { error } = await supabase
        .from("todo_ai_recommendations")
        .update({ email_draft: editedEmail })
        .eq("id", recommendation.id);

      if (error) throw error;

      setRecommendation({ ...recommendation, email_draft: editedEmail });
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
                    <div className="text-sm text-muted-foreground break-words overflow-wrap-anywhere">
                      {recommendation.recommendation_text.split('\n').map((line, index) => {
                        if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
                          return (
                            <div key={index} className="font-medium text-foreground mt-2 mb-1 break-words">
                              {line.replace(/\*\*/g, '')}
                            </div>
                          );
                        }
                        if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
                          return (
                            <div key={index} className="ml-3 mb-1 break-words overflow-wrap-anywhere">
                              {line.trim().substring(2)}
                            </div>
                          );
                        }
                        return line.trim() ? (
                          <div key={index} className="mb-1 break-words overflow-wrap-anywhere">{line}</div>
                        ) : (
                          <div key={index} className="h-1" />
                        );
                      })}
                      
                      {recommendation.estimated_cost && (
                        <div className="mt-3 p-2 bg-muted/50 rounded text-sm break-words">
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
                                <div className="font-medium text-sm break-words">{contact.name}</div>
                                <div className="text-xs text-muted-foreground space-y-1 mt-1">
                                  {contact.phone && (
                                    <div className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="hover:underline break-all">
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
                                        className="hover:underline break-words"
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

                  {/* Section email */}
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
                          <div className="mt-2 bg-muted/50 rounded p-3">
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
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium">Email de communication</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleEditEmail}
                                    className="h-6 px-2"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                <pre className="text-xs whitespace-pre-wrap font-sans break-words overflow-wrap-anywhere cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors" onClick={handleEditEmail}>
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
                            )}
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
