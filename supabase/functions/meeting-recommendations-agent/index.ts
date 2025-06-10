
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
    
    console.log('[RECOMMENDATIONS-AGENT] 💡 Traitement recommandations pour:', userMessage);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer les tâches avec leurs recommandations
    const { data: todos, error: todosError } = await supabase
      .from('todos')
      .select(`
        *,
        todo_participants(
          participant_id,
          participants(id, name, email)
        ),
        todo_ai_recommendations(*)
      `)
      .eq('meeting_id', meetingId)
      .eq('status', 'confirmed');

    if (todosError) {
      throw todosError;
    }

    console.log('[RECOMMENDATIONS-AGENT] ✅ Tâches avec recommandations:', todos.length);

    const systemPrompt = `Tu es un agent spécialisé dans la création et gestion des recommandations IA pour les tâches de réunions.

TÂCHES AVEC RECOMMANDATIONS :
${todos.map((todo, i) => `
${i+1}. [ID: ${todo.id}] ${todo.description}
   - Assigné à: ${todo.todo_participants?.map(tp => tp.participants.name).join(', ') || 'Non assigné'}
   - Recommandation actuelle: ${todo.todo_ai_recommendations?.[0]?.recommendation_text || 'Aucune'}
   - Email pré-rédigé: ${todo.todo_ai_recommendations?.[0]?.email_draft ? 'Oui' : 'Non'}
`).join('')}

DEMANDE UTILISATEUR : "${userMessage}"

CAPACITÉS :
- Créer des recommandations pour les tâches
- Modifier des recommandations existantes
- Générer des emails pré-rédigés
- Suggérer des améliorations pour les tâches

INSTRUCTIONS :
1. Analyse la demande concernant les recommandations
2. Identifie les tâches concernées
3. Crée des recommandations pertinentes et actionables
4. Génère des emails professionnels si demandé
5. Sois spécifique et pratique dans tes recommandations

Réponds UNIQUEMENT en JSON avec cette structure :
{
  "actions": [
    {
      "type": "create_recommendation | update_recommendation",
      "data": {
        "todo_id": "uuid",
        "recommendation": "texte de la recommandation",
        "email_draft": "email pré-rédigé (optionnel)"
      },
      "explanation": "explication détaillée"
    }
  ],
  "summary": "résumé des actions effectuées"
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
        max_tokens: 1500,
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
      console.error('[RECOMMENDATIONS-AGENT] ❌ Erreur parsing:', parseError);
      aiResponse = {
        actions: [],
        summary: "Impossible de traiter la demande concernant les recommandations."
      };
    }

    // Exécuter les actions
    const executedActions = [];
    
    for (const action of aiResponse.actions || []) {
      try {
        switch (action.type) {
          case 'create_recommendation':
            const { error: createError } = await supabase
              .from('todo_ai_recommendations')
              .insert({
                todo_id: action.data.todo_id,
                recommendation_text: action.data.recommendation,
                email_draft: action.data.email_draft || null
              });
            
            if (createError) throw createError;
            
            executedActions.push({
              ...action,
              success: true,
              result: "Recommandation créée"
            });
            break;
            
          case 'update_recommendation':
            const { error: updateError } = await supabase
              .from('todo_ai_recommendations')
              .update({
                recommendation_text: action.data.recommendation,
                email_draft: action.data.email_draft || null,
                updated_at: new Date().toISOString()
              })
              .eq('todo_id', action.data.todo_id);
            
            if (updateError) throw updateError;
            
            executedActions.push({
              ...action,
              success: true,
              result: "Recommandation mise à jour"
            });
            break;
        }
      } catch (error) {
        console.error(`[RECOMMENDATIONS-AGENT] ❌ Erreur action ${action.type}:`, error);
        executedActions.push({
          ...action,
          success: false,
          error: error.message
        });
      }
    }

    console.log('[RECOMMENDATIONS-AGENT] ✅ Actions terminées:', executedActions.length);

    return new Response(JSON.stringify({
      actions: executedActions,
      summary: aiResponse.summary,
      success: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[RECOMMENDATIONS-AGENT] ❌ ERREUR:', error);
    
    return new Response(JSON.stringify({
      error: error.message,
      actions: [],
      summary: "Erreur lors du traitement des recommandations",
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
