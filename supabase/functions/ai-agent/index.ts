
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
    console.log(`[AI-AGENT-OPHTACARE] 🏥 TRAITEMENT INTELLIGENT: ${message.substring(0, 100)}...`);
    console.log(`[AI-AGENT-OPHTACARE] 💬 Historique: ${conversationHistory ? conversationHistory.length : 0} messages`);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialisation des agents optimisés
    const coordinator = new CoordinatorAgent(openaiApiKey);
    const databaseAgent = new DatabaseAgent(supabase);
    const embeddingsAgent = new EmbeddingsAgent(openaiApiKey, supabase);
    const internetAgent = new InternetAgent(perplexityApiKey);
    const taskAgent = new TaskAgent(supabase);
    const synthesisAgent = new SynthesisAgent(openaiApiKey);

    // 🧠 PHASE 1: ANALYSE RAPIDE ET INTELLIGENTE
    console.log('[AI-AGENT-OPHTACARE] 🧠 Phase 1: Analyse rapide');
    const analysis = await coordinator.analyzeQuery(message, conversationHistory || []);
    console.log('[AI-AGENT-OPHTACARE] 📊 Analyse:', {
      queryType: analysis.queryType,
      priority: analysis.priority,
      requiresTasks: analysis.requiresTasks
    });

    // 📋 PHASE TÂCHES : Traitement prioritaire si détecté
    let taskContextData = { currentTasks: [], hasTaskContext: false };
    
    if (analysis.requiresTasks) {
      console.log('[AI-AGENT-OPHTACARE] 📋 Phase TÂCHES: Traitement prioritaire');
      taskContextData = await taskAgent.handleTaskRequest(message, analysis);
      console.log('[AI-AGENT-OPHTACARE] ✅ Tâches:', {
        currentTasks: taskContextData.currentTasks.length,
        taskCreated: taskContextData.taskCreated ? 'OUI' : 'NON'
      });
      
      // Si c'est une action pure sur les tâches, réponse rapide
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

    // Contextes pour les autres agents (optimisés)
    let databaseContext = { meetings: [], documents: [], todos: [], participants: [], relevantIds: { meetingIds: [], documentIds: [], todoIds: [], participantIds: [] } };
    let embeddingContext = { chunks: [], sources: [], hasRelevantContext: false, searchIterations: 0, finalSearchTerms: [], fuzzyResults: [], expansionLevel: 0 };
    let internetContext = { content: '', sources: [], hasContent: false, enrichmentType: 'none' };

    // 🗄️ PHASE 2: Database (seulement si nécessaire)
    if (analysis.requiresDatabase && analysis.priority !== 'tasks') {
      console.log('[AI-AGENT-OPHTACARE] 🗄️ Phase 2: Recherche database');
      databaseContext = await databaseAgent.searchContext(analysis);
      console.log(`[AI-AGENT-OPHTACARE] ✅ Database: ${databaseContext.meetings.length} réunions, ${databaseContext.documents.length} documents`);
    }

    // 🎯 PHASE 3: Embeddings (seulement si nécessaire)
    if (analysis.requiresEmbeddings && analysis.priority !== 'tasks') {
      console.log('[AI-AGENT-OPHTACARE] 🎯 Phase 3: Recherche vectorielle');
      embeddingContext = await embeddingsAgent.searchEmbeddings(message, analysis, databaseContext.relevantIds);
      console.log(`[AI-AGENT-OPHTACARE] ✅ Embeddings: ${embeddingContext.chunks.length} chunks`);
    }

    // 🌐 PHASE 4: Internet (très sélectif pour recommendations générales)
    if (analysis.requiresInternet && !embeddingContext.hasRelevantContext && !taskContextData.hasTaskContext) {
      console.log('[AI-AGENT-OPHTACARE] 🌐 Phase 4: Recherche Internet');
      internetContext = await internetAgent.searchInternet(message, analysis, false);
      console.log(`[AI-AGENT-OPHTACARE] ✅ Internet: ${internetContext.hasContent ? 'Trouvé' : 'Non trouvé'}`);
    }

    // ⚡ PHASE 5: SYNTHÈSE FINALE OPTIMISÉE
    console.log('[AI-AGENT-OPHTACARE] ⚡ Phase 5: Synthèse finale');
    
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
      contextFound: embeddingContext.hasRelevantContext,
      analysis: {
        queryType: analysis.queryType,
        priority: analysis.priority,
        requiresTasks: analysis.requiresTasks
      },
      searchMetrics: {
        totalDataPoints: (databaseContext.meetings?.length || 0) + 
                        (databaseContext.documents?.length || 0) + 
                        (embeddingContext.chunks?.length || 0) +
                        (taskContextData.currentTasks?.length || 0),
        taskManagement: taskContextData.hasTaskContext
      }
    };

    console.log(`[AI-AGENT-OPHTACARE] ✅ RÉPONSE OPTIMISÉE générée`);

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[AI-AGENT-OPHTACARE] ❌ ERREUR:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      context: 'AI Agent OphtaCare - Optimisé'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
