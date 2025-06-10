
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
    
    console.log('[SIMPLE-ASSISTANT] 🤖 Traitement demande:', userMessage);
    console.log('[SIMPLE-ASSISTANT] 🆔 Meeting ID:', meetingId);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('[SIMPLE-ASSISTANT] ❌ OpenAI API key non configurée');
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupération rapide des données essentielles seulement
    console.log('[SIMPLE-ASSISTANT] 📋 Récupération contexte...');
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database timeout')), 2000)
    );

    const [meetingResult, todosResult] = await Promise.race([
      Promise.all([
        supabase.from('meetings').select('title, summary, transcript').eq('id', meetingId).single(),
        supabase.from('todos').select('id, description, assigned_to').eq('meeting_id', meetingId).eq('status', 'confirmed').limit(5)
      ]),
      timeoutPromise
    ]) as any;

    if (meetingResult.error) {
      throw new Error(`Erreur récupération réunion: ${meetingResult.error.message}`);
    }

    const meeting = meetingResult.data;
    const todos = todosResult.data || [];

    console.log('[SIMPLE-ASSISTANT] ✅ Données récupérées');

    // Prompt ultra-simplifié pour réponse rapide
    const systemPrompt = `Tu es l'assistant IA du cabinet OphtaCare pour la réunion "${meeting.title}".

CONTEXTE:
Résumé: ${meeting.summary || 'Pas de résumé'}
Tâches actuelles: ${todos.map(t => `- ${t.description}`).join('\n') || 'Aucune tâche'}

CAPACITÉS: modifier résumé, créer/modifier/supprimer tâches, créer recommandations.

Réponds en JSON:
{
  "response": "ta réponse conversationnelle",
  "actions": [{"type": "action_type", "data": {}, "explanation": "explication"}]
}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-3), // Historique très limité
      { role: 'user', content: userMessage }
    ];

    console.log('[SIMPLE-ASSISTANT] 🧠 Appel OpenAI...');

    // Appel OpenAI optimisé avec timeout court
    let response;
    const openAITimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('OpenAI timeout')), 8000) // Timeout très court
    );

    const openAIPromise = fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Modèle le plus rapide
        messages,
        temperature: 0.2,
        max_tokens: 500, // Limite très basse pour réponse rapide
      }),
    });

    response = await Promise.race([openAIPromise, openAITimeoutPromise]) as Response;

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiData = await response.json();
    console.log('[SIMPLE-ASSISTANT] ✅ Réponse OpenAI reçue');

    let aiResponse;
    try {
      const aiContent = aiData.choices[0].message.content;
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
        if (!aiResponse.response) {
          throw new Error('Réponse manquante');
        }
        if (!Array.isArray(aiResponse.actions)) {
          aiResponse.actions = [];
        }
      } else {
        aiResponse = {
          response: "J'ai compris votre demande. Pouvez-vous la reformuler plus précisément ?",
          actions: []
        };
      }
    } catch (parseError) {
      console.error('[SIMPLE-ASSISTANT] ❌ Erreur parsing:', parseError);
      aiResponse = {
        response: "J'ai rencontré un problème technique. Reformulez votre demande.",
        actions: []
      };
    }

    // Exécution rapide des actions (sans retry complexe)
    const executedActions = [];
    
    for (const action of aiResponse.actions || []) {
      try {
        console.log(`[SIMPLE-ASSISTANT] 🚀 Action: ${action.type}`);
        
        switch (action.type) {
          case 'create_todo':
            const { error: createError } = await supabase
              .from('todos')
              .insert({
                meeting_id: meetingId,
                description: action.data.description,
                status: 'confirmed'
              });
            
            if (createError) throw createError;
            executedActions.push({ ...action, success: true, result: "Tâche créée" });
            break;
            
          case 'update_todo':
            const { error: updateError } = await supabase
              .from('todos')
              .update({ description: action.data.description })
              .eq('id', action.data.todo_id);
            
            if (updateError) throw updateError;
            executedActions.push({ ...action, success: true, result: "Tâche mise à jour" });
            break;
            
          case 'update_summary':
            const { error: summaryError } = await supabase
              .from('meetings')
              .update({ summary: action.data.new_summary })
              .eq('id', meetingId);
            
            if (summaryError) throw summaryError;
            executedActions.push({ ...action, success: true, result: "Résumé mis à jour" });
            break;
            
          default:
            executedActions.push({ ...action, success: false, error: "Action non reconnue" });
        }
      } catch (error) {
        console.error(`[SIMPLE-ASSISTANT] ❌ Erreur action:`, error);
        executedActions.push({ ...action, success: false, error: error.message });
      }
    }

    const finalResponse = {
      response: aiResponse.response,
      actions: executedActions,
      success: true
    };

    console.log('[SIMPLE-ASSISTANT] ✅ Réponse envoyée');

    return new Response(JSON.stringify(finalResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[SIMPLE-ASSISTANT] ❌ ERREUR:', error);
    
    // Toujours retourner 200 avec un message d'erreur user-friendly
    const errorResponse = { 
      error: error.message,
      response: `Erreur technique temporaire. ${error.message.includes('timeout') ? 'Le service est surchargé, réessayez dans quelques instants.' : 'Réessayez ou reformulez votre demande.'}`,
      actions: [],
      success: false
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
