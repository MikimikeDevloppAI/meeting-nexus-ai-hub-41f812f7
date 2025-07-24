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
1. Réponds aux demandes de modification de la lettre médicale
2. Propose des améliorations basées sur le contexte médical
3. Garde un langage médical professionnel
4. Si une modification est demandée, propose le texte modifié complet
5. Explique tes modifications si nécessaire
6. Conserve les informations médicales importantes
7. Respecte la structure d'une lettre médicale

DEMANDE ACTUELLE DE L'UTILISATEUR :
${userMessage}`

    console.log('Sending request to Infomaniak API...')

    const response = await fetch('https://api.infomaniak.com/1/ai/105139/openai/chat/completions', {
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
      console.error('Infomaniak API error:', errorText)
      throw new Error(`Infomaniak API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    console.log('Infomaniak API response received')

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from Infomaniak API')
    }

    const assistantResponse = data.choices[0].message.content

    return new Response(
      JSON.stringify({ 
        success: true, 
        response: assistantResponse.trim()
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