
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { CoordinatorAgent } from './agents/coordinator.ts';
import { DatabaseAgent } from './agents/database.ts';
import { EmbeddingsAgent } from './agents/embeddings.ts';
import { InternetAgent } from './agents/internet.ts';
import { GalaxusAgent } from './agents/galaxus.ts';
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
    const { message, conversationHistory, todoId, taskContext } = await req.json();
    console.log(`[AI-AGENT-OPHTACARE] 🏥 TRAITEMENT ULTRA-ENRICHI AVEC GALAXUS: ${message.substring(0, 100)}...`);
    console.log(`[AI-AGENT-OPHTACARE] 💬 Historique: ${conversationHistory ? conversationHistory.length : 0} messages`);
    console.log(`[AI-AGENT-OPHTACARE] 📋 Contexte tâche: ${taskContext ? 'OUI' : 'NON'}`);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialisation des agents enrichis avec Galaxus
    const coordinator = new CoordinatorAgent(openaiApiKey);
    const databaseAgent = new DatabaseAgent(supabase);
    const embeddingsAgent = new EmbeddingsAgent(openaiApiKey, supabase);
    const internetAgent = new InternetAgent(perplexityApiKey);
    const galaxusAgent = new GalaxusAgent(perplexityApiKey);
    const synthesisAgent = new SynthesisAgent(openaiApiKey);

    // 🧠 PHASE 1: ANALYSE ULTRA-ENRICHIE avec fuzzy matching et contexte médical
    console.log('[AI-AGENT-OPHTACARE] 🧠 Phase 1: Analyse ultra-enrichie avec gestion fuzzy');
    const analysis = await coordinator.analyzeQuery(message, conversationHistory || []);
    console.log('[AI-AGENT-OPHTACARE] 📊 Analyse complète:', {
      queryType: analysis.queryType,
      priority: analysis.priority,
      requiresEmbeddings: analysis.requiresEmbeddings,
      fuzzyMatching: analysis.fuzzyMatching,
      actionDetected: analysis.actionDetected,
      medicalContext: analysis.medicalContext,
      searchTermsCount: analysis.searchTerms.length,
      synonymsCount: analysis.synonyms.length
    });

    // FORCER les embeddings pour TOUT sauf actions pures
    if (!analysis.requiresEmbeddings && analysis.queryType !== 'task') {
      console.log('[AI-AGENT-OPHTACARE] 🔧 FORÇAGE recherche vectorielle pour enrichissement maximum');
      analysis.requiresEmbeddings = true;
      analysis.priority = 'embeddings';
      analysis.iterativeSearch = true;
    }

    // 🗄️ PHASE 2: RECHERCHE DATABASE ENRICHIE avec tâches et participants
    console.log('[AI-AGENT-OPHTACARE] 🗄️ Phase 2: Recherche database ultra-enrichie');
    const databaseContext = analysis.requiresDatabase 
      ? await databaseAgent.searchContext(analysis)
      : { 
          meetings: [], documents: [], todos: [], participants: [],
          relevantIds: { meetingIds: [], documentIds: [], todoIds: [], participantIds: [] } 
        };
    
    console.log('[AI-AGENT-OPHTACARE] ✅ Database enrichie:', {
      meetings: databaseContext.meetings.length,
      documents: databaseContext.documents.length,
      todos: databaseContext.todos.length,
      participants: databaseContext.participants.length,
      fuzzyMatches: databaseContext.fuzzyMatches?.length || 0
    });

    // 🎯 PHASE 3: RECHERCHE VECTORIELLE ULTRA-AGRESSIVE
    console.log('[AI-AGENT-OPHTACARE] 🎯 Phase 3: RECHERCHE VECTORIELLE ULTRA-AGRESSIVE');
    let embeddingContext = { 
      chunks: [], sources: [], hasRelevantContext: false, 
      searchIterations: 0, finalSearchTerms: [], fuzzyResults: [], expansionLevel: 0 
    };
    
    if (analysis.requiresEmbeddings) {
      embeddingContext = await embeddingsAgent.searchEmbeddings(message, analysis, databaseContext.relevantIds);
      
      // RETRY ultra-agressif si résultats insuffisants
      if (!embeddingContext.hasRelevantContext || embeddingContext.chunks.length < 5) {
        console.log('[AI-AGENT-OPHTACARE] 🔄 RETRY ultra-agressif - expansion maximale');
        
        const ultraExpandedTerms = [
          message,
          ...analysis.searchTerms,
          ...analysis.synonyms,
          // Expansion contextuelle OphtaCare
          ...(message.toLowerCase().includes('dupixent') ? 
            ['dupilumab', 'dermatologie', 'bonus', 'règles', 'traitement', 'indemnisation', 'remboursement', 'assurance', 'protocole', 'prescription', 'critères', 'conditions'] : []),
          ...(message.toLowerCase().includes('fischer') || message.toLowerCase().includes('fisher') ? 
            ['fischer', 'fisher', 'monsieur fischer', 'mr fischer', 'docteur fischer', 'patient fischer'] : []),
          ...(message.toLowerCase().includes('clim') ? 
            ['climatisation', 'air conditionné', 'température', 'refroidissement', 'HVAC', 'climate'] : []),
          // Termes généraux OphtaCare
          'cabinet', 'genève', 'tabibian', 'ophtalmologie', 'médical', 'administratif'
        ];
        
        const fallbackContext = await embeddingsAgent.searchWithFallback(
          message, 
          ultraExpandedTerms,
          databaseContext.relevantIds
        );
        
        // Fusion de tous les résultats
        if (fallbackContext.hasRelevantContext) {
          embeddingContext.chunks.push(...fallbackContext.chunks);
          embeddingContext.sources.push(...fallbackContext.sources);
          embeddingContext.hasRelevantContext = true;
          embeddingContext.searchIterations += fallbackContext.searchIterations;
          embeddingContext.expansionLevel = Math.max(embeddingContext.expansionLevel, fallbackContext.expansionLevel);
        }
      }
    }

    console.log('[AI-AGENT-OPHTACARE] ✅ Recherche vectorielle terminée:', {
      chunks: embeddingContext.chunks.length,
      iterations: embeddingContext.searchIterations,
      expansionLevel: embeddingContext.expansionLevel,
      hasContext: embeddingContext.hasRelevantContext,
      uniqueChunks: [...new Set(embeddingContext.chunks.map(c => c.id))].length
    });

    // 🛒 PHASE 4: RECHERCHE GALAXUS SPÉCIALISÉE
    console.log('[AI-AGENT-OPHTACARE] 🛒 Phase 4: Recherche Galaxus spécialisée');
    const galaxusContext = await galaxusAgent.searchProducts(message, analysis);
    
    console.log('[AI-AGENT-OPHTACARE] ✅ Galaxus:', {
      hasProducts: galaxusContext.hasProducts,
      productsCount: galaxusContext.products.length
    });

    // 🌐 PHASE 5: INTERNET COMPLÉMENTAIRE (seulement si vraiment nécessaire)
    console.log('[AI-AGENT-OPHTACARE] 🌐 Phase 5: Internet complémentaire');
    const shouldUseInternet = (analysis.requiresInternet || 
                              (!embeddingContext.hasRelevantContext && 
                               !galaxusContext.hasProducts &&
                               analysis.queryType === 'general' && 
                               databaseContext.meetings.length === 0 && 
                               databaseContext.documents.length === 0)) &&
                              embeddingContext.chunks.length < 2; // Seuil très strict
    
    const internetContext = shouldUseInternet
      ? await internetAgent.searchInternet(message, analysis, embeddingContext.hasRelevantContext, galaxusContext)
      : { content: '', sources: [], hasContent: false, enrichmentType: 'none' };

    console.log('[AI-AGENT-OPHTACARE] ✅ Internet:', {
      used: shouldUseInternet,
      hasContent: internetContext.hasContent,
      enrichmentType: internetContext.enrichmentType
    });

    // ⚡ PHASE 6: SYNTHÈSE ULTRA-ENRICHIE avec validation contextuelle et Galaxus
    console.log('[AI-AGENT-OPHTACARE] ⚡ Phase 6: Synthèse ultra-enrichie avec contexte médical et Galaxus');
    
    const finalResponse = await synthesisAgent.synthesizeResponse(
      message,
      conversationHistory || [],
      databaseContext,
      embeddingContext,
      internetContext,
      galaxusContext,
      analysis
    );

    // Construction de la réponse enrichie avec métriques détaillées
    const responseData = {
      response: finalResponse,
      sources: embeddingContext.sources,
      internetSources: internetContext.sources,
      galaxusSources: galaxusContext.hasProducts ? [{ type: 'galaxus', source: 'Galaxus Products', query: galaxusContext.searchQuery }] : [],
      hasInternetContext: internetContext.hasContent,
      hasGalaxusContext: galaxusContext.hasProducts,
      contextFound: embeddingContext.hasRelevantContext,
      analysis: {
        queryType: analysis.queryType,
        priority: analysis.priority,
        fuzzyMatching: analysis.fuzzyMatching,
        actionDetected: analysis.actionDetected,
        medicalContext: analysis.medicalContext,
        requiresClarification: analysis.requiresClarification
      },
      searchMetrics: {
        embeddingIterations: embeddingContext.searchIterations,
        expansionLevel: embeddingContext.expansionLevel,
        finalSearchTerms: embeddingContext.finalSearchTerms,
        chunksFound: embeddingContext.chunks.length,
        uniqueChunks: [...new Set(embeddingContext.chunks.map((c: any) => c.id))].length,
        fuzzyResults: embeddingContext.fuzzyResults?.length || 0,
        targetedExtraction: databaseContext.targetedExtracts ? true : false,
        internetEnrichmentType: internetContext.enrichmentType,
        galaxusProductsFound: galaxusContext.products.length,
        totalDataPoints: (databaseContext.meetings?.length || 0) + 
                        (databaseContext.documents?.length || 0) + 
                        (databaseContext.todos?.length || 0) + 
                        (embeddingContext.chunks?.length || 0) +
                        (galaxusContext.products?.length || 0)
      },
      enrichedDataUsed: {
        meetings: databaseContext.meetings?.length || 0,
        documents: databaseContext.documents?.length || 0,
        todos: databaseContext.todos?.length || 0,
        participants: databaseContext.participants?.length || 0,
        conversationHistory: conversationHistory?.length || 0,
        targetedSections: databaseContext.targetedExtracts?.sections?.length || 0,
        embeddingChunks: embeddingContext.chunks.length,
        fuzzyMatches: databaseContext.fuzzyMatches?.length || 0,
        galaxusProducts: galaxusContext.products.length
      }
    };

    console.log('[AI-AGENT-OPHTACARE] ✅ RÉPONSE ULTRA-ENRICHIE AVEC GALAXUS GÉNÉRÉE');
    console.log(`[AI-AGENT-OPHTACARE] 📈 MÉTRIQUES FINALES: Embeddings=${embeddingContext.chunks.length} chunks, Galaxus=${galaxusContext.products.length} produits, Expansion=${embeddingContext.expansionLevel}, Iterations=${embeddingContext.searchIterations}, Total=${responseData.searchMetrics.totalDataPoints} points, Internet=${internetContext.hasContent ? 'OUI' : 'NON'}`);
    console.log(`[AI-AGENT-OPHTACARE] 🎯 DONNÉES ENRICHIES: Réunions=${databaseContext.meetings?.length}, Docs=${databaseContext.documents?.length}, Tâches=${databaseContext.todos?.length}, Participants=${databaseContext.participants?.length}, Produits=${galaxusContext.products.length}`);

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[AI-AGENT-OPHTACARE] ❌ ERREUR CRITIQUE:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      context: 'AI Agent OphtaCare - Enrichissement maximal avec Galaxus'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
