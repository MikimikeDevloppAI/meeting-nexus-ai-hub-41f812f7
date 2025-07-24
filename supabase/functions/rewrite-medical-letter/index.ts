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
    const { transcript } = await req.json()

    if (!transcript) {
      throw new Error('Transcript is required')
    }

    const INFOMANIAK_API_KEY = Deno.env.get('INFOMANIAK_API_KEY')
    if (!INFOMANIAK_API_KEY) {
      throw new Error('INFOMANIAK_API_KEY is not configured')
    }

    // Prompt pour réécrire le contenu médical
    const prompt = `Tu es un assistant spécialisé dans la rédaction de lettres médicales pour un cabinet d'ophtalmologie.

INSTRUCTIONS STRICTES :
1. RÉÉCRIS le transcript en tant que lettre médicale professionnelle
2. CONSERVE toutes les informations médicales importantes
3. SUPPRIME les mots d'hésitation ("euh", "hm", "ben", "alors", "donc", "voilà", etc.)
4. SUPPRIME les phrases d'introduction ou de transition non médicales ("ça c'est une lettre pour", "il faudrait", etc.)
5. CORRIGE les erreurs de transcription évidentes
6. STRUCTURE le texte en paragraphes cohérents et distincts si nécessaire
7. UTILISE un langage médical approprié et professionnel
8. GARDE la chronologie des événements médicaux
9. ORGANISE les informations par paragraphes logiques (diagnostic, traitement, recommandations, etc.)

NE PAS :
- Ajouter d'informations qui ne sont pas dans le transcript
- Paraphraser ou résumer
- Changer le sens médical
- Inventer des détails

Transcript à réécrire :
${transcript}

Réponds UNIQUEMENT avec la lettre médicale réécrite, sans commentaires.`

    console.log('Sending request to Infomaniak API...')

    const response = await fetch('https://api.infomaniak.com/1/ai/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${INFOMANIAK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'DeepSeek-R1-distilled-qwen-32B',
        messages: [
          {
            role: 'user',
            content: prompt
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

    const rewrittenContent = data.choices[0].message.content

    return new Response(
      JSON.stringify({ 
        success: true, 
        rewrittenContent: rewrittenContent.trim()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in rewrite-medical-letter function:', error)
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