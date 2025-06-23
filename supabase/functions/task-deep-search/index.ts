import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateEnrichmentQuestions, rewriteUserContext } from './services/chatgpt-service.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { todoId, userContext, todoDescription, enrichmentAnswers, followupQuestion, deepSearchId } = await req.json()
    
    // Vérifier que la clé API Perplexity est disponible
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!perplexityKey) {
      console.error('❌ Missing PERPLEXITY_API_KEY environment variable');
      return new Response(
        JSON.stringify({ error: 'Configuration manquante: clé API Perplexity non trouvée' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!openAIKey) {
      console.error('❌ Missing OPENAI_API_KEY environment variable');
      return new Response(
        JSON.stringify({ error: 'Configuration manquante: clé API OpenAI non trouvée' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Phase nouvelle : Question de suivi
    if (followupQuestion && deepSearchId) {
      console.log('🔍 Phase Follow-up: Question de suivi avec contexte complet');
      
      try {
        // Récupérer le contexte complet de la deep search originale
        const { data: originalSearch, error: searchError } = await supabaseClient
          .from('task_deep_searches')
          .select('*')
          .eq('id', deepSearchId)
          .single();

        if (searchError || !originalSearch) {
          console.error('❌ Erreur récupération recherche originale:', searchError);
          throw new Error('Impossible de récupérer la recherche originale');
        }

        console.log('✅ Recherche originale récupérée');

        // Récupérer l'historique des questions de suivi
        const { data: followupHistory, error: followupError } = await supabaseClient
          .from('task_deep_search_followups')
          .select('question, answer, created_at')
          .eq('deep_search_id', deepSearchId)
          .order('created_at', { ascending: true });

        if (followupError) {
          console.error('❌ Erreur récupération historique suivi:', followupError);
        }

        console.log('✅ Historique récupéré:', followupHistory?.length || 0, 'questions précédentes');

        // Construire le contexte enrichi pour la question de suivi
        const enrichedContext = `
CONTEXTE COMPLET DE LA RECHERCHE ORIGINALE :

**Tâche :** ${todoDescription}
**Contexte utilisateur initial :** ${originalSearch.user_context}
**Résultat de la recherche approfondie précédente :**
${originalSearch.search_result}

${followupHistory && followupHistory.length > 0 ? `
**Historique des questions de suivi précédentes :**
${followupHistory.map((fh, index) => `
${index + 1}. Question : ${fh.question}
   Réponse : ${fh.answer}
`).join('\n')}
` : ''}

**NOUVELLE QUESTION DE SUIVI :** ${followupQuestion}

INSTRUCTIONS POUR LA RÉPONSE :
- Tu as accès à tout le contexte de la recherche précédente
- Réponds spécifiquement à la nouvelle question en t'appuyant sur ce contexte
- Si nécessaire, complète avec de nouvelles informations actualisées grâce à tes capacités de recherche
- Structure ta réponse de manière claire avec des titres et bullet points
- Reste cohérent avec les informations déjà fournies dans la recherche originale
- Utilise des recherches web récentes pour compléter tes réponses
`;

        console.log('🚀 Envoi de la question de suivi avec Perplexity Sonar Large');

        // Appel à l'API Perplexity avec llama-3.1-sonar-large-128k-online
        const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${perplexityKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-sonar-large-128k-online',
            messages: [
              {
                role: 'user',
                content: enrichedContext
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

        console.log('📡 Statut réponse Perplexity Sonar Large:', perplexityResponse.status);

        if (!perplexityResponse.ok) {
          const errorText = await perplexityResponse.text();
          console.error('❌ Perplexity API error:', perplexityResponse.status, perplexityResponse.statusText);
          console.error('❌ Détails de l\'erreur:', errorText);
          
          return new Response(
            JSON.stringify({ 
              error: `Erreur API Perplexity: ${perplexityResponse.status}`,
              details: errorText
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const perplexityData = await perplexityResponse.json()
        const followupAnswer = perplexityData.choices?.[0]?.message?.content || 'Aucune réponse trouvée'
        const followupSources = perplexityData.citations || []
        
        console.log('✅ Réponse de suivi Perplexity reçue:', followupAnswer.length, 'caractères');
        console.log('📚 Sources de suivi trouvées:', followupSources.length);

        // Sauvegarder la question/réponse de suivi avec les sources
        const authHeader = req.headers.get('Authorization')
        if (authHeader) {
          const token = authHeader.replace('Bearer ', '')
          const { data: { user } } = await supabaseClient.auth.getUser(token)
          
          if (user) {
            console.log('💾 Sauvegarde de la question de suivi avec sources...');
            const { error: insertError } = await supabaseClient
              .from('task_deep_search_followups')
              .insert({
                deep_search_id: deepSearchId,
                question: followupQuestion,
                answer: followupAnswer,
                sources: followupSources,
                created_by: user.id
              })

            if (insertError) {
              console.error('❌ Error saving followup:', insertError)
            } else {
              console.log('✅ Followup saved successfully with sources')
            }
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            phase: 'followup',
            question: followupQuestion,
            answer: followupAnswer,
            sources: followupSources
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )

      } catch (error) {
        console.error('❌ Erreur question de suivi:', error);
        return new Response(
          JSON.stringify({ 
            error: 'Erreur lors du traitement de la question de suivi',
            details: error.message 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    if (!todoId || !userContext || !todoDescription) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Phase 1: Génération des questions d'enrichissement avec ChatGPT 4.1
    if (!enrichmentAnswers) {
      console.log('🔍 Phase 1: Génération des questions avec ChatGPT 4.1');
      
      try {
        const questions = await generateEnrichmentQuestions(todoDescription, userContext, openAIKey);
        
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
      } catch (error) {
        console.error('❌ Erreur génération questions ChatGPT:', error);
        return new Response(
          JSON.stringify({ error: 'Erreur lors de la génération des questions avec ChatGPT' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Phase 2: Réécriture du contexte avec ChatGPT 4.1 puis recherche avec Perplexity Sonar Large
    console.log('🔍 Phase 2: Réécriture du contexte avec ChatGPT 4.1');
    
    try {
      // Réécrire le contexte avec ChatGPT 4.1
      const rewrittenContext = await rewriteUserContext(
        todoDescription, 
        userContext, 
        enrichmentAnswers || [], 
        openAIKey
      );

      console.log('🔍 Phase 3: Recherche finale avec Perplexity Sonar Large');
      
      // Prompt optimisé pour Perplexity avec Sonar Large
      const searchQuery = `Tu es un assistant intelligent spécialisé dans les recherches approfondies pour le cabinet d'ophtalmologie du Dr Tabibian, situé à Genève.

**Tâche :** ${todoDescription}
**Contexte enrichi :** ${rewrittenContext}

INSTRUCTIONS IMPORTANTES POUR LA RÉPONSE :
- Structure ta réponse de manière très claire avec des titres, sous-titres et bullet points
- Évite absolument les répétitions d'informations
- Organise le contenu en sections logiques avec des paragraphes distincts
- Utilise des listes à puces pour les éléments multiples (avantages, inconvénients, étapes, etc.)
- Présente les comparaisons sous forme de tableaux quand c'est approprié
- Numérote les étapes d'action de manière claire
- Sépare visuellement les différentes sections de ta réponse
- Utilise des recherches web récentes et actualisées pour fournir les informations les plus pertinentes

Effectue une recherche approfondie, orientée vers l'action, et fournis :

## 1. INFORMATIONS PRATIQUES
• Des informations fiables et directement exploitables
• Des détails spécifiques au contexte genevois/suisse si pertinent
• Des données récentes et actualisées

## 2. ANALYSE COMPARATIVE (si applicable)
• Tableau comparatif des options disponibles
• Avantages et inconvénients clairement listés
• Informations sur les prix, délais, qualité actualisées

## 3. PLAN D'ACTION STRUCTURÉ
• Étapes numérotées et chronologiques
• Responsabilités et échéances suggérées
• Points de contrôle et validations nécessaires

## 4. RECOMMANDATIONS SPÉCIFIQUES
• Adaptées au fonctionnement d'un cabinet médical à Genève
• Prise en compte de la réglementation locale actuelle
• Suggestions de prestataires locaux fiables si nécessaire

Format ta réponse de manière professionnelle, aérée et facilement scannable pour une lecture rapide et efficace.`;

      console.log('🚀 Envoi de la recherche finale avec Perplexity Sonar Large');

      // Appel à l'API Perplexity avec llama-3.1-sonar-large-128k-online
      const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-large-128k-online',
          messages: [
            {
              role: 'user',
              content: searchQuery
            }
          ],
          temperature: 0.2,
          max_tokens: 8000,
          top_p: 0.9,
          return_images: false,
          return_related_questions: false,
          search_recency_filter: 'month'
        })
      });

      console.log('📡 Perplexity API response status:', perplexityResponse.status);

      if (!perplexityResponse.ok) {
        const errorText = await perplexityResponse.text();
        console.error('❌ Perplexity API error:', perplexityResponse.status, perplexityResponse.statusText);
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
      console.log('📊 Perplexity response structure:', Object.keys(perplexityData));
      
      const searchResult = perplexityData.choices?.[0]?.message?.content || 'Aucun résultat trouvé'
      
      // Extraire les sources de la réponse Perplexity
      const sources = perplexityData.citations || []
      
      console.log('✅ Recherche Perplexity terminée avec succès')
      console.log('📚 Sources trouvées:', sources.length)
      console.log('📝 Résultat longueur:', searchResult.length, 'caractères');

      // Sauvegarder dans Supabase
      const authHeader = req.headers.get('Authorization')
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await supabaseClient.auth.getUser(token)
        
        if (user) {
          const { data: insertedSearch, error: insertError } = await supabaseClient
            .from('task_deep_searches')
            .insert({
              todo_id: todoId,
              user_context: rewrittenContext,
              search_query: searchQuery,
              search_result: searchResult,
              sources: sources,
              created_by: user.id
            })
            .select()
            .single()

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
          query: searchQuery,
          rewrittenContext: rewrittenContext
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )

    } catch (error) {
      console.error('❌ Erreur lors de la phase 2/3:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors de la réécriture du contexte ou de la recherche',
          details: error.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

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
