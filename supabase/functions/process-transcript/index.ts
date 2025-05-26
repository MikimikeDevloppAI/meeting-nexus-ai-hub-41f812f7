
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, participants } = await req.json();

    if (!transcript) {
      throw new Error('No transcript provided');
    }

    // Format participants list for the prompt
    const participantsList = participants.map((p: any) => p.name).join(', ');

    const prompt = `Voici un transcript brut d'un meeting administratif d'un cabinet medical.
${transcript}

remplace le speaker 1, speaker 2... par le nom du speaker en le déduisant du transcript. les partincipant sont ${participantsList}

Tu dois aussi corriger le transcript si tu vois qu'il y a eu des erreurs dans le transcript et enelever les mots d'hesitation ou inutile. créé un transcript clair, precis et mise en forme. renvoi uneiquement le transcript sans contexte et oublie pas de mettre pour la premiere pharse le speaker aussi.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${await response.text()}`);
    }

    const data = await response.json();
    const processedTranscript = data.choices[0].message.content;

    return new Response(JSON.stringify({ processedTranscript }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in process-transcript function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
