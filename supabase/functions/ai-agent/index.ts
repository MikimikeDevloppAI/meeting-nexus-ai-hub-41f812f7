
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
    console.log(`[AI-AGENT-OPHTACARE] 🏥 Processing query: ${message.substring(0, 100)}...`);
    console.log(`[AI-AGENT-OPHTACARE] 💬 History: ${conversationHistory ? conversationHistory.length : 0} messages`);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialiser les agents
    const coordinator = new CoordinatorAgent(openaiApiKey);
    const databaseAgent = new DatabaseAgent(supabase);
    const embeddingsAgent = new EmbeddingsAgent(openaiApiKey, supabase);
    const internetAgent = new InternetAgent(perplexityApiKey);
    const synthesisAgent = new SynthesisAgent(openaiApiKey);

    // 1. COORDINATION : Analyser la requête
    console.log('[AI-AGENT-OPHTACARE] 🧠 Phase 1: Query analysis');
    const analysis = await coordinator.analyzeQuery(message, conversationHistory || []);
    console.log('[AI-AGENT-OPHTACARE] 📊 Analysis result:', analysis);

    // 2. BASE DE DONNÉES : Récupérer le contexte structuré
    console.log('[AI-AGENT-OPHTACARE] 🗄️ Phase 2: Database context');
    const databaseContext = analysis.requiresDatabase 
      ? await databaseAgent.searchContext(analysis)
      : { meetings: [], documents: [], todos: [], relevantIds: { meetingIds: [], documentIds: [] } };

    // 3. EMBEDDINGS : Recherche sémantique ciblée
    console.log('[AI-AGENT-OPHTACARE] 🎯 Phase 3: Semantic search');
    const embeddingContext = analysis.requiresEmbeddings
      ? await embeddingsAgent.searchEmbeddings(message, databaseContext.relevantIds)
      : { chunks: [], sources: [], hasRelevantContext: false };

    // 4. INTERNET : Enrichissement si nécessaire
    console.log('[AI-AGENT-OPHTACARE] 🌐 Phase 4: Internet enrichment');
    const shouldUseInternet = analysis.requiresInternet || (!embeddingContext.hasRelevantContext && analysis.queryType === 'general');
    const internetContext = shouldUseInternet
      ? await internetAgent.searchInternet(message, embeddingContext.hasRelevantContext)
      : { content: '', sources: [], hasContent: false };

    // 5. SYNTHÈSE : Générer la réponse finale
    console.log('[AI-AGENT-OPHTACARE] ⚡ Phase 5: Response synthesis');
    const finalResponse = await synthesisAgent.synthesizeResponse(
      message,
      conversationHistory || [],
      databaseContext,
      embeddingContext,
      internetContext
    );

    // Construire la réponse complète
    const responseData = {
      response: finalResponse,
      sources: embeddingContext.sources,
      internetSources: internetContext.sources,
      hasInternetContext: internetContext.hasContent,
      contextFound: embeddingContext.hasRelevantContext,
      analysis: analysis,
      additionalDataUsed: {
        meetings: databaseContext.meetings?.length || 0,
        documents: databaseContext.documents?.length || 0,
        todos: databaseContext.todos?.length || 0,
        conversationHistory: conversationHistory?.length || 0
      }
    };

    console.log('[AI-AGENT-OPHTACARE] ✅ Response generated successfully');
    console.log(`[AI-AGENT-OPHTACARE] 📈 Context summary: DB=${analysis.requiresDatabase ? 'YES' : 'NO'}, Embeddings=${embeddingContext.hasRelevantContext ? 'YES' : 'NO'}, Internet=${internetContext.hasContent ? 'YES' : 'NO'}`);

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
