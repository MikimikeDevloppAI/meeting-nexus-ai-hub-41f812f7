
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, useInternet = false, meetingId = null } = await req.json();
    
    console.log('[AI-AGENT] Processing message:', message.substring(0, 100) + '...');
    console.log('[AI-AGENT] Use internet:', useInternet);
    console.log('[AI-AGENT] Meeting ID:', meetingId);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Generate embedding for the user's message
    console.log('[AI-AGENT] Generating embedding for user message...');
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: message,
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error('Failed to generate embedding');
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Step 2: Search for relevant documents using embeddings
    console.log('[AI-AGENT] Searching for relevant documents...');
    const { data: searchResults, error: searchError } = await supabase.rpc('search_document_embeddings', {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      filter_document_type: 'meeting_transcript',
      match_threshold: 0.6,
      match_count: 8,
      filter_document_id: meetingId
    });

    if (searchError) {
      console.error('[AI-AGENT] Search error:', searchError);
    }

    let relevantContext = '';
    if (searchResults && searchResults.length > 0) {
      console.log(`[AI-AGENT] Found ${searchResults.length} relevant document chunks`);
      relevantContext = searchResults
        .map((result: any, index: number) => 
          `[Réunion ${index + 1} - Similarité: ${(result.similarity * 100).toFixed(1)}%]\n${result.chunk_text}`
        )
        .join('\n\n---\n\n');
    } else {
      console.log('[AI-AGENT] No relevant documents found');
    }

    // Step 3: Get internet information if requested and API key available
    let internetContext = '';
    if (useInternet && perplexityApiKey) {
      console.log('[AI-AGENT] Fetching internet information via Perplexity...');
      try {
        const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${perplexityApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-sonar-small-128k-online',
            messages: [
              {
                role: 'system',
                content: 'Tu es un assistant spécialisé dans la recherche d\'informations précises et actuelles. Fournis des informations factuelles, récentes et pertinentes en français.'
              },
              {
                role: 'user',
                content: `Recherche des informations récentes et pertinentes sur: ${message}`
              }
            ],
            temperature: 0.2,
            top_p: 0.9,
            max_tokens: 800,
            return_images: false,
            return_related_questions: false,
            search_recency_filter: 'month',
          }),
        });

        if (perplexityResponse.ok) {
          const perplexityData = await perplexityResponse.json();
          internetContext = perplexityData.choices[0].message.content;
          console.log('[AI-AGENT] Internet context retrieved successfully');
        }
      } catch (error) {
        console.error('[AI-AGENT] Perplexity error:', error);
      }
    }

    // Step 4: Generate contextual response with OpenAI
    console.log('[AI-AGENT] Generating contextual response...');
    
    const systemPrompt = `Tu es un assistant IA spécialisé pour un cabinet médical. Tu as accès à l'historique complet des réunions et transcripts du cabinet via une base de données vectorielle.

INSTRUCTIONS:
- Réponds de manière claire, précise et professionnelle en français
- Utilise le contexte des réunions passées pour enrichir tes réponses
- Si tu as des informations contradictoires, privilégie les plus récentes
- Cite tes sources quand tu utilises des informations spécifiques des réunions
- Si tu n'as pas assez d'informations, dis-le clairement
- Pour les recommandations, sois spécifique et actionnable
- Adapte ton niveau de détail selon la complexité de la question

CONTEXTE DISPONIBLE:
${relevantContext ? `\n=== HISTORIQUE DES RÉUNIONS ===\n${relevantContext}\n` : ''}
${internetContext ? `\n=== INFORMATIONS ACTUELLES ===\n${internetContext}\n` : ''}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 1500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate response');
    }

    const responseData = await response.json();
    const aiResponse = responseData.choices[0].message.content;

    console.log('[AI-AGENT] Response generated successfully');

    return new Response(JSON.stringify({ 
      response: aiResponse,
      sources: searchResults || [],
      hasInternetContext: !!internetContext,
      contextFound: !!relevantContext
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[AI-AGENT] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      response: "Désolé, je rencontre un problème technique. Pouvez-vous réessayer ?"
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
