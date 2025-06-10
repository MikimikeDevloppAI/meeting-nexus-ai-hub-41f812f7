
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
    
    console.log('[TODOS-CHAT] 📋 Gestion todos:', userMessage);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer todos existants avec timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database timeout')), 5000)
    );

    const todosPromise = supabase
      .from('todos')
      .select('id, description, status')
      .eq('meeting_id', meetingId)
      .in('status', ['confirmed', 'completed']);

    const { data: todos, error } = await Promise.race([todosPromise, timeoutPromise]) as any;

    if (error) {
      throw new Error(`Erreur récupération todos: ${error.message}`);
    }

    console.log('[TODOS-CHAT] ✅ Todos récupérés:', todos?.length || 0);

    const todosText = todos?.map(t => `${t.id}: ${t.description} (${t.status})`).join('\n') || 'Aucune tâche';

    const systemPrompt = `Tu es un assistant spécialisé dans la gestion des tâches (todos) de réunions OphtaCare.

TÂCHES ACTUELLES:
${todosText}

INSTRUCTION: "${userMessage}"

Actions possibles:
- CREATE: créer une nouvelle tâche
- UPDATE: modifier une tâche existante  
- DELETE: supprimer une tâche

Réponds en JSON:
{
  "action": "CREATE|UPDATE|DELETE",
  "todo_id": "id si UPDATE/DELETE",
  "description": "description si CREATE/UPDATE",
  "explanation": "ce qui sera fait"
}`;

    console.log('[TODOS-CHAT] 🧠 Appel OpenAI...');

    const openAIPromise = fetch('https://api.openai.com/v1/chat/completions', {
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
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    const openAITimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('OpenAI timeout')), 15000)
    );

    const response = await Promise.race([openAIPromise, openAITimeout]) as Response;

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const aiData = await response.json();
    console.log('[TODOS-CHAT] ✅ Réponse OpenAI reçue');

    let aiResponse;
    try {
      const aiContent = aiData.choices[0].message.content;
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      console.error('[TODOS-CHAT] ❌ Erreur parsing:', parseError);
      return new Response(JSON.stringify({ 
        error: "Impossible de comprendre la demande",
        response: "Reformulez votre demande plus clairement.",
        success: false
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Exécuter l'action
    try {
      let result;
      
      switch (aiResponse.action) {
        case 'CREATE':
          const { error: createError } = await supabase
            .from('todos')
            .insert({
              meeting_id: meetingId,
              description: aiResponse.description,
              status: 'confirmed'
            });
          
          if (createError) throw createError;
          result = "Tâche créée avec succès";
          break;
          
        case 'UPDATE':
          const { error: updateError } = await supabase
            .from('todos')
            .update({ description: aiResponse.description })
            .eq('id', aiResponse.todo_id);
          
          if (updateError) throw updateError;
          result = "Tâche mise à jour avec succès";
          break;
          
        case 'DELETE':
          const { error: deleteError } = await supabase
            .from('todos')
            .delete()
            .eq('id', aiResponse.todo_id);
          
          if (deleteError) throw deleteError;
          result = "Tâche supprimée avec succès";
          break;
          
        default:
          throw new Error('Action non reconnue');
      }

      console.log('[TODOS-CHAT] ✅ Action exécutée:', aiResponse.action);

      return new Response(JSON.stringify({
        success: true,
        action: aiResponse.action,
        explanation: aiResponse.explanation,
        response: `${aiResponse.explanation} - ${result}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('[TODOS-CHAT] ❌ Erreur action:', error);
      throw error;
    }

  } catch (error) {
    console.error('[TODOS-CHAT] ❌ ERREUR:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      response: `Erreur: ${error.message}`,
      success: false
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
