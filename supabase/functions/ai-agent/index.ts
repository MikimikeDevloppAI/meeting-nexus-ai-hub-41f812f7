
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
    const { message, useInternet = false, meetingId = null, todoId = null } = await req.json();
    
    console.log('[AI-AGENT] Processing message:', message.substring(0, 100) + '...');
    console.log('[AI-AGENT] Use internet requested:', useInternet);
    console.log('[AI-AGENT] Meeting ID:', meetingId);
    console.log('[AI-AGENT] Todo ID:', todoId);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('[AI-AGENT] Perplexity API key available:', !!perplexityApiKey);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let relevantContext = '';
    let contextSources = [];

    // Amélioration de la détection automatique pour les recherches d'embeddings
    const shouldSearchEmbeddings = message.toLowerCase().includes('réunion') || 
                                   message.toLowerCase().includes('meeting') ||
                                   message.toLowerCase().includes('transcript') ||
                                   message.toLowerCase().includes('discussion') ||
                                   message.toLowerCase().includes('décision') ||
                                   message.toLowerCase().includes('tâche') ||
                                   message.toLowerCase().includes('task') ||
                                   todoId; // Always search for todo-specific questions

    if (shouldSearchEmbeddings) {
      console.log('[AI-AGENT] Generating embedding for context search...');
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

      if (embeddingResponse.ok) {
        const embeddingData = await embeddingResponse.json();
        const queryEmbedding = embeddingData.data[0].embedding;

        // Search for relevant documents using embeddings
        console.log('[AI-AGENT] Searching for relevant documents...');
        const { data: searchResults, error: searchError } = await supabase.rpc('search_document_embeddings', {
          query_embedding: `[${queryEmbedding.join(',')}]`,
          filter_document_type: 'meeting_transcript',
          match_threshold: 0.6,
          match_count: 8,
          filter_document_id: meetingId
        });

        if (!searchError && searchResults && searchResults.length > 0) {
          console.log(`[AI-AGENT] Found ${searchResults.length} relevant document chunks`);
          relevantContext = searchResults
            .map((result: any, index: number) => 
              `[Contexte ${index + 1} - Similarité: ${(result.similarity * 100).toFixed(1)}%]\n${result.chunk_text}`
            )
            .join('\n\n---\n\n');
          contextSources = searchResults;
        }
      }
    }

    // Amélioration de la détection automatique pour les recherches internet
    const shouldUseInternet = useInternet || 
                             message.toLowerCase().includes('recherche') ||
                             message.toLowerCase().includes('internet') ||
                             message.toLowerCase().includes('actualité') ||
                             message.toLowerCase().includes('récent') ||
                             message.toLowerCase().includes('nouveau') ||
                             message.toLowerCase().includes('prix') ||
                             message.toLowerCase().includes('fournisseur') ||
                             message.toLowerCase().includes('comparaison') ||
                             message.toLowerCase().includes('tendance');

    // Get internet information if requested/needed and API key available
    let internetContext = '';
    let internetSearchPerformed = false;
    
    if (shouldUseInternet && perplexityApiKey) {
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
                content: 'Tu es un assistant spécialisé dans la recherche d\'informations précises et actuelles. Fournis des informations factuelles, récentes et pertinentes en français. Sois CONCIS et DIRECT.'
              },
              {
                role: 'user',
                content: `Recherche des informations récentes et pertinentes sur: ${message}`
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
          internetContext = perplexityData.choices[0].message.content;
          internetSearchPerformed = true;
          console.log('[AI-AGENT] Internet context retrieved successfully');
        } else {
          console.error('[AI-AGENT] Perplexity API error:', perplexityResponse.status, await perplexityResponse.text());
        }
      } catch (error) {
        console.error('[AI-AGENT] Perplexity error:', error);
      }
    } else if (shouldUseInternet && !perplexityApiKey) {
      console.log('[AI-AGENT] Internet search requested but Perplexity API key not available');
    }

    // Generate contextual response with OpenAI
    console.log('[AI-AGENT] Generating response...');
    
    const systemPrompt = `Tu es un assistant IA intelligent pour OphtaCare Hub, un cabinet d'ophtalmologie. Tu peux répondre à toutes sortes de questions, pas seulement celles liées aux réunions.

STYLE DE COMMUNICATION - TRÈS IMPORTANT :
- Sois CONCIS et DIRECT dans tes réponses
- Évite les phrases d'introduction longues 
- Va droit au but sans politesses excessives
- Utilise des listes à puces pour structurer tes réponses
- Maximum 3-4 phrases par paragraphe
- Privilégie l'information actionnable

CAPACITÉS:
- Répondre aux questions générales comme n'importe quel assistant IA
- Utiliser le contexte des réunions passées quand pertinent
- Rechercher des informations actuelles sur internet quand activé
- Fournir des conseils spécialisés en ophtalmologie et gestion de cabinet

INSTRUCTIONS:
- Réponds toujours en français de manière claire et professionnelle
- Si tu as accès à des informations des réunions passées, utilise-les pour enrichir ta réponse
- Si tu as des informations d'internet, intègre-les naturellement
- Pour les questions générales, réponds normalement sans chercher obligatoirement dans les transcripts
- Adapte ton niveau de détail selon la complexité de la question
- Sois spécifique et actionnable dans tes recommandations
- RESTE CONCIS : évite les longues explications, privilégie l'essentiel

${relevantContext ? `\n=== CONTEXTE DES RÉUNIONS ===\n${relevantContext}\n` : ''}
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
        temperature: 0.2, // Réduction pour plus de cohérence
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate response');
    }

    const responseData = await response.json();
    const aiResponse = responseData.choices[0].message.content;

    console.log('[AI-AGENT] Response generated successfully');

    // Amélioration du message de retour pour informer sur les capacités
    let statusMessage = '';
    if (useInternet && !perplexityApiKey) {
      statusMessage = '\n\n💡 Note: La recherche internet n\'est pas disponible (clé API manquante).';
    } else if (useInternet && !internetSearchPerformed) {
      statusMessage = '\n\n💡 Note: Recherche internet demandée mais aucun contenu externe trouvé.';
    }

    return new Response(JSON.stringify({ 
      response: aiResponse + statusMessage,
      sources: contextSources || [],
      hasInternetContext: internetSearchPerformed,
      contextFound: !!relevantContext,
      internetAvailable: !!perplexityApiKey
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
