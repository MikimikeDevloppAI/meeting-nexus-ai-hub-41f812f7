import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { DatabaseAgent } from './agents/database.ts';
import { EmbeddingsAgent } from './agents/embeddings.ts';
import { TaskAgent } from './agents/tasks.ts';
import { CoordinatorAgent } from './agents/coordinator.ts';
import { SynthesisAgent } from './agents/synthesis.ts';
import { InternetAgent } from './agents/internet.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const apiKey = Deno.env.get('OPENAI_API_KEY');
const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');

if (!apiKey || !supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');
  Deno.exit(1);
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabaseClient = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, context = {}, conversationHistory = [] } = await req.json();

    // Initialize agents
    const database = new DatabaseAgent(supabaseClient);
    const embeddings = new EmbeddingsAgent(apiKey, supabaseClient);
    const taskAgent = new TaskAgent(supabaseClient);
    const coordinator = new CoordinatorAgent(apiKey);
    const synthesis = new SynthesisAgent(apiKey);
    const internet = new InternetAgent(perplexityApiKey || '');

    console.log('[AI-AGENT-CABINET-MEDICAL] ✉️ Message reçu:', message.substring(0, 100));
    console.log('[AI-AGENT-CABINET-MEDICAL] 📎 Message complet length:', message.length);
    if (message.includes('FICHIER JOINT')) {
      console.log('[AI-AGENT-CABINET-MEDICAL] 📎 ATTACHMENTS DETECTED dans le message!');
    }
    console.log('[AI-AGENT-CABINET-MEDICAL] 👤 Context utilisateur:', context.userId || 'Non fourni');
    console.log('[AI-AGENT-CABINET-MEDICAL] 🔧 Fonctionnalités activées:', {
      database: context.databaseSearch !== false,
      documents: context.documentSearch !== false,
      internet: context.internetSearch !== false,
      todo: context.todoManagement !== false,
      meetingPoints: context.meetingPoints !== false
    });
    console.log('[AI-AGENT-CABINET-MEDICAL] 📜 Historique conversation:', conversationHistory.length, 'messages');

    // 🎯 DÉTECTION SPÉCIALE : Mode recherche de documents AMÉLIORÉ (moins restrictif)
    if (context.documentSearchMode && !context.databaseSearch && !context.internetSearch && !context.todoManagement && !context.meetingPoints) {
      console.log('[AI-AGENT-CABINET-MEDICAL] 🔍 MODE RECHERCHE DOCUMENTS AMÉLIORÉ - Plus flexible et contextuel');
      
      const embeddingsResult = await embeddings.searchEmbeddings(message, {
        priority: 'embeddings',
        embeddings: true,
        database: false,
        tasks: false,
        internet: false,
        queryType: 'document',
        confidence: 0.7 // Réduit de 0.9 à 0.7
      }, [], conversationHistory);

      console.log('[AI-AGENT-CABINET-MEDICAL] 📊 Résultats embeddings:', embeddingsResult.chunks?.length || 0, 'chunks trouvés');

      let response = '';
      let actuallyUsedDocuments: string[] = [];
      
      // VÉRIFICATION ASSOUPLIE : Accepter même des résultats avec score modéré
      if (!embeddingsResult.hasRelevantContext || embeddingsResult.chunks.length === 0) {
        console.log('[AI-AGENT-CABINET-MEDICAL] ⚠️ AUCUN CHUNK PERTINENT - Réponse encourageant reformulation');
        response = 'Je n\'ai pas trouvé d\'informations directement liées à votre question dans les documents du cabinet. Pourriez-vous reformuler votre demande ou utiliser des termes plus spécifiques ? Par exemple, si vous cherchez des informations sur les yeux, essayez "paupières", "hygiène oculaire" ou "soins des yeux".';
        
        return new Response(
          JSON.stringify({ 
            response,
            sources: [],
            actuallyUsedDocuments: [],
            hasRelevantContext: false,
            searchIterations: embeddingsResult.searchIterations || 0,
            conversationLength: conversationHistory.length,
            debugInfo: {
              totalChunks: 0,
              totalSources: 0,
              usedDocsCount: 0,
              restrictionMode: 'FLEXIBLE_DOCUMENTS_SEARCH'
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Construire le contexte pour OpenAI sans les IDs des documents
      const contextText = embeddingsResult.chunks.slice(0, 10).map((chunk, index) => { // Augmenté de 5 à 10 chunks
        return `Document: ${chunk.document_name || 'Inconnu'}\nContenu: ${chunk.chunk_text}`;
      }).join('\n\n---\n\n');

      // Construire l'historique de conversation
      const conversationContext = conversationHistory.length > 0
        ? '\n\nHISTORIQUE DE CONVERSATION:\n' + 
          conversationHistory.slice(-8).map((msg: any) => `${msg.isUser ? 'Utilisateur' : 'Assistant'}: ${msg.content}`).join('\n')
        : '';

      // PROMPT ASSOUPLI pour permettre plus d'interprétation contextuelle
      const prompt = `Tu es l'assistant IA spécialisé OphtaCare pour le cabinet d'ophtalmologie Dr Tabibian à Genève.

🎯 TES CAPACITÉS ÉTENDUES :
- Tu peux analyser et interpréter les documents du cabinet de manière contextuelle
- Tu peux faire des liens logiques entre les informations disponibles
- Tu peux reformuler et adapter les informations des documents selon le contexte
- Tu peux suggérer des termes alternatifs si la recherche initiale n'est pas optimale

IMPORTANTES INSTRUCTIONS POUR LES RÉPONSES :
- Base-toi PRINCIPALEMENT sur le contenu des documents fournis ci-dessous
- Tu peux faire des liens contextuels intelligents (ex: yeux/paupières, chirurgie/laser)
- Si l'information exacte n'est pas dans les documents, explique ce que tu as trouvé de plus proche
- Suggère des reformulations si la recherche pourrait être améliorée
- Tu peux utiliser tes connaissances pour clarifier les termes médicaux des documents
- Ne mentionne JAMAIS les identifiants techniques des documents (Document ID, UUID, etc.)
- Réfère-toi aux documents uniquement par leur nom ou titre

✅ APPROCHE RECOMMANDÉE :
- Analyse d'abord les documents disponibles pour trouver des informations pertinentes
- Fais des liens contextuels intelligents (hygiène des yeux = hygiène paupières)
- Explique clairement ce que tu as trouvé et comment c'est lié à la question
- Propose des suggestions pour affiner la recherche si nécessaire

IMPORTANT POUR LES SOURCES :
Base-toi sur les documents fournis et fournis une réponse claire et utile basée sur leur contenu. Ne mentionne jamais les identifiants techniques ou UUID des documents.

Question de l'utilisateur: "${message}"

CONTEXTE CONVERSATIONNEL:${conversationContext}

CONTEXTE DES DOCUMENTS DU CABINET :
${contextText}

Réponds en te basant sur les documents fournis, en faisant des liens contextuels intelligents et en expliquant clairement ce que tu as trouvé.`;

        console.log('[AI-AGENT-CABINET-MEDICAL] 🔒 Envoi à OpenAI avec prompt ASSOUPLI ET CONTEXTUEL');

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4.1-2025-04-14',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3, // Température modérée pour permettre l'interprétation
            max_tokens: 16384,
          }),
        });

        if (openaiResponse.ok) {
          const data = await openaiResponse.json();
          const fullResponse = data.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu générer une réponse basée sur les documents.';
          
          console.log('[AI-AGENT-CABINET-MEDICAL] 📝 RÉPONSE GÉNÉRÉE AVEC SUCCÈS');
          
          // Utiliser tous les documents trouvés comme sources
          actuallyUsedDocuments = [...new Set(embeddingsResult.chunks.slice(0, 5).map(chunk => chunk.document_id))];
          response = fullResponse;
          
          console.log('[AI-AGENT-CABINET-MEDICAL] 📄 Documents explicitement utilisés extraits:', actuallyUsedDocuments);
          console.log('[AI-AGENT-CABINET-MEDICAL] 📝 Réponse nettoyée (premiers 200 chars):', response.substring(0, 200));
        } else {
          console.error('[AI-AGENT-CABINET-MEDICAL] ❌ Erreur OpenAI:', await openaiResponse.text());
          response = 'Je n\'ai pas pu traiter votre demande en me basant sur les documents disponibles. Veuillez réessayer.';
          actuallyUsedDocuments = [];
        }

      console.log('[AI-AGENT-CABINET-MEDICAL] 🎯 RÉSULTAT FINAL ASSOUPLI:');
      console.log('- Documents utilisés:', actuallyUsedDocuments.length);
      console.log('- Sources disponibles:', embeddingsResult.sources?.length || 0);
      console.log('- Chunks trouvés:', embeddingsResult.chunks?.length || 0);
      console.log('- Mode restriction:', 'FLEXIBLE_CONTEXTUAL');

      return new Response(
        JSON.stringify({ 
          response,
          sources: embeddingsResult.sources || [],
          actuallyUsedDocuments,
          hasRelevantContext: embeddingsResult.hasRelevantContext,
          searchIterations: embeddingsResult.searchIterations || 0,
          conversationLength: conversationHistory.length,
          debugInfo: {
            totalChunks: embeddingsResult.chunks?.length || 0,
            totalSources: embeddingsResult.sources?.length || 0,
            usedDocsCount: actuallyUsedDocuments.length,
            restrictionMode: 'FLEXIBLE_CONTEXTUAL',
            promptUsed: 'CONTEXTUAL_INTERPRETATION'
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🚀 NOUVEAU SYSTÈME : EXÉCUTION CONDITIONNELLE DES AGENTS SELON LES TOGGLES
    console.log('[AI-AGENT-CABINET-MEDICAL] 🚀 SYSTÈME TOGGLE: Exécution conditionnelle des agents');

    // Phase 1: Analyse initiale
    console.log('[AI-AGENT-CABINET-MEDICAL] 🧠 Phase 1: Analyse intelligente avec historique');
    const analysis = await coordinator.analyzeQuery(message, conversationHistory);
    
    console.log(`[AI-AGENT-CABINET-MEDICAL] 📊 Analyse: ${JSON.stringify({
      queryType: analysis.queryType,
      priority: analysis.priority,
      confidence: analysis.confidence,
      temporalRef: analysis.temporalRef,
      historyLength: conversationHistory.length
    })}`);

    // Phase 1.5: Détection et gestion des points de préparation (si activé)
    let meetingPreparationResult = null;
    if (context.meetingPoints !== false) {
      console.log('[AI-AGENT-CABINET-MEDICAL] 📝 Phase 1.5: Vérification points préparation réunion');
      const lowerMessage = message.toLowerCase();
      const isMeetingPreparationQuery = lowerMessage.includes('ordre du jour') || 
                                       lowerMessage.includes('points') || 
                                       lowerMessage.includes('préparation') ||
                                       lowerMessage.includes('réunion') ||
                                       (lowerMessage.includes('ajouter') && lowerMessage.includes('point')) ||
                                       (lowerMessage.includes('supprimer') && lowerMessage.includes('point'));

      if (isMeetingPreparationQuery) {
        console.log('[AI-AGENT-CABINET-MEDICAL] 📝 Requête points préparation détectée');
        const userId = context.userId || 'system';
        meetingPreparationResult = await database.handleMeetingPreparationRequest(message, userId);
        console.log('[AI-AGENT-CABINET-MEDICAL] 📝 Résultat préparation:', meetingPreparationResult);
      }
    }

    // Phase 2: EXÉCUTION CONDITIONNELLE DES AGENTS
    console.log('[AI-AGENT-CABINET-MEDICAL] 🔄 Phase 2: Exécution CONDITIONNELLE des agents');

    // 2a: Recherche vectorielle (si activée)
    let embeddingsResult = { chunks: [], sources: [], hasRelevantContext: false };
    if (context.documentSearch !== false) {
      console.log('[AI-AGENT-CABINET-MEDICAL] 🔍 Phase 2a: Recherche vectorielle ACTIVÉE');
      embeddingsResult = await embeddings.searchEmbeddings(message, {
        ...analysis,
        embeddings: true
      }, [], conversationHistory);
      console.log(`[AI-AGENT-CABINET-MEDICAL] 📊 Embeddings: ${embeddingsResult.chunks?.length || 0} chunks trouvés`);
    } else {
      console.log('[AI-AGENT-CABINET-MEDICAL] 🔍 Phase 2a: Recherche vectorielle DÉSACTIVÉE');
    }

    // 2b: Recherche base de données (si activée)
    let databaseContext = { meetings: [], documents: [], participants: [] };
    if (context.databaseSearch !== false) {
      console.log('[AI-AGENT-CABINET-MEDICAL] 🗄️ Phase 2b: Recherche base de données ACTIVÉE');
      databaseContext = await database.searchContext(message);
      console.log(`[AI-AGENT-CABINET-MEDICAL] 📊 Database: ${databaseContext.meetings?.length || 0} réunions, ${databaseContext.documents?.length || 0} documents, ${databaseContext.participants?.length || 0} participants`);
    } else {
      console.log('[AI-AGENT-CABINET-MEDICAL] 🗄️ Phase 2b: Recherche base de données DÉSACTIVÉE');
    }

    // 2c: Gestion des tâches (si activée)
    let taskContext = { currentTasks: [], taskCreated: false };
    if (context.todoManagement !== false) {
      console.log('[AI-AGENT-CABINET-MEDICAL] 📋 Phase 2c: Gestion tâches ACTIVÉE');
      taskContext = await taskAgent.handleTaskRequest(message, analysis, conversationHistory);
      console.log(`[AI-AGENT-CABINET-MEDICAL] 📊 Tasks: ${taskContext.currentTasks?.length || 0} tâches trouvées, création: ${taskContext.taskCreated ? 'OUI' : 'NON'}`);
    } else {
      console.log('[AI-AGENT-CABINET-MEDICAL] 📋 Phase 2c: Gestion tâches DÉSACTIVÉE');
    }

    // 2d: Recherche internet (si activée)
    let internetContext = { hasContent: false, content: '', sources: [] };
    if (context.internetSearch !== false) {
      console.log('[AI-AGENT-CABINET-MEDICAL] 🌐 Phase 2d: Recherche internet ACTIVÉE');
      
      // Détection du besoin de recherche internet
      const needsInternet = analysis.requiresInternet || 
                           analysis.queryType === 'contact_search' ||
                           message.toLowerCase().includes('recherche') || 
                           message.toLowerCase().includes('internet') || 
                           message.toLowerCase().includes('web') ||
                           message.toLowerCase().includes('contact') ||
                           message.toLowerCase().includes('coordonnées') ||
                           message.toLowerCase().includes('fournisseur') ||
                           message.toLowerCase().includes('trouve') ||
                           (!embeddingsResult.hasRelevantContext && !databaseContext.meetings?.length && !taskContext.currentTasks?.length);

      if (needsInternet && perplexityApiKey) {
        console.log('[AI-AGENT-CABINET-MEDICAL] 🌐 Exécution recherche internet avec Perplexity');
        try {
          internetContext = await internet.searchInternet(
            message, 
            analysis, 
            embeddingsResult.hasRelevantContext || databaseContext.meetings?.length > 0 || taskContext.currentTasks?.length > 0
          );
          console.log(`[AI-AGENT-CABINET-MEDICAL] 🌐 Internet: ${internetContext.hasContent ? 'Contenu trouvé' : 'Pas de contenu'}`);
        } catch (error) {
          console.error('[AI-AGENT-CABINET-MEDICAL] ❌ Erreur recherche internet:', error);
        }
      } else {
        console.log('[AI-AGENT-CABINET-MEDICAL] 🌐 Recherche internet ignorée:', { needsInternet, hasPerplexityKey: !!perplexityApiKey });
      }
    } else {
      console.log('[AI-AGENT-CABINET-MEDICAL] 🌐 Phase 2d: Recherche internet DÉSACTIVÉE');
    }

    // Phase 3: Synthèse complète avec les résultats disponibles
    console.log('[AI-AGENT-CABINET-MEDICAL] 🤖 Phase 3: Synthèse avec les agents activés');

    const response = await synthesis.synthesizeResponse(
      message,
      conversationHistory,
      databaseContext,
      embeddingsResult,
      internetContext,
      analysis,
      taskContext,
      meetingPreparationResult
    );

    console.log('[AI-AGENT-CABINET-MEDICAL] ✅ Réponse synthétisée complète:', response.substring(0, 200));

    // Combiner toutes les sources
    let combinedSources = [
      ...embeddingsResult.sources || [],
      ...internetContext.sources || []
    ];

    return new Response(
      JSON.stringify({ 
        response,
        sources: combinedSources,
        taskContext,
        databaseContext,
        meetingPreparationResult,
        internetContext,
        analysis,
        conversationLength: conversationHistory.length,
        hasRelevantContext: embeddingsResult.hasRelevantContext,
        contextFound: (embeddingsResult.chunks?.length > 0) || (databaseContext.meetings?.length > 0) || (taskContext.currentTasks?.length > 0) || internetContext.hasContent,
        debugInfo: {
          embeddingsChunks: embeddingsResult.chunks?.length || 0,
          databaseMeetings: databaseContext.meetings?.length || 0,
          databaseDocuments: databaseContext.documents?.length || 0,
          taskCount: taskContext.currentTasks?.length || 0,
          internetUsed: internetContext.hasContent,
          meetingPreparationAction: meetingPreparationResult?.action || 'none',
          executionMode: 'SELECTIVE_AGENTS_WITH_TOGGLES',
          userId: context.userId || 'not_provided',
          enabledFeatures: {
            database: context.databaseSearch !== false,
            documents: context.documentSearch !== false,
            internet: context.internetSearch !== false,
            todo: context.todoManagement !== false,
            meetingPoints: context.meetingPoints !== false
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AI-AGENT-CABINET-MEDICAL] ❌ Erreur principale:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
