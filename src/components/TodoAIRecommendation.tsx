
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Mail, ChevronDown, ChevronUp, Phone, Globe, MapPin } from "lucide-react";
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
  contact_info?: ContactInfo[];
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

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error("Error fetching AI recommendation:", error);
          return;
        }

        // Extract potential contact information from the recommendation
        if (data) {
          // Try to parse contact information from recommendation_text if available
          // This is a workaround since we're adding this feature to existing data
          const contactPattern = /\*\*Contact(?:s)?\*\*:?\s*([\s\S]*?)(?:\n\n|\*\*|$)/i;
          const contactMatch = data.recommendation_text.match(contactPattern);
          
          if (contactMatch) {
            // Simple heuristic parsing of contact info from text
            const contactText = contactMatch[1];
            
            // Try to identify company names and their details
            const companyPattern = /([\w\s\-&]+)(?:\s*:\s*|\s*-\s*|\s*–\s*)((?:[\s\S](?!\n\n))*)/g;
            const rawContacts: ContactInfo[] = [];
            
            let match;
            while ((match = companyPattern.exec(contactText)) !== null) {
              const name = match[1].trim();
              const details = match[2].trim();
              
              const phoneMatch = details.match(/(?:Tél(?:éphone)?|Phone)?\s*:?\s*(\+\d[\d\s\-\.]+\d)/i);
              const emailMatch = details.match(/(?:E-?mail|Courriel)?\s*:?\s*([\w\.-]+@[\w\.-]+\.\w+)/i);
              const websiteMatch = details.match(/(?:(?:Site|Web)(?:site)?|URL)?\s*:?\s*(https?:\/\/[^\s,]+)/i);
              const addressMatch = details.match(/(?:Adresse)?\s*:?\s*([^,]+,[^,]+(?:,[^,]+)*)/i);
              
              rawContacts.push({
                name,
                phone: phoneMatch ? phoneMatch[1] : undefined,
                email: emailMatch ? emailMatch[1] : undefined,
                website: websiteMatch ? websiteMatch[1] : undefined,
                address: addressMatch ? addressMatch[1] : undefined
              });
            }
            
            if (rawContacts.length > 0) {
              data.contact_info = rawContacts;
            }
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
        <span>Chargement des recommandations...</span>
      </div>
    );
  }

  if (!recommendation) {
    return null;
  }

  const hasContactInfo = recommendation.contact_info && recommendation.contact_info.length > 0;

  return (
    <div className="mt-3">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between bg-blue-50 border-blue-200 hover:bg-blue-100"
          >
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-blue-600" />
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                Recommandation IA
              </Badge>
              {recommendation.email_draft && (
                <Mail className="h-3 w-3 text-blue-600" />
              )}
              {hasContactInfo && (
                <Phone className="h-3 w-3 text-blue-600" />
              )}
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-blue-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-blue-600" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Card className="mt-2 border-blue-200">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Bot className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">
                      {recommendation.recommendation_text}
                    </p>
                  </div>
                </div>

                {/* Contact information section */}
                {hasContactInfo && (
                  <div className="border-t pt-3">
                    <Collapsible open={showContacts} onOpenChange={setShowContacts}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span>Coordonnées de contact</span>
                          </div>
                          {showContacts ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="mt-3 space-y-4">
                          {recommendation.contact_info.map((contact, index) => (
                            <Card key={index} className="bg-gray-50">
                              <CardContent className="p-3">
                                <div className="space-y-2">
                                  <h4 className="font-medium">{contact.name}</h4>
                                  
                                  {contact.phone && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <Phone className="h-3.5 w-3.5 text-gray-500" />
                                      <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="text-blue-600 hover:underline">
                                        {contact.phone}
                                      </a>
                                    </div>
                                  )}
                                  
                                  {contact.email && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <Mail className="h-3.5 w-3.5 text-gray-500" />
                                      <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                                        {contact.email}
                                      </a>
                                    </div>
                                  )}
                                  
                                  {contact.website && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <Globe className="h-3.5 w-3.5 text-gray-500" />
                                      <a 
                                        href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline"
                                      >
                                        {contact.website.replace(/^https?:\/\//i, '')}
                                      </a>
                                    </div>
                                  )}
                                  
                                  {contact.address && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <MapPin className="h-3.5 w-3.5 text-gray-500" />
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
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}

                {/* Email draft section */}
                {recommendation.email_draft && (
                  <div className="border-t pt-3">
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

                <div className="text-xs text-gray-500">
                  Généré le {new Date(recommendation.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
