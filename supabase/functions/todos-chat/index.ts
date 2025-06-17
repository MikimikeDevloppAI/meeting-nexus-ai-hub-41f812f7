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
    const { meetingId, userMessage } = await req.json();
    
    console.log('[TODOS-CHAT] 📝 Message reçu:', userMessage);
    console.log('[TODOS-CHAT] 🆔 Meeting ID:', meetingId);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer le transcript de la réunion
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('transcript')
      .eq('id', meetingId)
      .single();

    if (meetingError) {
      throw meetingError;
    }

    const transcript = meeting?.transcript || 'Pas de transcript disponible.';

    // Construire le prompt pour OpenAI
    const systemPrompt = `Tu es un assistant spécialisé dans la gestion des tâches (todos) pour les réunions.

TRANSCRIPT DE LA RÉUNION :
${transcript}

INSTRUCTIONS :
1. Analyse le message de l'utilisateur pour comprendre la demande concernant les tâches.
2. Extraire les informations pertinentes pour créer, modifier ou supprimer des tâches.
3. Retourne une réponse claire et concise sur les actions à effectuer.

Réponds UNIQUEMENT en JSON avec cette structure :
{
  "action": "create | update | delete",
  "description": "description de la tâche",
  "taskId": "uuid de la tâche à modifier ou supprimer (si applicable)"
}`;

    console.log('[TODOS-CHAT] 🧠 Appel OpenAI...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.3,
        max_tokens: 16384,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log('[TODOS-CHAT] 🤖 Réponse OpenAI:', aiResponse);

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponse);
    } catch (error) {
      console.error('[TODOS-CHAT] ❌ Erreur parsing JSON:', error);
      throw new Error('Erreur lors de l\'analyse de la réponse JSON.');
    }

    // Exécuter les actions en base de données
    let executedActions = [];
    let finalResponse = "Action effectuée";

    try {
      if (parsedResponse.action === 'create') {
        const { data: newTask, error: createError } = await supabase
          .from('todos')
          .insert({ meeting_id: meetingId, description: parsedResponse.description })
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        executedActions.push({ type: 'create', taskId: newTask.id, description: newTask.description });
        finalResponse = `Tâche créée: ${newTask.description}`;
      } else if (parsedResponse.action === 'update') {
        const { data: updatedTask, error: updateError } = await supabase
          .from('todos')
          .update({ description: parsedResponse.description })
          .eq('id', parsedResponse.taskId)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        executedActions.push({ type: 'update', taskId: updatedTask.id, description: updatedTask.description });
        finalResponse = `Tâche modifiée: ${updatedTask.description}`;
      } else if (parsedResponse.action === 'delete') {
        const { error: deleteError } = await supabase
          .from('todos')
          .delete()
          .eq('id', parsedResponse.taskId);

        if (deleteError) {
          throw deleteError;
        }

        executedActions.push({ type: 'delete', taskId: parsedResponse.taskId });
        finalResponse = `Tâche supprimée`;
      }
    } catch (dbError) {
      console.error('[TODOS-CHAT] ❌ Erreur DB:', dbError);
      throw new Error('Erreur lors de la modification de la base de données.');
    }

    return new Response(JSON.stringify({
      success: true,
      response: finalResponse,
      explanation: `Actions effectuées avec succès`,
      actionsExecuted: executedActions.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[TODOS-CHAT] ❌ Erreur:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      response: "Une erreur s'est produite lors du traitement de votre demande."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
