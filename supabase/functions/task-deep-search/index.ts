
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
- Réponds en français
- Sois spécifique et actionnable
- Utilise tes capacités de recherche web récentes
- Structure ta réponse clairement avec des titres et bullet points
- Focus sur les informations pratiques et commerciales
- Inclue des contacts, prix, délais si disponibles
`;

        console.log('🚀 Envoi de la question de suivi avec Perplexity');

        // Appel à l'API Perplexity avec le modèle optimisé
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
            temperature: 0.1,
            max_tokens: 4000,
            top_p: 0.9,
            search_domain_filter: ['*.ch', '*.com', '*.fr', '*.be'],
            search_recency_filter: 'month',
            return_images: false,
            return_related_questions: false
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

      console.log('🔍 Phase 3: Recherche finale avec Perplexity optimisé');
      
      // Prompt optimisé pour Perplexity avec recherche commerciale ciblée
      const searchQuery = `RECHERCHE COMMERCIALE SPÉCIALISÉE - Cabinet d'ophtalmologie Genève

**TÂCHE À RÉSOUDRE :** ${todoDescription}

**CONTEXTE DÉTAILLÉ :** ${rewrittenContext}

**INSTRUCTIONS DE RECHERCHE :**
Tu es un assistant commercial spécialisé dans la recherche de fournisseurs et solutions B2B pour un cabinet médical à Genève, Suisse.

**OBJECTIF :** Trouver des informations commerciales CONCRÈTES et ACTIONNABLES :

🎯 **PRIORITÉ 1 - FOURNISSEURS LOCAUX (Genève/Suisse) :**
- Entreprises, distributeurs, fournisseurs spécialisés
- Coordonnées complètes (téléphone, email, adresse)
- Services proposés et conditions commerciales

🎯 **PRIORITÉ 2 - INFORMATIONS COMMERCIALES :**
- Tarifs, prix, coûts estimés
- Conditions de vente (avec/sans abonnement, maintenance)
- Délais de livraison et installation

🎯 **PRIORITÉ 3 - ASPECTS PRATIQUES :**
- Spécifications techniques adaptées au contexte médical
- Alternatives et options disponibles
- Contraintes réglementaires ou sanitaires

**FORMAT DE RÉPONSE STRUCTURÉ :**

## 🔍 FOURNISSEURS IDENTIFIÉS
[Liste des entreprises avec coordonnées complètes]

## 💰 INFORMATIONS TARIFAIRES
[Prix, coûts, options de financement]

## 📋 SOLUTIONS RECOMMANDÉES
[Comparaison des meilleures options avec avantages/inconvénients]

## 📞 ACTIONS CONCRÈTES
[Étapes à suivre, contacts à prendre, questions à poser]

**ZONES GÉOGRAPHIQUES :** Priorité Genève > Suisse > France/Europe
**SECTEUR :** Matériel médical/bureau, équipements professionnels
**LANGUE :** Réponse complète en français`;

      console.log('🚀 Envoi de la recherche finale avec Perplexity optimisé');

      // Appel à l'API Perplexity avec modèle et paramètres optimisés
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
          temperature: 0.1,
          max_tokens: 8000,
          top_p: 0.9,
          search_domain_filter: ['*.ch', '*.com', '*.fr', '*.be', '*.de'],
          search_recency_filter: 'month',
          return_images: false,
          return_related_questions: false
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
