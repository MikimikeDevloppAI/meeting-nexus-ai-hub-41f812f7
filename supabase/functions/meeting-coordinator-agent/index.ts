
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId, userMessage, conversationHistory } = await req.json();
    
    console.log('[COORDINATOR] 🎯 Analyse de la demande:', userMessage);
    console.log('[COORDINATOR] 🆔 Meeting ID:', meetingId);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Analyser l'intention utilisateur avec GPT-4
    console.log('[COORDINATOR] 🧠 Analyse intention utilisateur...');
    
    const intentAnalysisPrompt = `Tu es un coordinateur intelligent qui analyse les demandes des utilisateurs concernant les réunions.

DEMANDE UTILISATEUR : "${userMessage}"

CONTEXTE : L'utilisateur interagit avec un système de gestion de réunions qui peut :
1. GÉRER LES TÂCHES (todos) : créer, modifier, supprimer, assigner
2. MODIFIER LE RÉSUMÉ de la réunion
3. GÉRER LES RECOMMANDATIONS IA : créer, modifier des recommandations et emails pré-rédigés

INSTRUCTIONS :
- Analyse la demande et détermine quel(s) agent(s) doit/doivent être appelé(s)
- Identifie les actions spécifiques à effectuer
- Fournis une explication claire de ce qui va être fait

Réponds UNIQUEMENT en JSON avec cette structure :
{
  "agents_to_call": ["todo", "summary", "recommendations"],
  "primary_intent": "description de l'intention principale",
  "actions_planned": ["action1", "action2"],
  "user_explanation": "explication simple de ce qui va être fait"
}

AGENTS DISPONIBLES :
- "todo" : pour tout ce qui concerne les tâches/todos
- "summary" : pour modifier le résumé de réunion  
- "recommendations" : pour les recommandations IA et emails`;

    const intentResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: intentAnalysisPrompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!intentResponse.ok) {
      throw new Error(`Intent analysis failed: ${intentResponse.status}`);
    }

    const intentData = await intentResponse.json();
    let intentAnalysis;
    
    try {
      const content = intentData.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        intentAnalysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in intent analysis');
      }
    } catch (parseError) {
      console.error('[COORDINATOR] ❌ Erreur parsing intention:', parseError);
      // Fallback: traiter comme demande de tâche
      intentAnalysis = {
        agents_to_call: ["todo"],
        primary_intent: "Gestion de tâches",
        actions_planned: ["Analyse et traitement de la demande"],
        user_explanation: "Je vais traiter votre demande concernant les tâches de la réunion."
      };
    }

    console.log('[COORDINATOR] ✅ Intention analysée:', intentAnalysis);

    // Appeler les agents nécessaires
    const agentResults = [];
    const agentsToCall = intentAnalysis.agents_to_call || ["todo"];

    for (const agentType of agentsToCall) {
      console.log(`[COORDINATOR] 🚀 Appel agent: ${agentType}`);
      
      try {
        const { data: agentResult, error: agentError } = await supabase.functions.invoke(`meeting-${agentType}-agent`, {
          body: {
            meetingId,
            userMessage,
            conversationHistory,
            coordinatorContext: intentAnalysis
          }
        });

        if (agentError) {
          console.error(`[COORDINATOR] ❌ Erreur agent ${agentType}:`, agentError);
          agentResults.push({
            agent: agentType,
            success: false,
            error: agentError.message,
            actions: []
          });
        } else {
          console.log(`[COORDINATOR] ✅ Agent ${agentType} terminé`);
          agentResults.push({
            agent: agentType,
            success: true,
            ...agentResult
          });
        }
      } catch (error) {
        console.error(`[COORDINATOR] ❌ Erreur appel agent ${agentType}:`, error);
        agentResults.push({
          agent: agentType,
          success: false,
          error: error.message,
          actions: []
        });
      }
    }

    // Synthétiser les résultats
    const allActions = agentResults.flatMap(result => result.actions || []);
    const successfulAgents = agentResults.filter(r => r.success);
    const failedAgents = agentResults.filter(r => !r.success);

    let finalResponse = intentAnalysis.user_explanation;
    
    if (successfulAgents.length > 0) {
      const actionsSummary = allActions.map(action => `✅ ${action.explanation || action.type}`).join('\n');
      if (actionsSummary) {
        finalResponse += `\n\n**Actions réalisées :**\n${actionsSummary}`;
      }
    }

    if (failedAgents.length > 0) {
      finalResponse += `\n\n⚠️ Certaines actions n'ont pas pu être réalisées. Veuillez réessayer.`;
    }

    const response = {
      response: finalResponse,
      actions: allActions,
      needsConfirmation: false,
      agentResults: agentResults,
      intentAnalysis: intentAnalysis
    };

    console.log('[COORDINATOR] 🎉 Synthèse terminée:', {
      agentsUsed: agentsToCall.length,
      actionsCount: allActions.length,
      successRate: `${successfulAgents.length}/${agentResults.length}`
    });

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[COORDINATOR] ❌ ERREUR GLOBALE:', error);
    
    return new Response(JSON.stringify({
      error: error.message,
      response: "Une erreur s'est produite lors du traitement de votre demande. Veuillez réessayer.",
      actions: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
