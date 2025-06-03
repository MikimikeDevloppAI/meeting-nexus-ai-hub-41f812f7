
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
    const { message } = await req.json();
    console.log(`[AI-AGENT] Processing message: ${message.substring(0, 100)}...`);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate embedding for the user's message
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

    let documentContext = '';
    let documentSources = [];
    let hasEmbeddingContext = false;

    if (embeddingResponse.ok) {
      const embeddingData = await embeddingResponse.json();
      const queryEmbedding = embeddingData.data[0].embedding;

      // Search in document embeddings with cosine similarity
      console.log('[AI-AGENT] Searching in document embeddings...');
      const { data: searchResults, error: searchError } = await supabase.rpc('search_document_embeddings', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: 5
      });

      if (!searchError && searchResults && searchResults.length > 0) {
        console.log(`[AI-AGENT] Found ${searchResults.length} relevant document chunks`);
        hasEmbeddingContext = true;
        documentContext = searchResults
          .map(result => `Document: ${result.metadata?.title || 'Document'}\nContenu: ${result.chunk_text}`)
          .join('\n\n');
        
        documentSources = searchResults.map(result => ({
          type: 'document_embedding',
          title: result.metadata?.title || 'Document',
          similarity: result.similarity,
          chunk_index: result.chunk_index
        }));
      } else {
        console.log('[AI-AGENT] No relevant document chunks found in embeddings');
      }
    } else {
      console.log('[AI-AGENT] Failed to generate embedding');
    }

    // Fetch additional context from database
    console.log('[AI-AGENT] Fetching additional context from database...');
    
    // Get meetings with their transcripts
    const { data: meetings } = await supabase
      .from('meetings')
      .select('id, title, transcript, summary, created_at')
      .not('transcript', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get documents with extracted text
    const { data: documents } = await supabase
      .from('uploaded_documents')
      .select('id, ai_generated_name, original_name, extracted_text, ai_summary, created_at')
      .not('extracted_text', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: todos } = await supabase
      .from('todos')
      .select('id, description, status, due_date, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    // Build additional context
    let meetingContext = '';
    let documentTextContext = '';
    let todoContext = '';
    
    if (meetings && meetings.length > 0) {
      meetingContext = `TRANSCRIPTS DES RÉUNIONS:\n${meetings.map(m => 
        `Réunion: ${m.title} (${new Date(m.created_at).toLocaleDateString()})\n${m.transcript ? `Transcript: ${m.transcript.substring(0, 1000)}...` : `Résumé: ${m.summary || 'Pas de résumé'}`}`
      ).join('\n\n')}\n\n`;
    }

    if (documents && documents.length > 0) {
      documentTextContext = `DOCUMENTS AVEC TEXTE EXTRAIT:\n${documents.map(d => 
        `Document: ${d.ai_generated_name || d.original_name}\nTexte: ${d.extracted_text ? d.extracted_text.substring(0, 1000) + '...' : 'Pas de texte extrait'}`
      ).join('\n\n')}\n\n`;
    }

    if (todos && todos.length > 0) {
      todoContext = `TÂCHES:\n${todos.map(t => 
        `- [${t.status}] ${t.description}${t.due_date ? ` (échéance: ${new Date(t.due_date).toLocaleDateString()})` : ''}`
      ).join('\n')}\n\n`;
    }

    // Use internet search only if no embedding context found
    let internetContext = '';
    let internetSources = [];
    let hasInternetContext = false;

    if (!hasEmbeddingContext && perplexityApiKey) {
      console.log('[AI-AGENT] No embedding context found, searching internet...');
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
                content: 'Recherche des informations actuelles et pertinentes pour répondre à la question de l\'utilisateur. Concentre-toi sur des sources fiables et récentes.'
              },
              {
                role: 'user',
                content: message
              }
            ],
            temperature: 0.2,
            max_tokens: 1000,
            return_images: false,
            return_related_questions: false,
            search_recency_filter: 'month'
          }),
        });

        if (perplexityResponse.ok) {
          const perplexityData = await perplexityResponse.json();
          internetContext = perplexityData.choices[0]?.message?.content || '';
          hasInternetContext = true;
          internetSources = [{ type: 'internet', source: 'Perplexity AI', query: message }];
          console.log('[AI-AGENT] Internet search completed');
        }
      } catch (error) {
        console.error('[AI-AGENT] Internet search error:', error);
      }
    }

    // Generate response using OpenAI with proper context prioritization
    console.log('[AI-AGENT] Generating response...');
    
    let systemPrompt = `Tu es un assistant IA spécialisé pour un cabinet médical. Tu as accès à plusieurs sources d'information dans cet ordre de priorité STRICT:

1. **EMBEDDINGS DE DOCUMENTS** (priorité absolue) : ${hasEmbeddingContext ? 'Informations trouvées dans les documents' : 'Aucune information trouvée'}
2. **TRANSCRIPTS DE RÉUNIONS** : Conversations complètes des réunions
3. **TEXTE EXTRAIT DES DOCUMENTS** : Contenu complet des documents uploadés
4. **TÂCHES ET DONNÉES INTERNES** : État des tâches et activités
5. **RECHERCHE INTERNET** : ${hasInternetContext ? 'Utilisée en dernier recours' : 'Non utilisée'}

RÈGLES STRICTES:
- Utilise EN PRIORITÉ ABSOLUE les informations des embeddings de documents si disponibles
- Complète avec les transcripts et texte extrait des documents si pertinent
- Utilise les données internes pour le contexte du cabinet
- N'utilise internet QUE si aucune information pertinente n'est trouvée dans les documents
- Cite TOUJOURS tes sources en précisant d'où viennent les informations
- Sois précis et professionnel
- Si tu veux créer, modifier ou supprimer une tâche, utilise la syntaxe: [ACTION_TACHE: TYPE=create/update/delete/complete, DESCRIPTION="description", ASSIGNED_TO="nom_utilisateur", DUE_DATE="YYYY-MM-DD", ID="id_tache"]

CONTEXTE DISPONIBLE:`;

    if (hasEmbeddingContext && documentContext) {
      systemPrompt += `\n\n**DOCUMENTS PERTINENTS (EMBEDDINGS - PRIORITÉ 1):**\n${documentContext}`;
    }

    if (meetingContext) {
      systemPrompt += `\n\n**TRANSCRIPTS DE RÉUNIONS:**\n${meetingContext}`;
    }

    if (documentTextContext) {
      systemPrompt += `\n\n**TEXTE EXTRAIT DES DOCUMENTS:**\n${documentTextContext}`;
    }

    if (todoContext) {
      systemPrompt += `\n\n**TÂCHES ET ACTIVITÉS:**\n${todoContext}`;
    }

    if (internetContext && !hasEmbeddingContext) {
      systemPrompt += `\n\n**INFORMATIONS INTERNET (DERNIER RECOURS):**\n${internetContext}`;
    }

    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!chatResponse.ok) {
      throw new Error('Failed to generate AI response');
    }

    const chatData = await chatResponse.json();
    const response = chatData.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu générer une réponse.';

    console.log('[AI-AGENT] Response generated successfully');

    return new Response(JSON.stringify({ 
      response,
      sources: documentSources,
      internetSources,
      hasInternetContext,
      contextFound: hasEmbeddingContext,
      additionalDataUsed: {
        meetings: meetings?.length || 0,
        documents: documents?.length || 0,
        todos: todos?.length || 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[AI-AGENT] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
