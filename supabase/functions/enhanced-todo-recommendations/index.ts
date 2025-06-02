
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
    const { todoId, description, meetingContext, meetingId, participantList } = await req.json();
    
    console.log('[ENHANCED-TODO] Processing recommendation for:', description.substring(0, 50));
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if AI recommendation already generated
    const { data: todo } = await supabase
      .from('todos')
      .select('ai_recommendation_generated')
      .eq('id', todoId)
      .single();

    if (todo?.ai_recommendation_generated) {
      return new Response(JSON.stringify({ message: 'AI recommendation already generated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate embedding for the task description
    console.log('[ENHANCED-TODO] Generating embedding for task...');
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: description,
      }),
    });

    let relevantContext = '';
    if (embeddingResponse.ok) {
      const embeddingData = await embeddingResponse.json();
      const queryEmbedding = embeddingData.data[0].embedding;

      // Search for similar tasks/contexts in past meetings
      console.log('[ENHANCED-TODO] Searching for similar contexts...');
      const { data: searchResults, error: searchError } = await supabase.rpc('search_document_embeddings', {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        filter_document_type: 'meeting_transcript',
        match_threshold: 0.7,
        match_count: 3
      });

      if (!searchError && searchResults && searchResults.length > 0) {
        console.log(`[ENHANCED-TODO] Found ${searchResults.length} similar contexts`);
        relevantContext = searchResults
          .map((result: any, index: number) => 
            `[Contexte ${index + 1}]\n${result.chunk_text.substring(0, 300)}...`
          )
          .join('\n\n');
      }
    }

    // Get external information only for specific types of tasks
    let externalInfo = '';
    const shouldUseInternet = description.toLowerCase().includes('recherche') || 
                              description.toLowerCase().includes('solution') ||
                              description.toLowerCase().includes('prestataire') ||
                              description.toLowerCase().includes('équipement') ||
                              description.toLowerCase().includes('formation') ||
                              description.toLowerCase().includes('fournisseur');

    if (shouldUseInternet && perplexityApiKey) {
      console.log('[ENHANCED-TODO] Fetching external information...');
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
                content: 'Tu es un assistant spécialisé en ophtalmologie. Fournis des informations concises et pratiques en français.'
              },
              {
                role: 'user',
                content: `Pour un cabinet d'ophtalmologie, trouve des informations pratiques et récentes sur: ${description}`
              }
            ],
            temperature: 0.2,
            top_p: 0.9,
            max_tokens: 400,
            return_images: false,
            return_related_questions: false,
            search_recency_filter: 'month',
          }),
        });

        if (perplexityResponse.ok) {
          const perplexityData = await perplexityResponse.json();
          externalInfo = perplexityData.choices[0].message.content;
          console.log('[ENHANCED-TODO] External information retrieved');
        }
      } catch (error) {
        console.error('[ENHANCED-TODO] Perplexity error:', error);
      }
    }

    // Generate AI recommendation with strict filtering
    const prompt = `Tu es un assistant IA expert pour cabinet d'ophtalmologie. Analyse cette tâche et fournis une recommandation UNIQUEMENT si elle apporte une valeur ajoutée SIGNIFICATIVE.

TÂCHE: ${description}

CONTEXTE:
Participants: ${participantList}
${meetingContext ? `Réunion: ${meetingContext.substring(0, 500)}...` : ''}

${relevantContext ? `EXPÉRIENCES PASSÉES:\n${relevantContext}\n` : ''}
${externalInfo ? `INFORMATIONS ACTUELLES:\n${externalInfo}\n` : ''}

INSTRUCTIONS CRITIQUES:
- Réponds UNIQUEMENT en français
- Si la tâche est évidente, simple ou ne nécessite aucun conseil spécialisé, réponds exactement: "AUCUNE_RECOMMANDATION"
- Fournis une recommandation SEULEMENT si tu peux apporter:
  * Des conseils techniques spécialisés en ophtalmologie
  * Des informations sur des équipements, fournisseurs ou prestataires spécifiques
  * Des bonnes pratiques métier non évidentes
  * Des points d'attention critiques

- Si tu donnes une recommandation, sois TRÈS CONCIS (maximum 80 mots)
- Concentre-toi sur l'ESSENTIEL et l'ACTIONNABLE
- Évite les généralités et les conseils évidents`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Tu es un assistant expert en ophtalmologie qui ne donne des conseils que quand ils apportent une vraie valeur ajoutée. Sois très sélectif.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 150,
        temperature: 0.2,
      }),
    });

    const aiData = await response.json();
    const recommendation = aiData.choices[0].message.content.trim();

    // Only add comment if AI provides meaningful recommendations
    if (recommendation && 
        !recommendation.includes('AUCUNE_RECOMMANDATION') && 
        !recommendation.toLowerCase().includes('aucune recommandation') &&
        recommendation.length > 10) {
      
      console.log('[ENHANCED-TODO] Adding concise AI recommendation...');
      
      // Add AI recommendation as a comment
      await supabase
        .from('todo_comments')
        .insert({
          todo_id: todoId,
          user_id: '00000000-0000-0000-0000-000000000000', // System user for AI
          comment: `💡 **Conseil IA:** ${recommendation}`
        });
      
      console.log('[ENHANCED-TODO] Recommendation added successfully');
    } else {
      console.log('[ENHANCED-TODO] No valuable recommendation to add');
    }

    // Mark that AI recommendation was generated
    await supabase
      .from('todos')
      .update({ ai_recommendation_generated: true })
      .eq('id', todoId);

    return new Response(JSON.stringify({ 
      success: true, 
      recommendation: recommendation !== 'AUCUNE_RECOMMANDATION' ? recommendation : null,
      hasRelevantContext: !!relevantContext,
      hasExternalInfo: !!externalInfo
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ENHANCED-TODO] Error generating AI recommendation:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
