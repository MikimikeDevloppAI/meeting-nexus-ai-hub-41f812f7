
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { CoordinatorAgent } from './agents/coordinator.ts';
import { DatabaseAgent } from './agents/database.ts';
import { EmbeddingsAgent } from './agents/embeddings.ts';
import { InternetAgent } from './agents/internet.ts';
import { TaskAgent } from './agents/tasks.ts';
import { SynthesisAgent } from './agents/synthesis.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory, todoId, taskContext: inputTaskContext } = await req.json();
    console.log(`[AI-AGENT-SUPER-INTELLIGENT] 🧠 TRAITEMENT INTELLIGENT ADAPTATIF: ${message.substring(0, 100)}...`);
    console.log(`[AI-AGENT-SUPER-INTELLIGENT] 💬 Historique: ${conversationHistory ? conversationHistory.length : 0} messages`);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialisation des agents intelligents
    const coordinator = new CoordinatorAgent(openaiApiKey);
    const databaseAgent = new DatabaseAgent(supabase);
    const embeddingsAgent = new EmbeddingsAgent(openaiApiKey, supabase);
    const internetAgent = new InternetAgent(perplexityApiKey);
    const taskAgent = new TaskAgent(supabase);
    const synthesisAgent = new SynthesisAgent(openaiApiKey);

    // 🧠 PHASE 1: ANALYSE INTELLIGENTE APPROFONDIE
    console.log('[AI-AGENT-SUPER-INTELLIGENT] 🧠 Phase 1: Analyse intelligente approfondie');
    let analysis = await coordinator.analyzeQuery(message, conversationHistory || []);
    console.log('[AI-AGENT-SUPER-INTELLIGENT] 📊 Analyse initiale:', {
      queryType: analysis.queryType,
      priority: analysis.priority,
      confidence: analysis.confidenceLevel,
      needsRefinement: analysis.needsIterativeRefinement
    });

    // 📋 PHASE TÂCHES : Traitement prioritaire si détecté
    let taskContextData = { currentTasks: [], hasTaskContext: false };
    
    if (analysis.requiresTasks) {
      console.log('[AI-AGENT-SUPER-INTELLIGENT] 📋 Phase TÂCHES: Traitement prioritaire');
      taskContextData = await taskAgent.handleTaskRequest(message, analysis);
      
      // Si action pure sur tâches, réponse rapide optimisée
      if (analysis.taskAction === 'create' && taskContextData.taskCreated) {
        const quickResponse = await synthesisAgent.synthesizeResponse(
          message,
          conversationHistory || [],
          { meetings: [], documents: [], todos: [], participants: [], relevantIds: { meetingIds: [], documentIds: [], todoIds: [], participantIds: [] } },
          { chunks: [], sources: [], hasRelevantContext: false, searchIterations: 0, finalSearchTerms: [], fuzzyResults: [], expansionLevel: 0 },
          { content: '', sources: [], hasContent: false, enrichmentType: 'none' },
          analysis,
          taskContextData
        );

        return new Response(JSON.stringify({
          response: quickResponse,
          sources: [],
          hasTaskContext: true,
          taskAction: taskContextData.taskAction,
          analysis: { queryType: analysis.queryType, priority: analysis.priority },
          searchMetrics: { totalDataPoints: taskContextData.currentTasks.length, taskCreated: true }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Contextes intelligents pour les agents
    let databaseContext = { meetings: [], documents: [], todos: [], participants: [], relevantIds: { meetingIds: [], documentIds: [], todoIds: [], participantIds: [] } };
    let embeddingContext = { chunks: [], sources: [], hasRelevantContext: false, searchIterations: 0, finalSearchTerms: [], fuzzyResults: [], expansionLevel: 0 };
    let internetContext = { content: '', sources: [], hasContent: false, enrichmentType: 'none' };

    // 🗄️ PHASE 2: RECHERCHE DATABASE INTELLIGENTE (PRIORITÉ AUX DONNÉES)
    if (analysis.requiresDatabase) {
      console.log('[AI-AGENT-SUPER-INTELLIGENT] 🗄️ Phase 2: Recherche database intelligente (PRIORITAIRE)');
      databaseContext = await databaseAgent.searchContext(analysis);
      console.log(`[AI-AGENT-SUPER-INTELLIGENT] ✅ Database: ${databaseContext.meetings.length} réunions, ${databaseContext.documents.length} documents, ${databaseContext.todos.length} tâches`);
    }

    // 🎯 PHASE 3: RECHERCHE VECTORIELLE APPROFONDIE (PRIORITÉ CONTENU)
    if (analysis.requiresEmbeddings) {
      console.log('[AI-AGENT-SUPER-INTELLIGENT] 🎯 Phase 3: Recherche vectorielle approfondie');
      embeddingContext = await embeddingsAgent.searchEmbeddings(message, analysis, databaseContext.relevantIds);
      console.log(`[AI-AGENT-SUPER-INTELLIGENT] ✅ Embeddings: ${embeddingContext.chunks.length} chunks, ${embeddingContext.searchIterations} itérations`);
    }

    // 🔄 PHASE 4: ÉVALUATION ET AMÉLIORATION ITÉRATIVE
    const searchResults = {
      meetings: databaseContext.meetings,
      documents: databaseContext.documents,
      chunks: embeddingContext.chunks,
      todos: databaseContext.todos
    };

    const feedback = await coordinator.provideFeedback(searchResults, message, analysis);
    console.log(`[AI-AGENT-SUPER-INTELLIGENT] 📈 Feedback: succès=${feedback.success}, confiance=${feedback.confidenceScore}`);

    // 🔄 RAFFINEMENT SI NÉCESSAIRE
    if (analysis.needsIterativeRefinement && !feedback.foundRelevant) {
      console.log('[AI-AGENT-SUPER-INTELLIGENT] 🔄 Phase 4.1: Raffinement de l\'analyse');
      analysis = await coordinator.refineAnalysisWithResults(analysis, searchResults, message);
      
      // Recherche vectorielle étendue si raffinement nécessaire
      if (!embeddingContext.hasRelevantContext && feedback.suggestedTerms?.length > 0) {
        console.log('[AI-AGENT-SUPER-INTELLIGENT] 🎯 Phase 4.2: Recherche vectorielle étendue');
        const expandedContext = await embeddingsAgent.searchWithFallback(message, feedback.suggestedTerms, databaseContext.relevantIds);
        if (expandedContext.chunks.length > embeddingContext.chunks.length) {
          embeddingContext = expandedContext;
          console.log(`[AI-AGENT-SUPER-INTELLIGENT] ✅ Recherche étendue: ${expandedContext.chunks.length} nouveaux chunks`);
        }
      }
    }

    // 🌐 PHASE 5: ENRICHISSEMENT INTERNET (SEULEMENT SI NÉCESSAIRE)
    if (analysis.requiresInternet || (feedback.shouldTryInternet && !embeddingContext.hasRelevantContext)) {
      console.log('[AI-AGENT-SUPER-INTELLIGENT] 🌐 Phase 5: Enrichissement internet contextuel');
      internetContext = await internetAgent.searchInternet(message, analysis, true); // Mode intelligent activé
      console.log(`[AI-AGENT-SUPER-INTELLIGENT] ✅ Internet: ${internetContext.hasContent ? 'Enrichissement trouvé' : 'Pas de contenu pertinent'}`);
    }

    // ⚡ PHASE 6: SYNTHÈSE FINALE SUPER-INTELLIGENTE
    console.log('[AI-AGENT-SUPER-INTELLIGENT] ⚡ Phase 6: Synthèse finale super-intelligente');
    
    const finalResponse = await synthesisAgent.synthesizeResponse(
      message,
      conversationHistory || [],
      databaseContext,
      embeddingContext,
      internetContext,
      analysis,
      taskContextData
    );

    const responseData = {
      response: finalResponse,
      sources: embeddingContext.sources,
      internetSources: internetContext.sources,
      hasTaskContext: taskContextData.hasTaskContext,
      taskAction: taskContextData.taskAction,
      contextFound: embeddingContext.hasRelevantContext || databaseContext.meetings.length > 0,
      analysis: {
        queryType: analysis.queryType,
        priority: analysis.priority,
        requiresTasks: analysis.requiresTasks,
        confidence: analysis.confidenceLevel,
        iterativeRefinement: analysis.needsIterativeRefinement
      },
      searchMetrics: {
        totalDataPoints: (databaseContext.meetings?.length || 0) + 
                        (databaseContext.documents?.length || 0) + 
                        (embeddingContext.chunks?.length || 0) +
                        (taskContextData.currentTasks?.length || 0),
        searchIterations: embeddingContext.searchIterations,
        confidenceScore: feedback.confidenceScore,
        taskManagement: taskContextData.hasTaskContext,
        intelligentProcessing: true
      }
    };

    console.log(`[AI-AGENT-SUPER-INTELLIGENT] ✅ RÉPONSE SUPER-INTELLIGENTE générée (confiance: ${feedback.confidenceScore})`);

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[AI-AGENT-SUPER-INTELLIGENT] ❌ ERREUR:', error);
    
    // Réponse de fallback intelligente même en cas d'erreur
    const fallbackResponse = {
      response: "Je rencontre un problème technique temporaire, mais je reste disponible pour vous aider avec votre cabinet d'ophtalmologie à Genève. Pouvez-vous reformuler votre question ou être plus spécifique sur ce que vous cherchez ?",
      sources: [],
      internetSources: [],
      hasTaskContext: false,
      contextFound: false,
      analysis: { queryType: 'assistance', priority: 'database', error: true },
      searchMetrics: { totalDataPoints: 0, error: error.message, intelligentFallback: true }
    };
    
    return new Response(JSON.stringify(fallbackResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
