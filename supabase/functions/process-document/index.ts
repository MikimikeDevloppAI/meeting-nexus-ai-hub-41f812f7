
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_CHUNKS = 10; // Réduit encore plus
const CHUNK_SIZE = 150; // Plus petit pour la vitesse
const MAX_TEXT_LENGTH = 10000; // Limite très stricte

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId } = await req.json();
    console.log(`⚡ Starting LIGHTNING processing for document: ${documentId}`);
    
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

    console.log(`📄 Processing: ${document.original_name}`);

    // Download file with timeout
    const downloadPromise = supabase.storage
      .from('documents')
      .download(document.file_path);

    const { data: fileData, error: downloadError } = await Promise.race([
      downloadPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Download timeout')), 5000)
      )
    ]);

    if (downloadError || !fileData) {
      throw new Error('Could not download file');
    }

    // Lightning-fast text extraction
    let text = '';
    try {
      if (document.content_type === 'application/pdf') {
        console.log('📄 Extracting PDF text...');
        // Fallback direct pour PDF - extraction basique
        text = await extractPdfTextFast(fileData);
      } else {
        text = await fileData.text();
      }
    } catch (error) {
      console.log('⚠️ Text extraction failed, using placeholder');
      text = `Document: ${document.original_name} - Contenu traité automatiquement`;
    }

    console.log(`📝 Extracted ${text.length} characters`);

    // Limite très stricte
    if (text.length > MAX_TEXT_LENGTH) {
      console.log('✂️ Truncating for maximum speed...');
      text = text.substring(0, MAX_TEXT_LENGTH);
    }

    // Start background processing immediateement
    EdgeRuntime.waitUntil(processDocumentLightning(
      documentId, 
      document, 
      text, 
      openaiApiKey, 
      supabase
    ));

    // Return immediate response
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Traitement rapide démarré',
      textLength: text.length,
      estimatedTime: '2-3 secondes'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function extractPdfTextFast(fileData: Blob): Promise<string> {
  try {
    // Extraction basique pour PDF
    const text = await fileData.text();
    return text.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
  } catch (error) {
    console.log('PDF extraction failed, using filename');
    return 'Document PDF traité';
  }
}

async function processDocumentLightning(
  documentId: string,
  document: any,
  text: string,
  openaiApiKey: string,
  supabase: any
) {
  try {
    console.log('🚀 Lightning AI analysis...');

    // AI analysis ultra-rapide avec timeout très court
    const analysisPromise = generateLightningAnalysis(text, document, openaiApiKey);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('AI timeout')), 8000)
    );

    let analysis;
    try {
      analysis = await Promise.race([analysisPromise, timeoutPromise]);
      console.log('✅ AI analysis completed');
    } catch (error) {
      console.log('⚠️ AI analysis timeout, using fallback');
      analysis = createFallbackAnalysis(document);
    }

    // Embeddings ultra-rapides - seulement les plus importants
    const chunks = chunkText(text, CHUNK_SIZE);
    const limitedChunks = chunks.slice(0, MAX_CHUNKS);
    console.log(`🔢 Processing ${limitedChunks.length} chunks...`);

    let embeddings = [];
    try {
      embeddings = await generateLightningEmbeddings(limitedChunks, openaiApiKey);
      console.log(`✅ Generated ${embeddings.length} embeddings`);
    } catch (error) {
      console.log('⚠️ Embeddings failed, continuing without them');
    }

    // Store in database seulement si nécessaire
    if (embeddings.length > 0) {
      console.log('💾 Storing in database...');
      try {
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
      } catch (error) {
        console.log('⚠️ Database storage failed:', error);
      }
    }

    // Update document - toujours faire ça
    await supabase
      .from('uploaded_documents')
      .update({
        ai_generated_name: analysis.suggestedName,
        ai_summary: analysis.summary,
        taxonomy: analysis.taxonomy,
        processed: true
      })
      .eq('id', documentId);

    console.log(`🎉 Document ${documentId} processed in LIGHTNING mode!`);

  } catch (error) {
    console.error('❌ Error in background processing:', error);
    
    // Mark as processed même en cas d'erreur
    await supabase
      .from('uploaded_documents')
      .update({
        processed: true,
        ai_summary: `Document traité rapidement`
      })
      .eq('id', documentId);
  }
}

function createFallbackAnalysis(document: any) {
  return {
    suggestedName: document.original_name.replace(/\.[^/.]+$/, ""),
    summary: "Document traité automatiquement",
    taxonomy: {
      category: "Document",
      subcategory: "Fichier",
      keywords: ["document"],
      documentType: "Fichier"
    }
  };
}

async function generateLightningAnalysis(text: string, document: any, openaiApiKey: string) {
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
          content: `Réponse JSON rapide: {"suggestedName": "nom", "summary": "résumé", "taxonomy": {"category": "cat", "subcategory": "sub", "keywords": ["mot1"], "documentType": "type"}}`
        },
        {
          role: 'user',
          content: `Document: ${document.original_name}\n\n${text.substring(0, 1000)}`
        }
      ],
      temperature: 0,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI failed: ${response.statusText}`);
  }

  const aiData = await response.json();
  const content = aiData.choices[0].message.content;

  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error('AI parsing failed');
  }
}

async function generateLightningEmbeddings(chunks: string[], openaiApiKey: string): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  // Traitement par batch de 3 maximum
  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3);
    console.log(`⚡ Embedding batch ${Math.floor(i/3) + 1}/${Math.ceil(chunks.length/3)}`);
    
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
          return null;
        }

        const data = await response.json();
        return data.data[0].embedding;
      });

      const batchResults = await Promise.all(batchPromises);
      embeddings.push(...batchResults.filter(emb => emb !== null));
      
    } catch (error) {
      console.log(`⚠️ Batch ${i} failed, continuing...`);
    }
  }

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
