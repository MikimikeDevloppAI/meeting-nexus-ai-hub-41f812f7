
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
1. Reponds aux demandes de modification de la lettre medicale
2. IMPORTANT: Fournis TOUJOURS la lettre medicale complete modifiee dans ta reponse
3. Si une modification est demandee, retourne la lettre complete avec les changements appliques
4. Explique brievement les modifications que tu as effectuees
5. Garde un langage medical professionnel
6. Conserve les informations medicales importantes
7. Respecte la structure d'une lettre medicale

FORMAT DE REPONSE REQUIS :
\`\`\`
MODIFICATIONS EFFECTUEES :
[Explication courte des changements]

LETTRE MODIFIEE :
[Lettre medicale complete avec les modifications]
\`\`\`

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

    const assistantResponse = data.choices[0].message.content

    // Extraire la lettre modifiée du contenu de la réponse
    let modifiedLetter = null;
    let explanation = assistantResponse;

    // Chercher la section "LETTRE MODIFIEE :"
    const letterMatch = assistantResponse.match(/LETTRE MODIFIEE\s*:\s*([\s\S]*?)(?=\n\n|$)/i);
    if (letterMatch) {
      modifiedLetter = letterMatch[1].trim();
      
      // Extraire l'explication
      const explanationMatch = assistantResponse.match(/MODIFICATIONS EFFECTUEES\s*:\s*(.*?)(?=LETTRE MODIFIEE|$)/is);
      if (explanationMatch) {
        explanation = explanationMatch[1].trim();
      }
    }

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
