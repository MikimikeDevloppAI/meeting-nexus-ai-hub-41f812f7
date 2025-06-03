
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
    const { message, documentId } = await req.json();
    console.log(`[DOCUMENT_CHAT] Processing message for document: ${documentId}`);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate embedding for the user's question
    console.log('[DOCUMENT_CHAT] Generating embedding for user question...');
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

    // Search for relevant document chunks using the document ID filter
    console.log('[DOCUMENT_CHAT] Searching document embeddings...');
    const { data: searchResults, error: searchError } = await supabase.rpc('search_document_embeddings', {
      query_embedding: queryEmbedding,
      filter_document_id: documentId,
      match_threshold: 0.7,
      match_count: 5
    });

    if (searchError) {
      console.error('[DOCUMENT_CHAT] Search error:', searchError);
      throw new Error('Failed to search document content');
    }

    console.log(`[DOCUMENT_CHAT] Found ${searchResults?.length || 0} relevant chunks`);

    // Get document info
    const { data: document, error: docError } = await supabase
      .from('uploaded_documents')
      .select('original_name, ai_generated_name, ai_summary')
      .eq('id', documentId)
      .single();

    if (docError) {
      console.error('[DOCUMENT_CHAT] Document error:', docError);
      throw new Error('Document not found');
    }

    // Prepare context from search results
    let context = '';
    if (searchResults && searchResults.length > 0) {
      context = searchResults
        .map(result => `Extrait du document (similarité: ${(result.similarity * 100).toFixed(1)}%):\n${result.chunk_text}`)
        .join('\n\n');
    }

    // If no relevant chunks found, use document summary
    if (!context && document.ai_summary) {
      context = `Résumé du document:\n${document.ai_summary}`;
    }

    // Generate response using OpenAI
    console.log('[DOCUMENT_CHAT] Generating AI response...');
    const systemPrompt = `Tu es un assistant IA spécialisé dans l'analyse de documents. Tu réponds uniquement aux questions concernant le document "${document.ai_generated_name || document.original_name}".

Règles importantes:
- Utilise uniquement les informations fournies dans le contexte du document
- Si l'information n'est pas dans le document, dis-le clairement
- Réponds en français de manière claire et précise
- Cite les parties pertinentes du document quand c'est utile
- Reste factuel et professionnel

Contexte du document:
${context || 'Aucun contenu spécifique trouvé pour cette question.'}`;

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
        max_tokens: 1000,
      }),
    });

    if (!chatResponse.ok) {
      throw new Error('Failed to generate AI response');
    }

    const chatData = await chatResponse.json();
    const response = chatData.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu générer une réponse.';

    console.log('[DOCUMENT_CHAT] Response generated successfully');

    return new Response(JSON.stringify({ 
      response,
      contextFound: searchResults && searchResults.length > 0,
      chunksUsed: searchResults?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[DOCUMENT_CHAT] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
