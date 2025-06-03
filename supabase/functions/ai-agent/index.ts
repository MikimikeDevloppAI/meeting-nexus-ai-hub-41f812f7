
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { CoordinatorAgent } from './agents/coordinator.ts';
import { DatabaseAgent } from './agents/database.ts';
import { EmbeddingsAgent } from './agents/embeddings.ts';
import { InternetAgent } from './agents/internet.ts';
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
    console.log(`[AI-AGENT-OPHTACARE] 🏥 Processing ENHANCED query: ${message.substring(0, 100)}...`);
    console.log(`[AI-AGENT-OPHTACARE] 💬 History: ${conversationHistory ? conversationHistory.length : 0} messages`);
    console.log(`[AI-AGENT-OPHTACARE] 📋 Task context: ${taskContext ? 'YES' : 'NO'}`);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize enhanced agents
    const coordinator = new CoordinatorAgent(openaiApiKey);
    const databaseAgent = new DatabaseAgent(supabase);
    const embeddingsAgent = new EmbeddingsAgent(openaiApiKey, supabase);
    const internetAgent = new InternetAgent(perplexityApiKey);
    const synthesisAgent = new SynthesisAgent(openaiApiKey);

    // 1. ENHANCED COORDINATION: Prioriser la recherche vectorielle
    console.log('[AI-AGENT-OPHTACARE] 🧠 Phase 1: Analyse de requête avec priorité vectorielle');
    const analysis = await coordinator.analyzeQuery(message, conversationHistory || []);
    console.log('[AI-AGENT-OPHTACARE] 📊 Analysis result:', analysis);

    // Force embeddings search for almost everything
    if (!analysis.requiresEmbeddings && analysis.queryType !== 'task') {
      console.log('[AI-AGENT-OPHTACARE] 🔧 Forcing embeddings search for better results');
      analysis.requiresEmbeddings = true;
      analysis.priority = 'embeddings';
    }

    // 2. DATABASE SEARCH: Plus ciblé mais toujours actif
    console.log('[AI-AGENT-OPHTACARE] 🗄️ Phase 2: Recherche base de données');
    const databaseContext = analysis.requiresDatabase 
      ? await databaseAgent.searchContext(analysis)
      : { meetings: [], documents: [], todos: [], relevantIds: { meetingIds: [], documentIds: [] } };

    // 3. RECHERCHE VECTORIELLE AGRESSIVE : Priorité absolue
    console.log('[AI-AGENT-OPHTACARE] 🎯 Phase 3: RECHERCHE VECTORIELLE AGRESSIVE');
    let embeddingContext = { chunks: [], sources: [], hasRelevantContext: false, searchIterations: 0, finalSearchTerms: [] };
    
    if (analysis.requiresEmbeddings) {
      embeddingContext = await embeddingsAgent.searchEmbeddings(message, analysis, databaseContext.relevantIds);
      
      // Si pas de résultats satisfaisants, retry avec des termes plus larges
      if (!embeddingContext.hasRelevantContext || embeddingContext.chunks.length < 3) {
        console.log('[AI-AGENT-OPHTACARE] 🔄 Recherche vectorielle insuffisante, retry avec expansion maximale');
        
        const expandedTerms = [
          message,
          ...analysis.searchTerms,
          ...analysis.synonyms,
          // Termes supplémentaires selon le contexte
          ...(message.toLowerCase().includes('dupixent') ? ['dupilumab', 'dermatologie', 'bonus', 'règles', 'traitement'] : []),
          ...(message.toLowerCase().includes('bonus') ? ['indemnisation', 'remboursement', 'critères', 'conditions'] : [])
        ];
        
        const fallbackContext = await embeddingsAgent.searchWithFallback(
          message, 
          expandedTerms,
          databaseContext.relevantIds
        );
        
        // Merge all results
        if (fallbackContext.hasRelevantContext) {
          embeddingContext.chunks.push(...fallbackContext.chunks);
          embeddingContext.sources.push(...fallbackContext.sources);
          embeddingContext.hasRelevantContext = true;
          embeddingContext.searchIterations += fallbackContext.searchIterations;
        }
      }
    }

    // 4. INTERNET: Seulement si pas de résultats internes satisfaisants
    console.log('[AI-AGENT-OPHTACARE] 🌐 Phase 4: Internet (conditionnel)');
    const shouldUseInternet = (analysis.requiresInternet || 
                              (!embeddingContext.hasRelevantContext && analysis.queryType === 'general')) &&
                              embeddingContext.chunks.length < 2; // Seulement si vraiment pas de résultats
    
    const internetContext = shouldUseInternet
      ? await internetAgent.searchInternet(message, analysis, embeddingContext.hasRelevantContext)
      : { content: '', sources: [], hasContent: false, enrichmentType: 'none' };

    // 5. SYNTHESIS: Privilégier les données internes
    console.log('[AI-AGENT-OPHTACARE] ⚡ Phase 5: Synthèse avec priorité aux données internes');
    
    const finalResponse = await synthesisAgent.synthesizeResponse(
      message,
      conversationHistory || [],
      databaseContext,
      embeddingContext,
      internetContext,
      analysis
    );

    // Build enhanced response data with focus on internal data
    const responseData = {
      response: finalResponse,
      sources: embeddingContext.sources,
      internetSources: internetContext.sources,
      hasInternetContext: internetContext.hasContent,
      contextFound: embeddingContext.hasRelevantContext,
      analysis: analysis,
      searchMetrics: {
        embeddingIterations: embeddingContext.searchIterations,
        finalSearchTerms: embeddingContext.finalSearchTerms,
        chunksFound: embeddingContext.chunks.length,
        targetedExtraction: databaseContext.targetedExtracts ? true : false,
        internetEnrichmentType: internetContext.enrichmentType
      },
      additionalDataUsed: {
        meetings: databaseContext.meetings?.length || 0,
        documents: databaseContext.documents?.length || 0,
        todos: databaseContext.todos?.length || 0,
        conversationHistory: conversationHistory?.length || 0,
        targetedSections: databaseContext.targetedExtracts?.sections?.length || 0,
        embeddingChunks: embeddingContext.chunks.length
      }
    };

    console.log('[AI-AGENT-OPHTACARE] ✅ Réponse générée avec succès');
    console.log(`[AI-AGENT-OPHTACARE] 📈 Résumé: Embeddings=${embeddingContext.chunks.length} chunks, Iterations=${embeddingContext.searchIterations}, Internet=${internetContext.hasContent ? 'YES' : 'NO'}`);

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[AI-AGENT-OPHTACARE] ❌ Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
