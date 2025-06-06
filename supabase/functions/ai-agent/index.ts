
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { CoordinatorAgent } from './agents/coordinator.ts';
import { DatabaseAgent } from './agents/database.ts';
import { EmbeddingsAgent } from './agents/embeddings.ts';
import { InternetAgent } from './agents/internet.ts';
import { GalaxusAgent } from './agents/galaxus.ts';
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
    console.log(`[AI-AGENT-OPHTACARE] 🏥 TRAITEMENT INTELLIGENT avec gestion TÂCHES: ${message.substring(0, 100)}...`);
    console.log(`[AI-AGENT-OPHTACARE] 💬 Historique: ${conversationHistory ? conversationHistory.length : 0} messages`);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialisation des agents avec TASKS
    const coordinator = new CoordinatorAgent(openaiApiKey);
    const databaseAgent = new DatabaseAgent(supabase);
    const embeddingsAgent = new EmbeddingsAgent(openaiApiKey, supabase);
    const internetAgent = new InternetAgent(perplexityApiKey);
    const galaxusAgent = new GalaxusAgent(perplexityApiKey);
    const taskAgent = new TaskAgent(supabase);
    const synthesisAgent = new SynthesisAgent(openaiApiKey);

    // 🧠 PHASE 1: ANALYSE INTELLIGENTE avec détection spécialisée
    console.log('[AI-AGENT-OPHTACARE] 🧠 Phase 1: Analyse intelligente avec détection contexte');
    const analysis = await coordinator.analyzeQuery(message, conversationHistory || []);
    console.log('[AI-AGENT-OPHTACARE] 📊 Analyse intelligente:', {
      queryType: analysis.queryType,
      priority: analysis.priority,
      requiresTasks: analysis.requiresTasks,
      requiresEmbeddings: analysis.requiresEmbeddings,
      taskAction: analysis.taskAction
    });

    // 📋 PHASE TÂCHES : Traitement prioritaire si détecté
    let taskContextData = { currentTasks: [], hasTaskContext: false };
    
    if (analysis.requiresTasks) {
      console.log('[AI-AGENT-OPHTACARE] 📋 Phase TÂCHES: Traitement spécialisé prioritaire');
      taskContextData = await taskAgent.handleTaskRequest(message, analysis);
      console.log('[AI-AGENT-OPHTACARE] ✅ Tâches:', {
        currentTasks: taskContextData.currentTasks.length,
        taskCreated: taskContextData.taskCreated ? 'OUI' : 'NON',
        taskAction: taskContextData.taskAction
      });
      
      // Si c'est une action pure sur les tâches, on peut répondre directement
      if (analysis.taskAction === 'create' && taskContextData.taskCreated) {
        const quickResponse = await synthesisAgent.synthesizeResponse(
          message,
          conversationHistory || [],
          { meetings: [], documents: [], todos: [], participants: [], relevantIds: { meetingIds: [], documentIds: [], todoIds: [], participantIds: [] } },
          { chunks: [], sources: [], hasRelevantContext: false, searchIterations: 0, finalSearchTerms: [], fuzzyResults: [], expansionLevel: 0 },
          { content: '', sources: [], hasContent: false, enrichmentType: 'none' },
          { products: [], hasProducts: false, searchQuery: '', recommendations: '' },
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

    // Continuer avec les autres phases seulement si nécessaire
    let databaseContext = { meetings: [], documents: [], todos: [], participants: [], relevantIds: { meetingIds: [], documentIds: [], todoIds: [], participantIds: [] } };
    let embeddingContext = { chunks: [], sources: [], hasRelevantContext: false, searchIterations: 0, finalSearchTerms: [], fuzzyResults: [], expansionLevel: 0 };
    let internetContext = { content: '', sources: [], hasContent: false, enrichmentType: 'none' };
    let galaxusContext = { products: [], hasProducts: false, searchQuery: '', recommendations: '' };

    // 🗄️ PHASE 2: Database (si nécessaire)
    if (analysis.requiresDatabase && analysis.priority !== 'tasks') {
      console.log('[AI-AGENT-OPHTACARE] 🗄️ Phase 2: Recherche database');
      databaseContext = await databaseAgent.searchContext(analysis);
      console.log(`[AI-AGENT-OPHTACARE] ✅ Database: ${databaseContext.meetings.length} réunions, ${databaseContext.documents.length} documents`);
    }

    // 🎯 PHASE 3: Embeddings (si nécessaire)
    if (analysis.requiresEmbeddings && analysis.priority !== 'tasks') {
      console.log('[AI-AGENT-OPHTACARE] 🎯 Phase 3: Recherche vectorielle');
      embeddingContext = await embeddingsAgent.searchEmbeddings(message, analysis, databaseContext.relevantIds);
      console.log(`[AI-AGENT-OPHTACARE] ✅ Embeddings: ${embeddingContext.chunks.length} chunks`);
    }

    // 🛒 PHASE 4: Galaxus (si nécessaire)
    if (analysis.requiresInternet || analysis.priority === 'internet') {
      console.log('[AI-AGENT-OPHTACARE] 🛒 Phase 4: Recherche produits');
      galaxusContext = await galaxusAgent.searchProducts(message, analysis);
      console.log(`[AI-AGENT-OPHTACARE] ✅ Galaxus: ${galaxusContext.products.length} produits`);
    }

    // 🌐 PHASE 5: Internet complémentaire (très sélectif)
    const shouldUseInternet = analysis.requiresInternet && 
                              !galaxusContext.hasProducts && 
                              !embeddingContext.hasRelevantContext &&
                              !taskContextData.hasTaskContext;
    
    if (shouldUseInternet) {
      console.log('[AI-AGENT-OPHTACARE] 🌐 Phase 5: Internet complémentaire');
      internetContext = await internetAgent.searchInternet(message, analysis, false, galaxusContext);
    }

    // ⚡ PHASE 6: SYNTHÈSE FINALE
    console.log('[AI-AGENT-OPHTACARE] ⚡ Phase 6: Synthèse intelligente finale');
    
    const finalResponse = await synthesisAgent.synthesizeResponse(
      message,
      conversationHistory || [],
      databaseContext,
      embeddingContext,
      internetContext,
      galaxusContext,
      analysis,
      taskContextData
    );

    const responseData = {
      response: finalResponse,
      sources: embeddingContext.sources,
      internetSources: internetContext.sources,
      galaxusSources: galaxusContext.hasProducts ? [{ type: 'galaxus', source: 'Galaxus Products', query: galaxusContext.searchQuery }] : [],
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
                        (taskContextData.currentTasks?.length || 0) +
                        (galaxusContext.products?.length || 0),
        taskManagement: taskContextData.hasTaskContext
      }
    };

    console.log(`[AI-AGENT-OPHTACARE] ✅ RÉPONSE INTELLIGENTE avec TÂCHES générée`);
    console.log(`[AI-AGENT-OPHTACARE] 📈 MÉTRIQUES: Tâches=${taskContextData.currentTasks.length}, Priority=${analysis.priority}, Action=${taskContextData.taskAction || 'none'}`);

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[AI-AGENT-OPHTACARE] ❌ ERREUR:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      context: 'AI Agent OphtaCare - Gestion intelligente avec tâches'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
