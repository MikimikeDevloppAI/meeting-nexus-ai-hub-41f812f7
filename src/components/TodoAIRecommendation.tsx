
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Bot, Mail, ChevronDown, ChevronUp, Phone, Globe, MapPin, ExternalLink, 
  Target, Lightbulb, Users, Building, Search, MessageSquare, Cog, Sparkles
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  recommendation_type?: 'supplier_tips' | 'research_guide' | 'action_plan' | 'internal_communication';
  value_added_reason?: string;
}

export const TodoAIRecommendation = ({ todoId }: TodoAIRecommendationProps) => {
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showEmailDraft, setShowEmailDraft] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [loading, setLoading] = useState(true);

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
          // Détecter le type de recommandation basé sur le contenu si pas déjà défini
          let recommendation_type = null;
          if (data.recommendation_text) {
            const text = data.recommendation_text.toLowerCase();
            if (text.includes('fournisseur') || text.includes('négociation') || text.includes('prestataire')) {
              recommendation_type = 'supplier_tips';
            } else if (text.includes('recherche') || text.includes('sources') || text.includes('méthodologie')) {
              recommendation_type = 'research_guide';
            } else if (text.includes('plan d\'action') || text.includes('étapes') || text.includes('timeline')) {
              recommendation_type = 'action_plan';
            } else if (text.includes('email') || text.includes('communication') || text.includes('équipe')) {
              recommendation_type = 'internal_communication';
            }
          }
          
          data.recommendation_type = recommendation_type;
          
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Bot className="h-4 w-4 animate-pulse" />
        <span>Analyse intelligente...</span>
      </div>
    );
  }

  if (!recommendation) {
    return null;
  }

  const hasContactInfo = recommendation.contacts && recommendation.contacts.length > 0;
  const hasRecommendation = recommendation.recommendation_text && !recommendation.recommendation_text.includes('Aucune recommandation spécifique');

  const getRecommendationIcon = () => {
    switch (recommendation.recommendation_type) {
      case 'supplier_tips': return <Building className="h-4 w-4 text-orange-600" />;
      case 'research_guide': return <Search className="h-4 w-4 text-blue-600" />;
      case 'action_plan': return <Cog className="h-4 w-4 text-purple-600" />;
      case 'internal_communication': return <MessageSquare className="h-4 w-4 text-green-600" />;
      default: return <Lightbulb className="h-4 w-4 text-blue-600" />;
    }
  };

  const getRecommendationLabel = () => {
    switch (recommendation.recommendation_type) {
      case 'supplier_tips': return 'Conseils Fournisseur';
      case 'research_guide': return 'Guide de Recherche';
      case 'action_plan': return 'Plan d\'Action';
      case 'internal_communication': return 'Communication Interne';
      default: return 'Recommandation IA';
    }
  };

  const getBadgeColor = () => {
    switch (recommendation.recommendation_type) {
      case 'supplier_tips': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'research_guide': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'action_plan': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'internal_communication': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="mt-3">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 hover:from-blue-100 hover:to-purple-100"
          >
            <div className="flex items-center gap-2">
              {getRecommendationIcon()}
              <Badge variant="secondary" className={getBadgeColor()}>
                {getRecommendationLabel()}
              </Badge>
              {recommendation.email_draft && (
                <Mail className="h-3 w-3 text-blue-600" />
              )}
              {hasContactInfo && (
                <Phone className="h-3 w-3 text-green-600" />
              )}
              <Sparkles className="h-3 w-3 text-purple-600" />
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-blue-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-blue-600" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Card className="mt-2 border-blue-200 bg-gradient-to-br from-white to-blue-50">
            <CardContent className="p-4">
              <div className="space-y-3">
                {hasRecommendation && (
                  <div className="flex items-start gap-3">
                    {getRecommendationIcon()}
                    <div className="flex-1">
                      <div className="prose prose-sm max-w-none text-gray-700">
                        {recommendation.recommendation_text.split('\n').map((line, index) => {
                          if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
                            return (
                              <h4 key={index} className="font-semibold text-gray-900 mt-3 mb-1">
                                {line.replace(/\*\*/g, '')}
                              </h4>
                            );
                          }
                          if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
                            return (
                              <div key={index} className="ml-4 mb-1">
                                {line.trim().substring(2)}
                              </div>
                            );
                          }
                          return line.trim() ? (
                            <p key={index} className="mb-2">{line}</p>
                          ) : (
                            <br key={index} />
                          );
                        })}
                      </div>
                      
                      {recommendation.estimated_cost && (
                        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-md">
                          <div className="text-sm font-medium text-green-800 flex items-center gap-2">
                            💰 Coût estimé : {recommendation.estimated_cost}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Section contacts fournisseurs */}
                {hasContactInfo && (
                  <div className={hasRecommendation ? "border-t pt-3" : ""}>
                    <Collapsible open={showContacts} onOpenChange={setShowContacts}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span>Contacts spécialisés ({recommendation.contacts.length})</span>
                          </div>
                          {showContacts ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="mt-3 space-y-3">
                          {recommendation.contacts.map((contact, index) => (
                            <Card key={index} className="bg-gray-50 border-gray-200">
                              <CardContent className="p-3">
                                <div className="space-y-2">
                                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                    {contact.name}
                                    {contact.website && (
                                      <ExternalLink className="h-3 w-3 text-gray-500" />
                                    )}
                                  </h4>
                                  
                                  <div className="grid gap-1.5">
                                    {contact.phone && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <Phone className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                                        <a 
                                          href={`tel:${contact.phone.replace(/\s+/g, '')}`} 
                                          className="text-blue-600 hover:underline font-mono"
                                        >
                                          {contact.phone}
                                        </a>
                                      </div>
                                    )}
                                    
                                    {contact.email && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <Mail className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                                        <a 
                                          href={`mailto:${contact.email}`} 
                                          className="text-blue-600 hover:underline break-all"
                                        >
                                          {contact.email}
                                        </a>
                                      </div>
                                    )}
                                    
                                    {contact.website && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <Globe className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                                        <a 
                                          href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:underline break-all"
                                        >
                                          {contact.website.replace(/^https?:\/\//i, '')}
                                        </a>
                                      </div>
                                    )}
                                    
                                    {contact.address && (
                                      <div className="flex items-start gap-2 text-sm">
                                        <MapPin className="h-3.5 w-3.5 text-gray-500 flex-shrink-0 mt-0.5" />
                                        <a 
                                          href={`https://maps.google.com/?q=${encodeURIComponent(contact.address)}`}
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          className="text-blue-600 hover:underline"
                                        >
                                          {contact.address}
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}

                {/* Section email pré-rédigé */}
                {recommendation.email_draft && (
                  <div className={(hasRecommendation || hasContactInfo) ? "border-t pt-3" : ""}>
                    <Collapsible open={showEmailDraft} onOpenChange={setShowEmailDraft}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <span>Email pré-rédigé</span>
                          </div>
                          {showEmailDraft ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <Card className="mt-3 bg-gray-50">
                          <CardContent className="p-4">
                            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                              {recommendation.email_draft}
                            </pre>
                            <div className="mt-3 pt-3 border-t">
                              <Button
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(recommendation.email_draft || '');
                                }}
                                className="w-full"
                              >
                                Copier l'email
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}

                <div className="text-xs text-gray-500 flex items-center justify-between">
                  <span>
                    Généré le {new Date(recommendation.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  <div className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-purple-500" />
                    <span className="text-purple-600 font-medium">IA intelligente</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
