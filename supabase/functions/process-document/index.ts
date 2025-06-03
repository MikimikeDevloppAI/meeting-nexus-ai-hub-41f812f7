
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_CHUNKS = 50; // Limitation du nombre de chunks
const CHUNK_SIZE = 300; // Taille réduite des chunks
const BATCH_SIZE = 10; // Traitement par lots pour les embeddings

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId } = await req.json();
    console.log(`Starting document processing for ID: ${documentId}`);
    
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

    console.log(`Processing document: ${document.original_name}`);

    // Download file content from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.file_path);

    if (downloadError || !fileData) {
      throw new Error('Could not download file');
    }

    // Extract text based on file type
    let text = '';
    if (document.content_type === 'application/pdf') {
      console.log('Extracting text from PDF...');
      // For now, we'll use a simplified text extraction
      // In production, you'd want to use a proper PDF parser
      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Simple text extraction (this is a fallback - in production use pdf-parse)
      try {
        text = new TextDecoder().decode(uint8Array);
        // Clean up binary data and extract readable text
        text = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
      } catch (e) {
        console.error('Error extracting PDF text:', e);
        text = 'Could not extract text from PDF';
      }
    } else {
      text = await fileData.text();
    }

    console.log(`Extracted text length: ${text.length} characters`);

    // Limite la taille du texte pour éviter les timeouts
    if (text.length > 50000) {
      console.log('Text too long, truncating...');
      text = text.substring(0, 50000);
    }

    // Start background processing
    EdgeRuntime.waitUntil(processDocumentInBackground(
      documentId, 
      document, 
      text, 
      openaiApiKey, 
      supabase
    ));

    // Return immediate response
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Document processing started in background',
      textLength: text.length
    }), {
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

async function processDocumentInBackground(
  documentId: string,
  document: any,
  text: string,
  openaiApiKey: string,
  supabase: any
) {
  try {
    console.log('Starting background AI analysis...');

    // Generate AI summary and taxonomy avec timeout
    const analysisPromise = generateAIAnalysis(text, document, openaiApiKey);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('AI analysis timeout')), 30000)
    );

    const analysis = await Promise.race([analysisPromise, timeoutPromise]);
    console.log('AI analysis completed');

    // Generate embeddings in batches
    const chunks = chunkText(text, CHUNK_SIZE);
    const limitedChunks = chunks.slice(0, MAX_CHUNKS);
    console.log(`Processing ${limitedChunks.length} chunks in batches of ${BATCH_SIZE}`);

    const embeddings = await generateEmbeddingsBatch(limitedChunks, openaiApiKey);
    console.log(`Generated ${embeddings.length} embeddings`);

    // Store embeddings in database if we have them
    if (embeddings.length > 0) {
      console.log('Storing embeddings in database...');
      await supabase.rpc('store_document_with_embeddings', {
        p_title: analysis.suggestedName,
        p_type: 'uploaded_document',
        p_content: text,
        p_chunks: limitedChunks,
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

    console.log(`Document ${documentId} processing completed successfully`);

  } catch (error) {
    console.error('Error in background processing:', error);
    
    // Mark as processed with error
    await supabase
      .from('uploaded_documents')
      .update({
        processed: true,
        ai_summary: `Erreur de traitement: ${error.message}`
      })
      .eq('id', documentId);
  }
}

async function generateAIAnalysis(text: string, document: any, openaiApiKey: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
          
          Réponds UNIQUEMENT en JSON valide avec cette structure exacte :
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
          content: `Analyse ce document :\n\nNom original: ${document.original_name}\n\nContenu:\n${text.substring(0, 3000)}`
        }
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI analysis failed: ${response.statusText}`);
  }

  const aiData = await response.json();
  const content = aiData.choices[0].message.content;

  try {
    return JSON.parse(content);
  } catch (e) {
    console.error('Failed to parse AI response as JSON:', content);
    // Fallback analysis
    return {
      suggestedName: document.original_name.replace(/\.[^/.]+$/, ""),
      summary: "Document traité automatiquement",
      taxonomy: {
        category: "Document",
        subcategory: "Non classifié",
        keywords: ["document"],
        documentType: "Fichier"
      }
    };
  }
}

async function generateEmbeddingsBatch(chunks: string[], openaiApiKey: string): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  // Process in batches to avoid rate limits and timeouts
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    console.log(`Processing embedding batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(chunks.length/BATCH_SIZE)}`);
    
    try {
      const batchPromises = batch.map(async (chunk) => {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
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

        if (!response.ok) {
          console.error(`Embedding failed for chunk: ${response.statusText}`);
          return null;
        }

        const data = await response.json();
        return data.data[0].embedding;
      });

      const batchResults = await Promise.all(batchPromises);
      embeddings.push(...batchResults.filter(emb => emb !== null));
      
      // Small delay between batches to respect rate limits
      if (i + BATCH_SIZE < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      console.error(`Error processing batch starting at ${i}:`, error);
      // Continue with next batch instead of failing completely
    }
  }

  console.log(`Successfully generated ${embeddings.length}/${chunks.length} embeddings`);
  return embeddings;
}

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
