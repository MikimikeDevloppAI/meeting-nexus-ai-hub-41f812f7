
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
    const { todoId, userContext, todoDescription, enrichmentAnswers } = await req.json()
    
    if (!todoId || !userContext || !todoDescription) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Vérifier que la clé API Perplexity est disponible
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!perplexityApiKey) {
      console.error('❌ Missing PERPLEXITY_API_KEY environment variable');
      return new Response(
        JSON.stringify({ error: 'Configuration manquante: clé API Perplexity non trouvée' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Phase 1: Générer des questions d'enrichissement (obligatoire maintenant)
    if (!enrichmentAnswers) {
      console.log('🔍 Phase 1: Génération des questions d\'enrichissement (obligatoire)');
      
      const questionsPrompt = `Tu es un assistant spécialisé pour le cabinet d'ophtalmologie du Dr Tabibian à Genève.

Une tâche a été créée suite à une réunion : "${todoDescription}"
L'utilisateur souhaite approfondir avec ce contexte : "${userContext}"

Génère des questions d'enrichissement PRATIQUES ET FACILES À RÉPONDRE si nécessaire qui permettront d'affiner la recherche.Maximum 5 questions. Ces questions doivent être :

1. **SIMPLES et DIRECTES** - L'utilisateur ne doit pas faire de recherches pour répondre
2. **PRATIQUES** - Focalisées sur les aspects opérationnels (budget, délai, priorité, contraintes)
3. **SPÉCIFIQUES au contexte médical/administratif** d'un cabinet d'ophtalmologie à Genève
4. **ORIENTÉES ACTION** - Pour aider à prendre des décisions concrètes

Exemples de bonnes questions :
- Quel est le budget approximatif disponible pour cette action ?
- Dans quel délai cette tâche doit-elle être réalisée ?
- Y a-t-il des contraintes particulières à respecter (réglementaires, logistiques, etc.) ?
- Quelle est la priorité de cette tâche par rapport aux autres projets du cabinet ?
- Qui sera responsable de la mise en œuvre de cette solution ?

Adapte ces exemples au contexte spécifique de la tâche demandée.

Format ta réponse UNIQUEMENT avec les 4 questions, une par ligne, sans numérotation ni formatage spécial.`;

      const questionsResponse = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [
            {
              role: 'user',
              content: questionsPrompt
            }
          ],
          temperature: 0.2,
          max_tokens: 600,
          top_p: 0.9,
          return_images: false,
          return_related_questions: false,
          search_recency_filter: 'month'
        })
      });

      if (!questionsResponse.ok) {
        console.error('❌ Erreur génération questions:', questionsResponse.status);
        return new Response(
          JSON.stringify({ error: 'Erreur lors de la génération des questions' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const questionsData = await questionsResponse.json();
      const questionsText = questionsData.choices?.[0]?.message?.content || '';
      const questions = questionsText.split('\n').filter(q => q.trim().length > 0).slice(0, 4);

      console.log('✅ Questions générées:', questions.length);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          phase: 'questions',
          questions: questions
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Phase 2: Recherche finale avec contexte enrichi
    console.log('🔍 Phase 2: Recherche finale avec Sonar Pro');
    
    let enrichedContext = userContext;
    if (enrichmentAnswers && enrichmentAnswers.length > 0) {
      enrichedContext += '\n\nRÉPONSES AUX QUESTIONS D\'ENRICHISSEMENT:\n';
      enrichedContext += enrichmentAnswers.map((answer: any, index: number) => 
        `${index + 1}. ${answer.question}\nRéponse: ${answer.answer}`
      ).join('\n\n');
    }

    // Prompt optimisé pour Sonar Pro
    const searchQuery = `Tu es un assistant intelligent spécialisé dans les recherches approfondies pour le cabinet d'ophtalmologie du Dr Tabibian, situé à Genève.

Tu aides principalement le personnel administratif à accomplir des tâches non médicales. Une nouvelle tâche a été générée suite à une réunion :

**Tâche :** ${todoDescription}
**Contexte détaillé :** ${enrichedContext}

INSTRUCTIONS IMPORTANTES POUR LA RÉPONSE :
- Structure ta réponse de manière très claire avec des titres, sous-titres et bullet points
- Évite absolument les répétitions d'informations
- Organise le contenu en sections logiques avec des paragraphes distincts
- Utilise des listes à puces pour les éléments multiples (avantages, inconvénients, étapes, etc.)
- Présente les comparaisons sous forme de tableaux quand c'est approprié
- Numérote les étapes d'action de manière claire
- Sépare visuellement les différentes sections de ta réponse

Effectue une recherche approfondie, orientée vers l'action, et fournis :

## 1. INFORMATIONS PRATIQUES
• Des informations fiables et directement exploitables
• Des détails spécifiques au contexte genevois/suisse si pertinent

## 2. ANALYSE COMPARATIVE (si applicable)
• Tableau comparatif des options disponibles
• Avantages et inconvénients clairement listés
• Informations sur les prix, délais, qualité

## 3. PLAN D'ACTION STRUCTURÉ
• Étapes numérotées et chronologiques
• Responsabilités et échéances suggérées
• Points de contrôle et validations nécessaires

## 4. RECOMMANDATIONS SPÉCIFIQUES
• Adaptées au fonctionnement d'un cabinet médical à Genève
• Prise en compte de la réglementation locale
• Suggestions de prestataires locaux fiables

Format ta réponse de manière professionnelle, aérée et facilement scannable pour une lecture rapide et efficace.`;

    console.log('🚀 Envoi de la recherche finale avec Sonar Pro');

    // Appel à l'API Perplexity avec le modèle sonar-pro
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'user',
            content: searchQuery
          }
        ],
        temperature: 0.2,
        max_tokens: 4000,
        top_p: 0.9,
        return_images: false,
        return_related_questions: false,
        search_recency_filter: 'month'
      })
    });

    console.log('📡 Sonar Pro API response status:', perplexityResponse.status);

    if (!perplexityResponse.ok) {
      const errorText = await perplexityResponse.text();
      console.error('❌ Sonar Pro API error:', perplexityResponse.status, perplexityResponse.statusText);
      console.error('❌ Error details:', errorText);
      
      return new Response(
        JSON.stringify({ 
          error: `Erreur API Perplexity: ${perplexityResponse.status} ${perplexityResponse.statusText}`,
          details: errorText
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const perplexityData = await perplexityResponse.json()
    console.log('📊 Sonar Pro response structure:', Object.keys(perplexityData));
    
    const searchResult = perplexityData.choices?.[0]?.message?.content || 'Aucun résultat trouvé'
    
    // Extraire les sources/citations de la réponse Perplexity
    const sources = perplexityData.citations || perplexityData.sources || []
    
    console.log('✅ Recherche Sonar Pro terminée avec succès')
    console.log('📚 Sources trouvées:', sources.length)
    console.log('📝 Résultat longueur:', searchResult.length, 'caractères');

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
            user_context: enrichedContext,
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
        phase: 'result',
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
