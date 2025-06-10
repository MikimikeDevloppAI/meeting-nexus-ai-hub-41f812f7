
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
    const { meetingId, userMessage, conversationHistory, coordinatorContext } = await req.json();
    
    console.log('[SUMMARY-AGENT] 📝 Traitement résumé pour:', userMessage);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer les informations de la réunion
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (meetingError) {
      throw meetingError;
    }

    console.log('[SUMMARY-AGENT] ✅ Réunion trouvée:', meeting.title);

    const systemPrompt = `Tu es un agent spécialisé dans la rédaction et modification de résumés de réunions.

INFORMATIONS RÉUNION :
Titre: ${meeting.title}
Date: ${new Date(meeting.created_at).toLocaleDateString('fr-FR')}

RÉSUMÉ ACTUEL :
${meeting.summary || 'Aucun résumé existant'}

TRANSCRIPT (extrait pour contexte) :
${meeting.transcript ? meeting.transcript.substring(0, 3000) + '...' : 'Pas de transcript disponible'}

DEMANDE UTILISATEUR : "${userMessage}"

INSTRUCTIONS :
1. Analyse la demande de modification du résumé
2. Utilise le transcript comme source d'information principale
3. Améliore ou modifie le résumé selon la demande
4. Garde un style professionnel et structuré
5. Intègre les éléments demandés de manière cohérente

Si la demande concerne l'ajout d'informations spécifiques, utilise le transcript pour trouver le contexte approprié.

Réponds UNIQUEMENT en JSON avec cette structure :
{
  "action": {
    "type": "update_summary",
    "data": {
      "new_summary": "nouveau résumé complet"
    },
    "explanation": "explication de ce qui a été modifié"
  },
  "summary": "résumé de l'action effectuée"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiData = await response.json();
    let aiResponse;

    try {
      const content = aiData.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[SUMMARY-AGENT] ❌ Erreur parsing:', parseError);
      aiResponse = {
        action: {
          type: "update_summary",
          data: { new_summary: meeting.summary || "" },
          explanation: "Impossible de traiter la demande de modification du résumé."
        },
        summary: "Erreur lors du traitement"
      };
    }

    // Exécuter l'action de mise à jour
    let executedAction;
    
    try {
      const { error: updateError } = await supabase
        .from('meetings')
        .update({ summary: aiResponse.action.data.new_summary })
        .eq('id', meetingId);
      
      if (updateError) throw updateError;
      
      executedAction = {
        ...aiResponse.action,
        success: true,
        result: "Résumé mis à jour avec succès"
      };
      
      console.log('[SUMMARY-AGENT] ✅ Résumé mis à jour');
      
    } catch (error) {
      console.error('[SUMMARY-AGENT] ❌ Erreur mise à jour:', error);
      executedAction = {
        ...aiResponse.action,
        success: false,
        error: error.message
      };
    }

    return new Response(JSON.stringify({
      actions: [executedAction],
      summary: aiResponse.summary,
      success: executedAction.success
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[SUMMARY-AGENT] ❌ ERREUR:', error);
    
    return new Response(JSON.stringify({
      error: error.message,
      actions: [],
      summary: "Erreur lors du traitement du résumé",
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
