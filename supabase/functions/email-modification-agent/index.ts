
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      todoId, 
      todoDescription, 
      currentEmail, 
      userRequest, 
      conversationHistory,
      recommendation 
    } = await req.json();
    
    console.log('[EMAIL-MODIFICATION-AGENT] 📧 Traitement modification email:', userRequest);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Construire l'historique de conversation pour le contexte
    const historyContext = conversationHistory && conversationHistory.length > 0
      ? conversationHistory.map((msg: any) => `${msg.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${msg.content}`).join('\n')
      : '';

    const systemPrompt = `Tu es un assistant IA spécialisé dans la modification d'emails pour le cabinet d'ophtalmologie Dr Tabibian à Genève.

CONTEXTE DE LA TÂCHE :
- Tâche : ${todoDescription}
- Recommandation IA : ${recommendation}

EMAIL ACTUEL À MODIFIER :
${currentEmail}

${historyContext ? `HISTORIQUE DE CONVERSATION :\n${historyContext}` : ''}

DEMANDE DE MODIFICATION : "${userRequest}"

INSTRUCTIONS :
1. Modifie UNIQUEMENT l'email selon la demande de l'utilisateur
2. Conserve le contexte professionnel adapté au cabinet médical
3. Maintiens la cohérence avec la tâche et la recommandation
4. Assure-toi que l'email reste professionnel et pertinent
5. Si la demande n'est pas claire, propose une amélioration logique

Réponds UNIQUEMENT en JSON avec cette structure :
{
  "modifiedEmail": "email modifié complet",
  "explanation": "explication concise de ce qui a été modifié",
  "success": true
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userRequest }
        ],
        temperature: 0.7,
        max_tokens: 2048,
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
      console.error('[EMAIL-MODIFICATION-AGENT] ❌ Erreur parsing:', parseError);
      aiResponse = {
        modifiedEmail: currentEmail,
        explanation: "Impossible de traiter la demande de modification.",
        success: false
      };
    }

    console.log('[EMAIL-MODIFICATION-AGENT] ✅ Email modifié avec succès');

    return new Response(JSON.stringify(aiResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[EMAIL-MODIFICATION-AGENT] ❌ ERREUR:', error);
    
    return new Response(JSON.stringify({
      error: error.message,
      modifiedEmail: null,
      explanation: "Erreur lors de la modification de l'email",
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
