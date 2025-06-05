
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Mail, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TodoAIRecommendationProps {
  todoId: string;
}

interface AIRecommendation {
  id: string;
  recommendation_text: string;
  email_draft?: string;
  created_at: string;
}

export const TodoAIRecommendation = ({ todoId }: TodoAIRecommendationProps) => {
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showEmailDraft, setShowEmailDraft] = useState(false);
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
