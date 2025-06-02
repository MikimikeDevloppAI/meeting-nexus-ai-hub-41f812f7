

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
    const { message, meetingId = null, todoId = null } = await req.json();
    
    console.log('[AI-AGENT] Processing message:', message.substring(0, 100) + '...');
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
    let additionalContext = '';

    // Recherche dans les embeddings pour la plupart des questions
    const shouldSearchEmbeddings = !message.toLowerCase().includes('internet') && 
                                   !message.toLowerCase().includes('web') &&
                                   !message.toLowerCase().includes('en ligne');

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
          match_threshold: 0.5,
          match_count: 10,
          filter_document_id: meetingId
        });

        if (!searchError && searchResults && searchResults.length > 0) {
          console.log(`[AI-AGENT] Found ${searchResults.length} relevant document chunks`);
          relevantContext = searchResults
            .map((result: any, index: number) => 
              `[Source ${index + 1} - Document ID: ${result.document_id} - Similarité: ${(result.similarity * 100).toFixed(1)}%]\n${result.chunk_text}`
            )
            .join('\n\n---\n\n');
          contextSources = searchResults;
        } else {
          console.log('[AI-AGENT] No relevant context found in embeddings');
        }
      }

      // Recherche dans les données générales de la base
      console.log('[AI-AGENT] Fetching additional context from database...');
      
      // Récupérer les réunions récentes avec transcripts complets
      const { data: recentMeetings } = await supabase
        .from('meetings')
        .select('id, title, created_at, summary, transcript')
        .order('created_at', { ascending: false })
        .limit(5);

      // Récupérer les TODOs en cours
      const { data: activeTodos } = await supabase
        .from('todos')
        .select(`
          id, description, status, created_at, due_date,
          assigned_to,
          participants:participants(name)
        `)
        .neq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(10);

      // Récupérer les participants
      const { data: participants } = await supabase
        .from('participants')
        .select('id, name, email')
        .order('name');

      // Construire le contexte additionnel
      let dbContext = [];
      
      if (recentMeetings && recentMeetings.length > 0) {
        // Vérifier si la demande concerne spécifiquement un transcript
        const requestsTranscript = message.toLowerCase().includes('transcript') || 
                                  message.toLowerCase().includes('transcription') ||
                                  message.toLowerCase().includes('verbatim') ||
                                  message.toLowerCase().includes('conversation') ||
                                  message.toLowerCase().includes('discussion');

        if (requestsTranscript) {
          dbContext.push(`=== RÉUNIONS RÉCENTES AVEC TRANSCRIPTS ===\n${recentMeetings.map(m => {
            let meetingInfo = `- ${m.title} (${new Date(m.created_at).toLocaleDateString('fr-FR')})`;
            if (m.summary) {
              meetingInfo += `\n  Résumé: ${m.summary}`;
            }
            if (m.transcript) {
              meetingInfo += `\n  Transcript complet: ${m.transcript}`;
            } else {
              meetingInfo += `\n  Transcript: Non disponible`;
            }
            return meetingInfo;
          }).join('\n\n')}`);
        } else {
          dbContext.push(`=== RÉUNIONS RÉCENTES ===\n${recentMeetings.map(m => 
            `- ${m.title} (${new Date(m.created_at).toLocaleDateString('fr-FR')})\n  Résumé: ${m.summary || 'Pas de résumé disponible'}`
          ).join('\n')}`);
        }
      }

      if (activeTodos && activeTodos.length > 0) {
        dbContext.push(`=== TÂCHES EN COURS ===\n${activeTodos.map(t => 
          `- ${t.description} (${t.status})\n  Échéance: ${t.due_date ? new Date(t.due_date).toLocaleDateString('fr-FR') : 'Non définie'}\n  Assigné: ${t.participants?.name || 'Non assigné'}`
        ).join('\n')}`);
      }

      if (participants && participants.length > 0) {
        dbContext.push(`=== PARTICIPANTS ===\n${participants.map(p => 
          `- ${p.name} (${p.email})`
        ).join('\n')}`);
      }

      additionalContext = dbContext.join('\n\n');
    }

    // Détection automatique pour les recherches internet
    const shouldUseInternet = message.toLowerCase().includes('recherche') ||
                             message.toLowerCase().includes('actualité') ||
                             message.toLowerCase().includes('récent') ||
                             message.toLowerCase().includes('nouveau') ||
                             message.toLowerCase().includes('prix') ||
                             message.toLowerCase().includes('coût') ||
                             message.toLowerCase().includes('tarif') ||
                             message.toLowerCase().includes('fournisseur') ||
                             message.toLowerCase().includes('prestataire') ||
                             message.toLowerCase().includes('équipement') ||
                             message.toLowerCase().includes('formation') ||
                             message.toLowerCase().includes('comparaison') ||
                             message.toLowerCase().includes('tendance') ||
                             message.toLowerCase().includes('solution') ||
                             message.toLowerCase().includes('technologie') ||
                             message.toLowerCase().includes('produit') ||
                             message.toLowerCase().includes('service') ||
                             message.toLowerCase().includes('logiciel') ||
                             message.toLowerCase().includes('matériel') ||
                             message.toLowerCase().includes('clinique') ||
                             message.toLowerCase().includes('hôpital') ||
                             message.toLowerCase().includes('médecin') ||
                             message.toLowerCase().includes('concurrence') ||
                             message.toLowerCase().includes('marché') ||
                             message.toLowerCase().includes('recommandation');

    // Get internet information if needed and API key available
    let internetContext = '';
    let internetSearchPerformed = false;
    let internetSources = [];
    
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
                content: 'Tu es un assistant spécialisé dans la recherche d\'informations précises et actuelles pour un cabinet d\'ophtalmologie situé à Genève, en Suisse. Fournis des informations factuelles, récentes et pertinentes en français. Sois CONCIS et DIRECT. Pour tous les prix, utilise les francs suisses (CHF). Cite toujours tes sources avec des liens.'
              },
              {
                role: 'user',
                content: `Pour un cabinet d'ophtalmologie à Genève, Suisse, recherche des informations récentes et pertinentes sur: ${message}`
              }
            ],
            temperature: 0.2,
            top_p: 0.9,
            max_tokens: 800,
            return_images: false,
            return_related_questions: false,
            search_recency_filter: 'month',
            return_citations: true,
          }),
        });

        if (perplexityResponse.ok) {
          const perplexityData = await perplexityResponse.json();
          internetContext = perplexityData.choices[0].message.content;
          internetSearchPerformed = true;
          
          // Extraire les citations/sources si disponibles
          if (perplexityData.citations && perplexityData.citations.length > 0) {
            internetSources = perplexityData.citations;
            console.log('[AI-AGENT] Found', internetSources.length, 'internet sources');
          }
          
          console.log('[AI-AGENT] Internet context retrieved successfully');
        } else {
          console.error('[AI-AGENT] Perplexity API error:', perplexityResponse.status, await perplexityResponse.text());
        }
      } catch (error) {
        console.error('[AI-AGENT] Perplexity error:', error);
      }
    }

    // Generate contextual response with OpenAI
    console.log('[AI-AGENT] Generating response...');
    
    const systemPrompt = `Tu es un assistant IA intelligent pour OphtaCare Hub, un cabinet d'ophtalmologie situé à Genève, en Suisse. Tu peux répondre à toutes sortes de questions, pas seulement celles liées aux réunions.

CONTEXTE IMPORTANT :
- Cabinet d'ophtalmologie à Genève, Suisse
- Pour tous les prix, utilise TOUJOURS les francs suisses (CHF)
- Adapte tes conseils au contexte suisse et genevois

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
- Utiliser des informations actuelles d'internet quand pertinent
- Fournir des conseils spécialisés en ophtalmologie et gestion de cabinet
- Donner des informations spécifiques au marché suisse/genevois
- Accéder aux transcripts complets des réunions quand demandé

INSTRUCTIONS:
- Réponds toujours en français de manière claire et professionnelle
- Si tu as accès à des informations des réunions passées, utilise-les pour enrichir ta réponse
- Si tu as des informations d'internet, intègre-les naturellement
- Pour les questions générales, réponds normalement sans chercher obligatoirement dans les transcripts
- Adapte ton niveau de détail selon la complexité de la question
- Sois spécifique et actionnable dans tes recommandations
- RESTE CONCIS : évite les longues explications, privilégie l'essentiel
- Pour tous les prix mentionnés, utilise les CHF (francs suisses)
- Si tu utilises des informations d'internet, mentionne-le naturellement dans ta réponse
- Si tu utilises des sources internes (documents, réunions), mentionne clairement les documents consultés
- Si on te demande un transcript, fournis-le intégralement si disponible

${relevantContext ? `\n=== CONTEXTE DES RÉUNIONS/DOCUMENTS ===\n${relevantContext}\n` : ''}
${additionalContext ? `\n=== CONTEXTE GÉNÉRAL DE LA BASE ===\n${additionalContext}\n` : ''}
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
        temperature: 0.2,
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
      sources: contextSources || [],
      internetSources: internetSources || [],
      hasInternetContext: internetSearchPerformed,
      contextFound: !!relevantContext || !!additionalContext,
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
