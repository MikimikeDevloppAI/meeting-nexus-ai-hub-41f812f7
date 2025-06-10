
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
    const { todoId, userMessage, action } = await req.json();
    
    console.log('[TODO-ASSISTANT] 🎯 Action:', action, 'pour todo:', todoId);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer todo et recommandation
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database timeout')), 3000)
    );

    const [todoResult, recommendationResult] = await Promise.race([
      Promise.all([
        supabase.from('todos').select('*').eq('id', todoId).single(),
        supabase.from('todo_ai_recommendations').select('*').eq('todo_id', todoId).single()
      ]),
      timeoutPromise
    ]) as any;

    if (todoResult.error) {
      throw new Error(`Erreur récupération todo: ${todoResult.error.message}`);
    }

    const todo = todoResult.data;
    const recommendation = recommendationResult.data || {};

    console.log('[TODO-ASSISTANT] ✅ Données récupérées');

    let systemPrompt;
    
    switch (action) {
      case 'modify_description':
        systemPrompt = `Tu modifies la description d'une tâche médicale OphtaCare.

TÂCHE ACTUELLE: "${todo.description}"
DEMANDE: "${userMessage}"

Réponds en JSON:
{
  "new_description": "nouvelle description améliorée",
  "explanation": "ce qui a été modifié"
}`;
        break;
        
      case 'modify_recommendation':
        systemPrompt = `Tu modifies la recommandation IA pour une tâche médicale OphtaCare.

TÂCHE: "${todo.description}"
RECOMMANDATION ACTUELLE: "${recommendation.recommendation_text || 'Aucune recommandation'}"
DEMANDE: "${userMessage}"

Réponds en JSON:
{
  "new_recommendation": "nouvelle recommandation améliorée",
  "explanation": "ce qui a été modifié"
}`;
        break;
        
      case 'modify_email':
        systemPrompt = `Tu modifies l'email pré-rédigé pour une tâche médicale OphtaCare.

TÂCHE: "${todo.description}"
EMAIL ACTUEL: "${recommendation.email_draft || 'Aucun email'}"
DEMANDE: "${userMessage}"

Réponds en JSON:
{
  "new_email": "nouvel email professionnel",
  "explanation": "ce qui a été modifié"
}`;
        break;
        
      default:
        throw new Error('Action non reconnue');
    }

    console.log('[TODO-ASSISTANT] 🧠 Appel OpenAI...');

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
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    const openAITimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('OpenAI timeout')), 8000)
    );

    const response = await Promise.race([openAIPromise, openAITimeout]) as Response;

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiData = await response.json();
    console.log('[TODO-ASSISTANT] ✅ Réponse OpenAI reçue');

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
      console.error('[TODO-ASSISTANT] ❌ Erreur parsing:', parseError);
      return new Response(JSON.stringify({ 
        error: "Impossible de comprendre la demande",
        response: "Reformulez votre demande plus clairement.",
        success: false
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mettre à jour selon l'action
    try {
      switch (action) {
        case 'modify_description':
          const { error: updateTodoError } = await supabase
            .from('todos')
            .update({ description: aiResponse.new_description })
            .eq('id', todoId);
          
          if (updateTodoError) throw updateTodoError;
          break;
          
        case 'modify_recommendation':
          if (recommendation.id) {
            const { error: updateRecError } = await supabase
              .from('todo_ai_recommendations')
              .update({ recommendation_text: aiResponse.new_recommendation })
              .eq('todo_id', todoId);
            
            if (updateRecError) throw updateRecError;
          } else {
            const { error: createRecError } = await supabase
              .from('todo_ai_recommendations')
              .insert({
                todo_id: todoId,
                recommendation_text: aiResponse.new_recommendation
              });
            
            if (createRecError) throw createRecError;
          }
          break;
          
        case 'modify_email':
          if (recommendation.id) {
            const { error: updateEmailError } = await supabase
              .from('todo_ai_recommendations')
              .update({ email_draft: aiResponse.new_email })
              .eq('todo_id', todoId);
            
            if (updateEmailError) throw updateEmailError;
          } else {
            const { error: createEmailError } = await supabase
              .from('todo_ai_recommendations')
              .insert({
                todo_id: todoId,
                email_draft: aiResponse.new_email,
                recommendation_text: ''
              });
            
            if (createEmailError) throw createEmailError;
          }
          break;
      }

      console.log('[TODO-ASSISTANT] ✅ Mise à jour effectuée');

      return new Response(JSON.stringify({
        success: true,
        action,
        explanation: aiResponse.explanation,
        response: aiResponse.explanation
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('[TODO-ASSISTANT] ❌ Erreur mise à jour:', error);
      throw error;
    }

  } catch (error) {
    console.error('[TODO-ASSISTANT] ❌ ERREUR:', error);
    
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
