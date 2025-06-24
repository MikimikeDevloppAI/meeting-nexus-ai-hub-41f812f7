
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
    const jinaApiKey = Deno.env.get('JINA_API_KEY');
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!jinaApiKey) {
      console.error('❌ Missing JINA_API_KEY environment variable');
      return new Response(
        JSON.stringify({ error: 'Configuration manquante: clé API Jina AI non trouvée' }),
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

        // Construire la query de recherche pour Jina AI
        const jinaSearchQuery = `${originalSearch.user_context}\n\n${followupQuestion}`;

        console.log('🚀 Recherche de suivi avec Jina AI');

        // Recherche web avec Jina AI
        const jinaResponse = await fetch('https://s.jina.ai/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${jinaApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: jinaSearchQuery,
            count: 10,
            lang: 'fr'
          })
        });

        console.log('📡 Statut réponse Jina AI:', jinaResponse.status);

        if (!jinaResponse.ok) {
          const errorText = await jinaResponse.text();
          console.error('❌ Jina AI API error:', jinaResponse.status, jinaResponse.statusText);
          console.error('❌ Détails de l\'erreur:', errorText);
          
          return new Response(
            JSON.stringify({ 
              error: `Erreur API Jina AI: ${jinaResponse.status}`,
              details: errorText
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const jinaData = await jinaResponse.json();
        console.log('✅ Données Jina AI reçues:', jinaData.data?.length || 0, 'résultats');

        // Synthèse avec ChatGPT
        const synthesisPrompt = `SYNTHÈSE DE RECHERCHE WEB POUR QUESTION DE SUIVI

CONTEXTE ORIGINAL:
${originalSearch.user_context}

RÉSULTAT PRÉCÉDENT:
${originalSearch.search_result}

NOUVELLE QUESTION: ${followupQuestion}

RÉSULTATS DE RECHERCHE WEB:
${jinaData.data?.map((result: any, index: number) => `
${index + 1}. ${result.title}
   URL: ${result.url}
   Contenu: ${result.content?.substring(0, 500) || 'Pas de contenu'}
`).join('\n') || 'Aucun résultat trouvé'}

INSTRUCTIONS:
- Réponds en français de manière structurée et actionnable
- Focus sur la nouvelle question en t'appuyant sur le contexte
- Utilise les résultats de recherche pour enrichir ta réponse
- Inclue des liens vers les sources pertinentes
- Structure avec des titres et bullet points
- Fournis des informations pratiques et concrètes`;

        const synthesisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'user', content: synthesisPrompt }
            ],
            temperature: 0.2,
            max_tokens: 2000,
          }),
        });

        if (!synthesisResponse.ok) {
          throw new Error(`Erreur synthèse ChatGPT: ${synthesisResponse.status}`);
        }

        const synthesisData = await synthesisResponse.json();
        const followupAnswer = synthesisData.choices?.[0]?.message?.content || 'Aucune réponse trouvée';
        const followupSources = jinaData.data?.map((result: any) => result.url) || [];
        
        console.log('✅ Réponse de suivi générée:', followupAnswer.length, 'caractères');
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

    // Phase 2: Réécriture du contexte avec ChatGPT puis recherche avec Jina AI
    console.log('🔍 Phase 2: Réécriture du contexte avec ChatGPT');
    
    try {
      // Réécrire le contexte avec ChatGPT
      const rewrittenContext = await rewriteUserContext(
        todoDescription, 
        userContext, 
        enrichmentAnswers || [], 
        openAIKey
      );

      console.log('🔍 Phase 3: Recherche finale avec Jina AI');
      
      // Construction de la query optimisée pour Jina AI
      const jinaSearchQuery = `${todoDescription} ${rewrittenContext}`;

      console.log('🚀 Recherche web avec Jina AI');

      // Recherche web avec Jina AI
      const jinaResponse = await fetch('https://s.jina.ai/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jinaApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: jinaSearchQuery,
          count: 15,
          lang: 'fr'
        })
      });

      console.log('📡 Statut réponse Jina AI:', jinaResponse.status);

      if (!jinaResponse.ok) {
        const errorText = await jinaResponse.text();
        console.error('❌ Jina AI API error:', jinaResponse.status, jinaResponse.statusText);
        console.error('❌ Détails de l\'erreur:', errorText);
        
        return new Response(
          JSON.stringify({ 
            error: `Erreur API Jina AI: ${jinaResponse.status}`,
            details: errorText
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const jinaData = await jinaResponse.json();
      console.log('✅ Données Jina AI reçues:', jinaData.data?.length || 0, 'résultats');
      
      // Synthèse intelligente avec ChatGPT
      const synthesisPrompt = `SYNTHÈSE INTELLIGENTE DE RECHERCHE WEB

TÂCHE: ${todoDescription}
CONTEXTE: ${rewrittenContext}

RÉSULTATS DE RECHERCHE WEB:
${jinaData.data?.map((result: any, index: number) => `
${index + 1}. ${result.title}
   URL: ${result.url}
   Contenu: ${result.content?.substring(0, 600) || 'Pas de contenu'}
`).join('\n') || 'Aucun résultat trouvé'}

MISSION:
Tu es un assistant intelligent spécialisé dans l'analyse et la synthèse d'informations. 
Crée une réponse complète et structurée basée sur la recherche web.

TYPES DE RÉPONSES POSSIBLES:
🎯 **PLAN D'ACTION** si c'est une demande de planification
📋 **RECHERCHE SPÉCIALISÉE** si c'est une recherche d'informations spécifiques  
🛒 **RECHERCHE FOURNISSEURS** si c'est une recherche commerciale
📊 **ANALYSE COMPARATIVE** si c'est une comparaison
💡 **RECOMMANDATIONS** si c'est une demande de conseils

STRUCTURE DE RÉPONSE:
1. **RÉSUMÉ EXÉCUTIF** - Point clé en 2-3 phrases
2. **INFORMATIONS PRINCIPALES** - Détails structurés avec titres
3. **SOURCES ET LIENS** - URLs des sources pertinentes  
4. **ACTIONS RECOMMANDÉES** - Étapes concrètes à suivre

EXIGENCES:
- Réponse en français, claire et actionnable
- Utilise les données de recherche web comme sources principales
- Structure avec titres (##) et listes à puces
- Inclue les URLs pertinentes en format markdown
- Focus sur les informations pratiques et vérifiables
- Adapte le style selon le type de demande`;

      const synthesisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'user', content: synthesisPrompt }
          ],
          temperature: 0.3,
          max_tokens: 3000,
        }),
      });

      if (!synthesisResponse.ok) {
        const errorText = await synthesisResponse.text();
        console.error('❌ Erreur synthèse ChatGPT:', synthesisResponse.status, errorText);
        throw new Error(`Erreur synthèse ChatGPT: ${synthesisResponse.status}`);
      }

      const synthesisData = await synthesisResponse.json();
      const searchResult = synthesisData.choices?.[0]?.message?.content || 'Aucun résultat trouvé';
      
      // Extraire les sources des résultats Jina AI
      const sources = jinaData.data?.map((result: any) => result.url) || [];
      
      console.log('✅ Recherche Jina AI + synthèse terminée avec succès');
      console.log('📚 Sources trouvées:', sources.length);
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
              search_query: jinaSearchQuery,
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
          query: jinaSearchQuery,
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
