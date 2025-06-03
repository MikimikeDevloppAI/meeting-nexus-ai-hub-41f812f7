
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
    const { message, conversationHistory } = await req.json();
    console.log(`[AI-AGENT-OPHTACARE] 🏥 Processing enhanced query: ${message.substring(0, 100)}...`);
    console.log(`[AI-AGENT-OPHTACARE] 💬 History: ${conversationHistory ? conversationHistory.length : 0} messages`);
    
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

    // 1. ENHANCED COORDINATION: Analyze query with semantic expansion
    console.log('[AI-AGENT-OPHTACARE] 🧠 Phase 1: Enhanced query analysis');
    const analysis = await coordinator.analyzeQuery(message, conversationHistory || []);
    console.log('[AI-AGENT-OPHTACARE] 📊 Enhanced analysis result:', analysis);

    // 2. INTELLIGENT DATABASE SEARCH: Context-aware and targeted
    console.log('[AI-AGENT-OPHTACARE] 🗄️ Phase 2: Intelligent database search');
    const databaseContext = analysis.requiresDatabase 
      ? await databaseAgent.searchContext(analysis)
      : { meetings: [], documents: [], todos: [], relevantIds: { meetingIds: [], documentIds: [] } };

    // 3. ITERATIVE EMBEDDINGS SEARCH: Multi-term with fallback
    console.log('[AI-AGENT-OPHTACARE] 🎯 Phase 3: Iterative semantic search');
    const embeddingContext = analysis.requiresEmbeddings
      ? await embeddingsAgent.searchEmbeddings(message, analysis, databaseContext.relevantIds)
      : { chunks: [], sources: [], hasRelevantContext: false, searchIterations: 0, finalSearchTerms: [] };

    // 4. STRATEGIC INTERNET ENRICHMENT: Context-aware enhancement
    console.log('[AI-AGENT-OPHTACARE] 🌐 Phase 4: Strategic internet enrichment');
    const shouldUseInternet = analysis.requiresInternet || 
                              (!embeddingContext.hasRelevantContext && analysis.queryType === 'general') ||
                              (embeddingContext.hasRelevantContext && analysis.requiresInternet);
    
    const internetContext = shouldUseInternet
      ? await internetAgent.searchInternet(message, analysis, embeddingContext.hasRelevantContext)
      : { content: '', sources: [], hasContent: false, enrichmentType: 'supplement' };

    // 5. INTELLIGENT SYNTHESIS: Critical evaluation and comprehensive response
    console.log('[AI-AGENT-OPHTACARE] ⚡ Phase 5: Intelligent response synthesis');
    
    // Provide feedback to coordinator for potential re-search
    const searchFeedback = await coordinator.provideFeedback({
      meetings: databaseContext.meetings,
      chunks: embeddingContext.chunks,
      content: internetContext.content
    }, message);

    // If search was insufficient and we can retry, perform additional searches
    if (!searchFeedback.success && searchFeedback.needsExpansion && searchFeedback.suggestedTerms) {
      console.log('[AI-AGENT-OPHTACARE] 🔄 Performing fallback search with expanded terms');
      
      const fallbackContext = await embeddingsAgent.searchWithFallback(
        message, 
        searchFeedback.suggestedTerms,
        databaseContext.relevantIds
      );
      
      // Merge fallback results
      if (fallbackContext.hasRelevantContext) {
        embeddingContext.chunks.push(...fallbackContext.chunks);
        embeddingContext.sources.push(...fallbackContext.sources);
        embeddingContext.hasRelevantContext = true;
        embeddingContext.searchIterations += fallbackContext.searchIterations;
      }
    }

    const finalResponse = await synthesisAgent.synthesizeResponse(
      message,
      conversationHistory || [],
      databaseContext,
      embeddingContext,
      internetContext,
      analysis
    );

    // Build enhanced response data
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
        targetedExtraction: databaseContext.targetedExtracts ? true : false,
        internetEnrichmentType: internetContext.enrichmentType
      },
      additionalDataUsed: {
        meetings: databaseContext.meetings?.length || 0,
        documents: databaseContext.documents?.length || 0,
        todos: databaseContext.todos?.length || 0,
        conversationHistory: conversationHistory?.length || 0,
        targetedSections: databaseContext.targetedExtracts?.sections?.length || 0
      }
    };

    console.log('[AI-AGENT-OPHTACARE] ✅ Enhanced response generated successfully');
    console.log(`[AI-AGENT-OPHTACARE] 📈 Enhanced context summary: DB=${analysis.requiresDatabase ? 'YES' : 'NO'}, Embeddings=${embeddingContext.hasRelevantContext ? 'YES' : 'NO'}, Internet=${internetContext.hasContent ? 'YES' : 'NO'}, Iterations=${embeddingContext.searchIterations}`);

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
