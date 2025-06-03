
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_CHUNKS = 20; // Réduit drastiquement
const CHUNK_SIZE = 200; // Plus petit pour aller plus vite
const BATCH_SIZE = 5; // Plus petit

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId } = await req.json();
    console.log(`🚀 Starting ULTRA-FAST processing for document: ${documentId}`);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const pdfcoApiKey = Deno.env.get('PDFCO_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }
    if (!pdfcoApiKey) {
      throw new Error('PDF.co API key not configured');
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

    // Download file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.file_path);

    if (downloadError || !fileData) {
      throw new Error('Could not download file');
    }

    // Extract text super fast
    let text = '';
    if (document.content_type === 'application/pdf') {
      console.log('⚡ Using PDF.co for ULTRA-FAST extraction...');
      text = await extractTextWithPdfCoFast(fileData, pdfcoApiKey);
    } else {
      text = await fileData.text();
    }

    console.log(`📝 Extracted ${text.length} characters`);

    // Limite drastique pour la vitesse
    if (text.length > 20000) {
      console.log('✂️ Truncating for speed...');
      text = text.substring(0, 20000);
    }

    // Start ultra-fast background processing
    EdgeRuntime.waitUntil(processDocumentUltraFast(
      documentId, 
      document, 
      text, 
      openaiApiKey, 
      supabase
    ));

    // Return immediate response
    return new Response(JSON.stringify({ 
      success: true, 
      message: '🚀 ULTRA-FAST processing started with PDF.co!',
      textLength: text.length,
      estimatedTime: '5-8 seconds'
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

async function extractTextWithPdfCoFast(fileData: Blob, apiKey: string): Promise<string> {
  try {
    console.log('🔄 Converting to base64...');
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    console.log('📡 Calling PDF.co API...');
    const response = await fetch('https://api.pdf.co/v1/pdf/convert/to/text', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: `data:application/pdf;base64,${base64}`,
        async: false,
        inline: true,
        pages: "1-5" // Limite à 5 pages pour la vitesse
      }),
    });

    if (!response.ok) {
      console.error(`❌ PDF.co API error: ${response.status} ${response.statusText}`);
      throw new Error(`PDF.co API error: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('📊 PDF.co response received');
    
    if (!result.error && result.body) {
      console.log('✅ PDF.co extraction successful!');
      return result.body;
    } else {
      throw new Error(`PDF.co extraction failed: ${result.message || 'Unknown error'}`);
    }
    
  } catch (error) {
    console.error('❌ PDF.co failed, using fallback:', error);
    
    // Fallback ultra-simple
    try {
      const text = await fileData.text();
      return text.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError);
      return 'PDF text extraction failed';
    }
  }
}

async function processDocumentUltraFast(
  documentId: string,
  document: any,
  text: string,
  openaiApiKey: string,
  supabase: any
) {
  try {
    console.log('🤖 Starting AI analysis...');

    // AI analysis avec timeout court
    const analysis = await Promise.race([
      generateAIAnalysisFast(text, document, openaiApiKey),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI analysis timeout')), 15000)
      )
    ]);
    console.log('✅ AI analysis completed');

    // Génération d'embeddings ultra-rapide
    const chunks = chunkText(text, CHUNK_SIZE);
    const limitedChunks = chunks.slice(0, MAX_CHUNKS);
    console.log(`🔢 Processing ${limitedChunks.length} chunks...`);

    const embeddings = await generateEmbeddingsUltraFast(limitedChunks, openaiApiKey);
    console.log(`✅ Generated ${embeddings.length} embeddings`);

    // Store in database only if we have embeddings
    if (embeddings.length > 0) {
      console.log('💾 Storing in database...');
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

    // Update document
    await supabase
      .from('uploaded_documents')
      .update({
        ai_generated_name: analysis.suggestedName,
        ai_summary: analysis.summary,
        taxonomy: analysis.taxonomy,
        processed: true
      })
      .eq('id', documentId);

    console.log(`🎉 Document ${documentId} processing completed in ULTRA-FAST mode!`);

  } catch (error) {
    console.error('❌ Error in background processing:', error);
    
    // Mark as processed with error
    await supabase
      .from('uploaded_documents')
      .update({
        processed: true,
        ai_summary: `Traitement rapide terminé avec erreur: ${error.message}`
      })
      .eq('id', documentId);
  }
}

async function generateAIAnalysisFast(text: string, document: any, openaiApiKey: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // Modèle le plus rapide
      messages: [
        {
          role: 'system',
          content: `Analyse rapide en JSON : {"suggestedName": "nom", "summary": "résumé court", "taxonomy": {"category": "cat", "subcategory": "subcat", "keywords": ["mot1", "mot2"], "documentType": "type"}}`
        },
        {
          role: 'user',
          content: `Document: ${document.original_name}\n\nContenu:\n${text.substring(0, 2000)}`
        }
      ],
      temperature: 0.1, // Plus déterministe = plus rapide
      max_tokens: 300, // Très limité pour la vitesse
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
    console.error('Failed to parse AI response:', content);
    // Fallback ultra-simple
    return {
      suggestedName: document.original_name.replace(/\.[^/.]+$/, ""),
      summary: "Document traité en mode rapide",
      taxonomy: {
        category: "Document",
        subcategory: "Fichier",
        keywords: ["document"],
        documentType: "Fichier"
      }
    };
  }
}

async function generateEmbeddingsUltraFast(chunks: string[], openaiApiKey: string): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  // Traitement encore plus rapide
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    console.log(`⚡ Embedding batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(chunks.length/BATCH_SIZE)}`);
    
    try {
      const batchPromises = batch.map(async (chunk) => {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small', // Le plus rapide
            input: chunk,
          }),
        });

        if (!response.ok) {
          console.error(`Embedding failed: ${response.statusText}`);
          return null;
        }

        const data = await response.json();
        return data.data[0].embedding;
      });

      const batchResults = await Promise.all(batchPromises);
      embeddings.push(...batchResults.filter(emb => emb !== null));
      
    } catch (error) {
      console.error(`Error in batch ${i}:`, error);
      // Continue plutôt que de fail
    }
  }

  console.log(`🚀 Generated ${embeddings.length}/${chunks.length} embeddings`);
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
