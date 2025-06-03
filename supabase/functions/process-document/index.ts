
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
    const { documentId } = await req.json();
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get document info
    const { data: document, error: docError } = await supabase
      .from('uploaded_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    // Download file content from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.file_path);

    if (downloadError || !fileData) {
      throw new Error('Could not download file');
    }

    // Convert to text (simplified - in production you'd use proper PDF parsing)
    const text = await fileData.text();
    
    // Generate AI summary and taxonomy
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Tu es un assistant spécialisé dans l'analyse de documents pour un cabinet d'ophtalmologie. 
            Analyse le document et fournis :
            1. Un nom de fichier descriptif et professionnel (sans extension)
            2. Un résumé concis du contenu
            3. Une taxonomie avec catégorie, sous-catégorie et mots-clés
            
            Réponds en JSON avec cette structure :
            {
              "suggestedName": "nom descriptif du fichier",
              "summary": "résumé du document",
              "taxonomy": {
                "category": "catégorie principale",
                "subcategory": "sous-catégorie",
                "keywords": ["mot-clé1", "mot-clé2", "mot-clé3"],
                "documentType": "type de document"
              }
            }`
          },
          {
            role: 'user',
            content: `Analyse ce document :\n\nNom original: ${document.original_name}\n\nContenu:\n${text.substring(0, 4000)}`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error('Failed to analyze document with AI');
    }

    const aiData = await aiResponse.json();
    const analysis = JSON.parse(aiData.choices[0].message.content);

    // Generate embeddings for document chunks
    const chunks = chunkText(text, 500);
    const embeddings = [];
    
    for (const chunk of chunks) {
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: chunk,
        }),
      });

      if (embeddingResponse.ok) {
        const embeddingData = await embeddingResponse.json();
        embeddings.push(embeddingData.data[0].embedding);
      }
    }

    // Store embeddings in database
    if (embeddings.length > 0) {
      await supabase.rpc('store_document_with_embeddings', {
        p_title: analysis.suggestedName,
        p_type: 'uploaded_document',
        p_content: text,
        p_chunks: chunks,
        p_embeddings: embeddings,
        p_metadata: {
          documentId: documentId,
          originalName: document.original_name,
          ...analysis.taxonomy
        }
      });
    }

    // Update document with AI analysis
    await supabase
      .from('uploaded_documents')
      .update({
        ai_generated_name: analysis.suggestedName,
        ai_summary: analysis.summary,
        taxonomy: analysis.taxonomy,
        processed: true
      })
      .eq('id', documentId);

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing document:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function chunkText(text: string, maxChunkSize: number): string[] {
  const chunks = [];
  const words = text.split(' ');
  let currentChunk = '';

  for (const word of words) {
    if ((currentChunk + ' ' + word).length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = word;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + word;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
