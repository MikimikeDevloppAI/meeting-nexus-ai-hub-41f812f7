
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { todoId, userContext, todoDescription } = await req.json()
    
    if (!todoId || !userContext || !todoDescription) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Nouveau prompt amélioré et structuré
    const searchQuery = `Tu es un assistant intelligent spécialisé dans les recherches approfondies pour le cabinet d'ophtalmologie du Dr Tabibian, situé à Genève.

Tu aides principalement le personnel administratif à accomplir des tâches non médicales. Une nouvelle tâche a été générée suite à une réunion :
Tâche : ${todoDescription}
Contexte précisé par l'utilisateur : ${userContext}

Effectue une recherche approfondie, orientée vers l'action, et fournis :

des informations pratiques, fiables et directement exploitables ;

une comparaison claire (avantages/inconvénients, prix, délais) si plusieurs options existent (ex. : fournisseurs) ;

un plan d'action structuré si la tâche l'exige (ex. : organisation d'un événement, amélioration de processus) ;

des recommandations adaptées au fonctionnement d'un cabinet médical à Genève (réglementation locale, prestataires locaux, spécificités suisses).

Ne propose que des éléments utiles et concrets pour aider l'équipe à exécuter efficacement cette tâche.`

    console.log('🔍 Launching deep search for task:', todoId)
    console.log('📝 Search query:', searchQuery)

    // Appel à l'API Perplexity avec le modèle le plus puissant (Sonar Huge)
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('PERPLEXITY_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro', // Modèle le plus puissant (405B paramètres)
        messages: [
          {
            role: 'user',
            content: searchQuery
          }
        ],
        stream: false,
        temperature: 0.4,
        max_tokens: 8000, // Augmenté à 10 000 tokens
        return_images: false,
        return_related_questions: false,
        search_recency_filter: 'month',
        frequency_penalty: 1,
        presence_penalty: 0
      })
    })

    if (!perplexityResponse.ok) {
      console.error('❌ Perplexity API error:', perplexityResponse.statusText)
      throw new Error(`Perplexity API error: ${perplexityResponse.statusText}`)
    }

    const perplexityData = await perplexityResponse.json()
    const searchResult = perplexityData.choices?.[0]?.message?.content || 'Aucun résultat trouvé'
    
    // Extraire les sources/citations de la réponse Perplexity
    const sources = perplexityData.citations || []
    
    console.log('✅ Deep search completed successfully')
    console.log('📚 Sources found:', sources.length)

    // Sauvegarder dans Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabaseClient.auth.getUser(token)
      
      if (user) {
        const { error: insertError } = await supabaseClient
          .from('task_deep_searches')
          .insert({
            todo_id: todoId,
            user_context: userContext,
            search_query: searchQuery,
            search_result: searchResult,
            sources: sources,
            created_by: user.id
          })

        if (insertError) {
          console.error('❌ Error saving search result:', insertError)
        } else {
          console.log('💾 Search result saved successfully')
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        result: searchResult,
        sources: sources,
        query: searchQuery
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('❌ Deep search error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Erreur lors de la recherche deep search',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
