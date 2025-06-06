
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
    console.log(`[AI-AGENT-CABINET-MEDICAL] 🏥 TRAITEMENT OPTIMISÉ OPHTALMOLOGIE: ${message.substring(0, 100)}...`);
    console.log(`[AI-AGENT-CABINET-MEDICAL] 💬 Historique: ${conversationHistory ? conversationHistory.length : 0} messages`);
    
    // Log de l'historique pour debug
    if (conversationHistory && conversationHistory.length > 0) {
      console.log(`[AI-AGENT-CABINET-MEDICAL] 📜 HISTORIQUE DÉTAILLÉ: ${JSON.stringify(conversationHistory.slice(-2), null, 2)}`);
    }
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialisation des agents intelligents pour cabinet médical
    const coordinator = new CoordinatorAgent(openaiApiKey);
    const databaseAgent = new DatabaseAgent(supabase);
    const embeddingsAgent = new EmbeddingsAgent(openaiApiKey, supabase);
    const internetAgent = new InternetAgent(perplexityApiKey);
    const taskAgent = new TaskAgent(supabase);
    const synthesisAgent = new SynthesisAgent(openaiApiKey);

    // 🧠 PHASE 1: ANALYSE INTELLIGENTE OPTIMISÉE - avec historique
    console.log('[AI-AGENT-CABINET-MEDICAL] 🧠 Phase 1: Analyse intelligente optimisée avec historique');
    let analysis = await coordinator.analyzeQuery(message, conversationHistory || []);
    console.log('[AI-AGENT-CABINET-MEDICAL] 📊 Analyse optimisée:', {
      queryType: analysis.queryType,
      priority: analysis.priority,
      confidence: analysis.confidenceLevel,
      temporalRef: analysis.temporalReference?.type || 'none',
      isSimple: analysis.isSimpleRequest,
      embeddings: analysis.requiresEmbeddings,
      database: analysis.requiresDatabase,
      tasks: analysis.requiresTasks,
      internet: analysis.requiresInternet
    });

    // 📋 PHASE TÂCHES : COURT-CIRCUIT IMMÉDIAT pour les tâches simples
    let taskContextData = { currentTasks: [], hasTaskContext: false };
    
    if (analysis.requiresTasks && analysis.isSimpleRequest) {
      console.log('[AI-AGENT-CABINET-MEDICAL] ⚡ COURT-CIRCUIT TÂCHES: traitement direct sans autres recherches');
      taskContextData = await taskAgent.handleTaskRequest(message, analysis, conversationHistory || []);
      
      // Réponse ultra-rapide pour les actions pures sur tâches
      if (taskContextData.taskCreated || analysis.taskAction === 'list') {
        const quickResponse = await synthesisAgent.synthesizeResponse(
          message,
          conversationHistory || [],
          { meetings: [], documents: [], todos: [], participants: [], relevantIds: { meetingIds: [], documentIds: [], todoIds: [], participantIds: [] } },
          { chunks: [], sources: [], hasRelevantContext: false, searchIterations: 0, finalSearchTerms: [], fuzzyResults: [], expansionLevel: 0 },
          { content: '', sources: [], hasContent: false, enrichmentType: 'none' },
          analysis,
          taskContextData
        );

        console.log('[AI-AGENT-CABINET-MEDICAL] ⚡ RÉPONSE ULTRA-RAPIDE TÂCHES générée');
        return new Response(JSON.stringify({
          response: quickResponse,
          sources: [],
          hasTaskContext: true,
          taskAction: taskContextData.taskAction,
          analysis: { queryType: analysis.queryType, priority: analysis.priority, optimized: true },
          searchMetrics: { totalDataPoints: taskContextData.currentTasks.length, shortCircuit: 'tasks', processingTime: 'ultra-fast' }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Contextes intelligents pour les recherches nécessaires uniquement
    let databaseContext = { meetings: [], documents: [], todos: [], participants: [], relevantIds: { meetingIds: [], documentIds: [], todoIds: [], participantIds: [] } };
    let embeddingContext = { chunks: [], sources: [], hasRelevantContext: false, searchIterations: 0, finalSearchTerms: [], fuzzyResults: [], expansionLevel: 0 };
    let internetContext = { content: '', sources: [], hasContent: false, enrichmentType: 'none' };

    // 🎯 PHASE 2: RECHERCHE VECTORIELLE PRIORITAIRE (OPTIMISÉE) - avec historique enrichi
    if (analysis.requiresEmbeddings) {
      console.log('[AI-AGENT-CABINET-MEDICAL] 🎯 Phase 2: Recherche vectorielle PRIORITAIRE avec historique');
      embeddingContext = await embeddingsAgent.searchEmbeddings(message, analysis, databaseContext.relevantIds, conversationHistory || []);
      console.log(`[AI-AGENT-CABINET-MEDICAL] ✅ Embeddings: ${embeddingContext.chunks.length} chunks trouvés`);
      
      // COURT-CIRCUIT si recherche vectorielle réussie avec haute confiance
      if (embeddingContext.hasRelevantContext && embeddingContext.chunks.length >= 3 && !analysis.requiresDatabase) {
        console.log('[AI-AGENT-CABINET-MEDICAL] ⚡ COURT-CIRCUIT VECTORIEL: résultats suffisants trouvés');
        
        const quickResponse = await synthesisAgent.synthesizeResponse(
          message,
          conversationHistory || [],
          databaseContext,
          embeddingContext,
          internetContext,
          analysis,
          taskContextData
        );

        console.log('[AI-AGENT-CABINET-MEDICAL] ⚡ RÉPONSE RAPIDE VECTORIELLE générée');
        return new Response(JSON.stringify({
          response: quickResponse,
          sources: embeddingContext.sources,
          contextFound: true,
          analysis: { queryType: analysis.queryType, priority: analysis.priority, optimized: true },
          searchMetrics: { totalDataPoints: embeddingContext.chunks.length, shortCircuit: 'embeddings', processingTime: 'fast' }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 🗄️ PHASE 3: RECHERCHE DATABASE (seulement si nécessaire)
    if (analysis.requiresDatabase) {
      console.log('[AI-AGENT-CABINET-MEDICAL] 🗄️ Phase 3: Recherche database complémentaire');
      databaseContext = await databaseAgent.searchContext(analysis);
      console.log(`[AI-AGENT-CABINET-MEDICAL] ✅ Database: ${databaseContext.meetings.length} réunions, ${databaseContext.documents.length} documents`);
    }

    // 🔄 PHASE 4: ÉVALUATION RAPIDE ET DÉCISION
    const searchResults = {
      meetings: databaseContext.meetings,
      documents: databaseContext.documents,
      chunks: embeddingContext.chunks,
      todos: databaseContext.todos
    };

    const feedback = await coordinator.provideFeedback(searchResults, message, analysis);
    console.log(`[AI-AGENT-CABINET-MEDICAL] 📈 Feedback: succès=${feedback.success}, confiance=${feedback.confidenceScore}, internet=${feedback.shouldTryInternet}`);

    // 🌐 PHASE 5: ENRICHISSEMENT INTERNET (seulement si vraiment nécessaire)
    if (analysis.requiresInternet || (feedback.shouldTryInternet && !feedback.foundRelevant)) {
      console.log('[AI-AGENT-CABINET-MEDICAL] 🌐 Phase 5: Enrichissement internet ciblé');
      
      if (perplexityApiKey) {
        internetContext = await internetAgent.searchInternet(message, analysis, true);
        console.log(`[AI-AGENT-CABINET-MEDICAL] ✅ Internet: ${internetContext.hasContent ? 'Enrichissement trouvé' : 'Pas de contenu pertinent'}`);
      } else {
        console.log('[AI-AGENT-CABINET-MEDICAL] ⚠️ Pas de clé Perplexity - enrichissement internet indisponible');
      }
    }

    // ⚡ PHASE 6: SYNTHÈSE FINALE OPTIMISÉE - avec historique intégral
    console.log('[AI-AGENT-CABINET-MEDICAL] ⚡ Phase 6: Synthèse finale optimisée avec historique complet');
    
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
        isSimpleRequest: analysis.isSimpleRequest,
        temporalReference: analysis.temporalReference,
        administrativeContext: analysis.administrativeContext,
        internetAccess: analysis.requiresInternet,
        optimizedProcessing: true,
        conversationAware: conversationHistory ? conversationHistory.length > 0 : false
      },
      searchMetrics: {
        totalDataPoints: (databaseContext.meetings?.length || 0) + 
                        (databaseContext.documents?.length || 0) + 
                        (embeddingContext.chunks?.length || 0) +
                        (taskContextData.currentTasks?.length || 0),
        searchIterations: embeddingContext.searchIterations,
        confidenceScore: feedback.confidenceScore,
        taskManagement: taskContextData.hasTaskContext,
        intelligentProcessing: true,
        internetEnrichment: internetContext.hasContent,
        optimizedRouting: true,
        processingTime: 'optimized',
        conversationHistoryUsed: conversationHistory ? conversationHistory.length : 0
      }
    };

    console.log(`[AI-AGENT-CABINET-MEDICAL] ✅ RÉPONSE OPTIMISÉE générée (confiance: ${feedback.confidenceScore}, historique: ${conversationHistory ? conversationHistory.length : 0} messages)`);

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[AI-AGENT-CABINET-MEDICAL] ❌ ERREUR:', error);
    
    // Réponse de fallback intelligente même en cas d'erreur
    const fallbackResponse = {
      response: "Je rencontre un problème technique temporaire, mais je reste disponible pour vous aider avec votre cabinet d'ophtalmologie Dr Tabibian à Genève. Je peux vous assister avec les réunions, transcripts, tâches administratives et recherches. Pouvez-vous reformuler votre question ?",
      sources: [],
      internetSources: [],
      hasTaskContext: false,
      contextFound: false,
      analysis: { queryType: 'assistance', priority: 'database', error: true, cabinetMedical: true, optimized: false },
      searchMetrics: { totalDataPoints: 0, error: error.message, intelligentFallback: true }
    };
    
    return new Response(JSON.stringify(fallbackResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
