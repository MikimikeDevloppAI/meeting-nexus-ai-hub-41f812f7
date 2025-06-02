
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

    // Step 1: Generate embedding for the task description
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

      // Step 2: Search for similar tasks/contexts in past meetings
      console.log('[ENHANCED-TODO] Searching for similar contexts...');
      const { data: searchResults, error: searchError } = await supabase.rpc('search_document_embeddings', {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        filter_document_type: 'meeting_transcript',
        match_threshold: 0.7,
        match_count: 5
      });

      if (!searchError && searchResults && searchResults.length > 0) {
        console.log(`[ENHANCED-TODO] Found ${searchResults.length} similar contexts`);
        relevantContext = searchResults
          .map((result: any, index: number) => 
            `[Contexte similaire ${index + 1}]\n${result.chunk_text}`
          )
          .join('\n\n---\n\n');
      }
    }

    // Step 3: Get external information if it's beneficial for the task
    let externalInfo = '';
    const shouldUseInternet = description.toLowerCase().includes('recherche') || 
                              description.toLowerCase().includes('solution') ||
                              description.toLowerCase().includes('prestataire') ||
                              description.toLowerCase().includes('équipement') ||
                              description.toLowerCase().includes('formation');

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
                content: 'Tu es un assistant spécialisé dans les recommandations pour cabinet médical. Fournis des informations pratiques et actuelles en français.'
              },
              {
                role: 'user',
                content: `Pour un cabinet médical, donne des informations pratiques et récentes sur: ${description}`
              }
            ],
            temperature: 0.2,
            top_p: 0.9,
            max_tokens: 600,
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

    // Step 4: Generate comprehensive AI recommendation
    const prompt = `Tu es un assistant IA expert pour cabinet médical. Analyse cette tâche et fournis une recommandation UNIQUEMENT si elle peut apporter une valeur ajoutée significative.

TÂCHE À ANALYSER: ${description}

CONTEXTE DE LA RÉUNION:
Participants: ${participantList}
Contexte: ${meetingContext ? meetingContext.substring(0, 1000) + '...' : 'Non disponible'}

${relevantContext ? `EXPÉRIENCES PASSÉES SIMILAIRES:\n${relevantContext}\n` : ''}

${externalInfo ? `INFORMATIONS ACTUELLES:\n${externalInfo}\n` : ''}

INSTRUCTIONS IMPORTANTES:
- Réponds OBLIGATOIREMENT en français
- Si la tâche est simple et ne nécessite pas de conseil, réponds exactement: "Aucune recommandation supplémentaire nécessaire."
- Sinon, fournis des recommandations CONCRÈTES et ACTIONNABLES en français incluant:
  * Stratégies d'implémentation spécifiques au contexte médical
  * Points d'attention et défis potentiels
  * Ressources, outils ou contacts recommandés
  * Meilleures pratiques du secteur médical
  * Échéances et étapes suggérées
  * Coûts approximatifs si pertinent

- Utilise l'historique du cabinet pour adapter tes conseils
- Sois précis et professionnel
- Limite-toi à 200 mots maximum
- Concentre-toi sur la VALEUR AJOUTÉE réelle
- Réponds UNIQUEMENT en français`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Tu es un assistant expert pour cabinet médical qui fournit des recommandations concrètes et utiles UNIQUEMENT en français.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    const aiData = await response.json();
    const recommendation = aiData.choices[0].message.content.trim();

    // Only add comment if AI provides meaningful recommendations
    if (recommendation && !recommendation.toLowerCase().includes('aucune recommandation supplémentaire nécessaire')) {
      console.log('[ENHANCED-TODO] Adding enhanced AI recommendation...');
      
      // Add AI recommendation as a comment with enhanced formatting
      await supabase
        .from('todo_comments')
        .insert({
          todo_id: todoId,
          user_id: '00000000-0000-0000-0000-000000000000', // System user for AI
          comment: `🤖 **Recommandation IA Avancée:**\n\n${recommendation}${externalInfo ? '\n\n📊 *Informations basées sur des données actuelles et l\'historique du cabinet*' : '\n\n📋 *Recommandation basée sur l\'historique du cabinet*'}`
        });
      
      console.log('[ENHANCED-TODO] Enhanced recommendation added successfully');
    } else {
      console.log('[ENHANCED-TODO] No additional recommendations needed for this task');
    }

    // Mark that AI recommendation was generated
    await supabase
      .from('todos')
      .update({ ai_recommendation_generated: true })
      .eq('id', todoId);

    return new Response(JSON.stringify({ 
      success: true, 
      recommendation,
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
