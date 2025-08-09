
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { userMessage, rawTranscript, letterContent, chatHistory } = await req.json()

    if (!userMessage) {
      throw new Error('Message utilisateur requis')
    }

    const INFOMANIAK_API_KEY = Deno.env.get('INFOMANIAK_API_KEY')
    if (!INFOMANIAK_API_KEY) {
      throw new Error('INFOMANIAK_API_KEY is not configured')
    }

    // NEW: Allow configuring the Infomaniak App/Workspace ID via secret
    const INFOMANIAK_APP_ID = Deno.env.get('INFOMANIAK_APP_ID') || '105139'
    if (!Deno.env.get('INFOMANIAK_APP_ID')) {
      console.warn('[medical-letter-chat] INFOMANIAK_APP_ID not set, using default 105139')
    }
    const apiUrl = `https://api.infomaniak.com/1/ai/${INFOMANIAK_APP_ID}/openai/chat/completions`

    // Construire le contexte avec l'historique et le contenu actuel
    let contextPrompt = `Tu es un assistant spécialisé dans l'édition et la modification de lettres médicales pour un cabinet d'ophtalmologie.

CONTEXTE ACTUEL :

TRANSCRIPT BRUT :
${rawTranscript || "Aucun transcript disponible"}

LETTRE MÉDICALE ACTUELLE :
${letterContent || "Aucune lettre disponible"}

HISTORIQUE DE LA CONVERSATION :`

    // Ajouter l'historique de conversation
    if (chatHistory && chatHistory.length > 0) {
      chatHistory.forEach((msg: any) => {
        contextPrompt += `\n${msg.role === 'user' ? 'UTILISATEUR' : 'ASSISTANT'}: ${msg.content}`
      })
    } else {
      contextPrompt += "\nAucun historique de conversation"
    }

    contextPrompt += `

INSTRUCTIONS :
1. Réponds aux demandes de modification de la lettre médicale.
2. IMPORTANT: Réponds UNIQUEMENT en JSON valide (UTF-8), sans encadrer avec des blocs de code (pas de ```).
3. Le JSON DOIT contenir exactement ces clés: "modifications" (string courte) et "letter" (string avec la lettre complète modifiée).
4. Fournis TOUJOURS la lettre médicale complète modifiée dans le champ "letter".
5. Explique brièvement les modifications dans le champ "modifications".
6. Adopte un langage médical professionnel, conserve les informations importantes et respecte la structure d'une lettre médicale.

FORMAT DE RÉPONSE REQUIS (JSON STRICT, SANS BLOC DE CODE):
{"modifications":"...","letter":"..."}

DEMANDE ACTUELLE DE L'UTILISATEUR :
${userMessage}`

    console.log('[medical-letter-chat] Sending request to Infomaniak API...', { appId: INFOMANIAK_APP_ID, model: 'llama3' })

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${INFOMANIAK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3',
        messages: [
          {
            role: 'user',
            content: contextPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[medical-letter-chat] Infomaniak API error:', response.status, errorText)
      throw new Error(`Infomaniak API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    console.log('[medical-letter-chat] Infomaniak API response received')

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from Infomaniak API')
    }

    const assistantResponse = data.choices[0].message.content || ''

    // Tenter d'abord de parser une réponse JSON stricte
    let modifiedLetter: string | null = null;
    let explanation: string = assistantResponse;

    const stripCodeFences = (s: string) => {
      const m = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
      return m ? m[1] : s;
    };

    try {
      const jsonText = stripCodeFences(assistantResponse).trim();
      const parsed = JSON.parse(jsonText);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.letter === 'string') {
          modifiedLetter = parsed.letter.trim();
        }
        if (typeof parsed.modifications === 'string') {
          explanation = parsed.modifications.trim();
        }
      }
    } catch (_e) {
      // Fallback regex si JSON non valide
      const letterMatch = assistantResponse.match(/LETTRE MODIFI(?:É|E)E\s*:\s*([\s\S]*)$/i);
      if (letterMatch) {
        modifiedLetter = letterMatch[1].replace(/```/g, '').trim();
      }
      const explanationMatch = assistantResponse.match(/MODIFICATIONS EFFECTU(?:É|E)ES\s*:\s*([\s\S]*?)(?=LETTRE MODIFI(?:É|E)E|$)/i);
      if (explanationMatch) {
        explanation = explanationMatch[1].replace(/```/g, '').trim();
      }
    }

    if (!modifiedLetter || modifiedLetter.length === 0) {
      // Dernier recours: prendre tout après "LETTRE MODIFI"
      const fallback = assistantResponse.split(/LETTRE MODIFI(?:É|E)E\s*:\s*/i)[1];
      if (fallback) {
        modifiedLetter = fallback.replace(/```/g, '').trim();
      }
    }

    console.log('[medical-letter-chat] Extracted lengths', { letterLength: modifiedLetter?.length || 0, explanationLength: explanation?.length || 0 });
    return new Response(
      JSON.stringify({ 
        success: true, 
        response: explanation,
        modifiedLetter: modifiedLetter
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in medical-letter-chat function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
