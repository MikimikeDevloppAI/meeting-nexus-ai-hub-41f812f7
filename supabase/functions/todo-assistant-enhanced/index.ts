
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
    const { todoId, todoDescription, userMessage, conversationHistory, todoData, recommendation } = await req.json();
    
    console.log('🤖 Assistant IA Enhanced - Traitement demande pour todo:', todoId);
    
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('Clé API OpenAI manquante');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // Préparer le contexte pour l'IA
    let contextPrompt = `Tu es un assistant IA spécialisé dans l'aide aux tâches. Tu as accès aux informations suivantes :

TÂCHE ACTUELLE:
- ID: ${todoId}
- Description: ${todoDescription}`;

    if (todoData?.meetings?.[0]) {
      contextPrompt += `

CONTEXTE DE LA RÉUNION:
- Titre: ${todoData.meetings[0].title}`;
      
      if (todoData.meetings[0].summary) {
        contextPrompt += `
- Résumé: ${todoData.meetings[0].summary}`;
      }
      
      if (todoData.meetings[0].transcript) {
        contextPrompt += `
- Transcript (extrait): ${todoData.meetings[0].transcript.substring(0, 2000)}...`;
      }
    }

    if (recommendation) {
      contextPrompt += `

RECOMMANDATIONS IA EXISTANTES:
${recommendation}`;
    }

    contextPrompt += `

INSTRUCTIONS:
- Aide l'utilisateur avec sa tâche en utilisant toutes les informations disponibles
- Si besoin, suggère des améliorations ou des actions concrètes
- Reste concis et pratique
- Si tu ne peux pas répondre avec les informations disponibles, dis-le clairement
- Tu peux faire des recherches internet ou vectorielles si absolument nécessaire mais uniquement si les informations contextuelles ne suffisent pas

Réponds de manière naturelle et utile à la question de l'utilisateur.`;

    // Préparer l'historique de conversation
    const messages = [
      { role: 'system', content: contextPrompt },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ];

    console.log('🔍 Envoi requête à OpenAI...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: false
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Erreur OpenAI:', errorData);
      throw new Error(`Erreur OpenAI: ${response.status}`);
    }

    const data = await response.json();
    const assistantResponse = data.choices[0].message.content;

    console.log('✅ Réponse générée:', assistantResponse.substring(0, 100) + '...');

    return new Response(JSON.stringify({
      success: true,
      response: assistantResponse,
      updated: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Erreur assistant IA:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
