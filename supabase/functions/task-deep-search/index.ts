
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
    
    // Vérifier que les clés API sont disponibles
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!perplexityApiKey) {
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

    // Phase nouvelle : Question de suivi avec Perplexity
    if (followupQuestion && deepSearchId) {
      console.log('🔍 Phase Follow-up: Question de suivi avec Perplexity');
      
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

        // Appel à Perplexity avec le nouveau format
        console.log('🚀 Recherche de suivi avec Perplexity');

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
                role: 'system',
                content: `Tu es un assistant de recherche intelligent spécialisé dans l'analyse approfondie. 

CONTEXTE ORIGINAL: ${originalSearch.user_context}
RÉSULTAT PRÉCÉDENT: ${originalSearch.search_result}

Ta mission est de répondre à la question de suivi en français de manière structurée et actionnable, en utilisant tes capacités de recherche web pour trouver les informations les plus récentes et pertinentes.

STRUCTURE DE RÉPONSE ATTENDUE:
1. **RÉSUMÉ EXÉCUTIF** - Point clé en 2-3 phrases
2. **INFORMATIONS PRINCIPALES** - Détails structurés avec titres
3. **SOURCES ET LIENS** - URLs des sources pertinentes intégrées naturellement
4. **ACTIONS RECOMMANDÉES** - Étapes concrètes à suivre

Réponds en français, de manière claire et actionnable.`
              },
              {
                role: 'user',
                content: followupQuestion
              }
            ],
            max_tokens: 4000,
            temperature: 0.3,
            search_recency_filter: 'month',
            return_images: false,
            return_related_questions: false,
            frequency_penalty: 1,
            presence_penalty: 0
          })
        });

        console.log('📡 Statut réponse Perplexity:', perplexityResponse.status);

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

        const perplexityData = await perplexityResponse.json();
        const followupAnswer = perplexityData.choices?.[0]?.message?.content || 'Aucune réponse trouvée';
        
        console.log('✅ Réponse de suivi générée par Perplexity:', followupAnswer.length, 'caractères');

        // Sauvegarder la question/réponse de suivi
        const authHeader = req.headers.get('Authorization')
        if (authHeader) {
          const token = authHeader.replace('Bearer ', '')
          const { data: { user } } = await supabaseClient.auth.getUser(token)
          
          if (user) {
            console.log('💾 Sauvegarde de la question de suivi...');
            const { error: insertError } = await supabaseClient
              .from('task_deep_search_followups')
              .insert({
                deep_search_id: deepSearchId,
                question: followupQuestion,
                answer: followupAnswer,
                sources: [], // Sources intégrées dans la réponse Perplexity
                created_by: user.id
              })

            if (insertError) {
              console.error('❌ Error saving followup:', insertError)
            } else {
              console.log('✅ Followup saved successfully')
            }
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            phase: 'followup',
            question: followupQuestion,
            answer: followupAnswer,
            sources: [] // Sources intégrées dans la réponse Perplexity
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

    // Phase 1: Génération des questions d'enrichissement avec ChatGPT
    if (!enrichmentAnswers) {
      console.log('🔍 Phase 1: Génération des questions avec ChatGPT');
      
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

    // Phase 2: Réécriture du contexte avec ChatGPT puis recherche avec Perplexity
    console.log('🔍 Phase 2: Réécriture du contexte avec ChatGPT');
    
    try {
      // Réécrire le contexte avec ChatGPT
      const rewrittenContext = await rewriteUserContext(
        todoDescription, 
        userContext, 
        enrichmentAnswers || [], 
        openAIKey
      );

      console.log('🔍 Phase 3: Recherche finale avec Perplexity');

      // Appel à Perplexity avec le nouveau format
      console.log('🚀 Recherche intelligente avec Perplexity');

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
              role: 'system',
              content: `Tu es un assistant de recherche intelligent spécialisé dans l'analyse et la synthèse d'informations web récentes.

MISSION: Créer une réponse complète et structurée basée sur une recherche web approfondie et récente.

TYPES DE RÉPONSES POSSIBLES:
🎯 **PLAN D'ACTION** si c'est une demande de planification
📋 **RECHERCHE SPÉCIALISÉE** si c'est une recherche d'informations spécifiques  
🛒 **RECHERCHE FOURNISSEURS** si c'est une recherche commerciale
📊 **ANALYSE COMPARATIVE** si c'est une comparaison
💡 **RECOMMANDATIONS** si c'est une demande de conseils

STRUCTURE DE RÉPONSE ATTENDUE:
1. **RÉSUMÉ EXÉCUTIF** - Point clé en 2-3 phrases
2. **INFORMATIONS PRINCIPALES** - Détails structurés avec titres
3. **SOURCES ET LIENS** - URLs des sources pertinentes intégrées naturellement
4. **ACTIONS RECOMMANDÉES** - Étapes concrètes à suivre

EXIGENCES:
- Réponse en français, claire et actionnable
- Structure avec titres (##) et listes à puces
- Inclue les URLs pertinentes en format markdown
- Focus sur les informations pratiques, récentes et vérifiables
- Adapte le style selon le type de demande
- Privilégie les informations du dernier mois quand c'est pertinent`
            },
            {
              role: 'user',
              content: `TÂCHE: ${todoDescription}

CONTEXTE ENRICHI: ${rewrittenContext}

Effectue une recherche web approfondie et fournis une analyse complète et structurée pour répondre à cette demande. Concentre-toi sur les informations récentes et pertinentes.`
            }
          ],
          max_tokens: 4000,
          temperature: 0.3,
          search_recency_filter: 'month',
          return_images: false,
          return_related_questions: false,
          frequency_penalty: 1,
          presence_penalty: 0
        })
      });

      console.log('📡 Statut réponse Perplexity:', perplexityResponse.status);

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
        )
      }

      const perplexityData = await perplexityResponse.json();
      const searchResult = perplexityData.choices?.[0]?.message?.content || 'Aucun résultat trouvé';
      
      console.log('✅ Recherche Perplexity terminée avec succès');
      console.log('📝 Résultat longueur:', searchResult.length, 'caractères');

      // Les sources sont intégrées dans la réponse de Perplexity
      const sources: string[] = [];

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
              search_query: `${todoDescription} - ${rewrittenContext}`,
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
          query: `${todoDescription} - ${rewrittenContext}`,
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
          error: 'Erreur lors de la réécriture du contexte ou de la recherche Perplexity',
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
