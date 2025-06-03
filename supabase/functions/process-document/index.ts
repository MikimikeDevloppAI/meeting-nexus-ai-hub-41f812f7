
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_CHUNKS = 30;
const CHUNK_SIZE = 400;
const MAX_TEXT_LENGTH = 80000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId } = await req.json();
    console.log(`📄 Starting processing for document: ${documentId}`);
    
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

    // Extract text based on file type
    let text = '';
    if (document.content_type === 'application/pdf') {
      console.log('📄 Extracting PDF text with PDF.co...');
      text = await extractPdfTextWithPdfCo(fileData, pdfcoApiKey);
    } else {
      text = await fileData.text();
    }

    console.log(`📝 Extracted ${text.length} characters`);

    // Limit text length for processing
    if (text.length > MAX_TEXT_LENGTH) {
      console.log('✂️ Truncating long document...');
      text = text.substring(0, MAX_TEXT_LENGTH) + '... [Document tronqué pour le traitement]';
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
      message: 'Traitement du document démarré',
      textLength: text.length,
      estimatedTime: '10-30 secondes selon la taille'
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

async function extractPdfTextWithPdfCo(fileData: Blob, apiKey: string): Promise<string> {
  try {
    console.log('🔄 Converting PDF to base64...');
    
    // Convert blob to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    console.log('📤 Uploading PDF to PDF.co...');

    // Upload file to PDF.co
    const uploadResponse = await fetch('https://api.pdf.co/v1/file/upload/base64', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: base64,
        name: 'document.pdf'
      }),
    });

    const uploadData = await uploadResponse.json();
    console.log('PDF.co upload response:', uploadData);

    if (!uploadResponse.ok || uploadData.error) {
      throw new Error(`Upload failed: ${uploadData.message || uploadResponse.statusText}`);
    }

    if (!uploadData.url) {
      throw new Error('Upload failed - no URL returned');
    }

    console.log('📤 PDF uploaded successfully, extracting text...');

    // Extract text from PDF
    const extractResponse = await fetch('https://api.pdf.co/v1/pdf/convert/to/text', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: uploadData.url,
        async: false
      }),
    });

    const extractData = await extractResponse.json();
    console.log('PDF.co extract response:', extractData);

    if (!extractResponse.ok || extractData.error) {
      throw new Error(`Text extraction failed: ${extractData.message || extractResponse.statusText}`);
    }

    if (!extractData.body) {
      throw new Error('No text extracted from PDF');
    }

    console.log('✅ PDF text extracted successfully');
    return extractData.body;

  } catch (error) {
    console.error('❌ PDF.co extraction failed:', error);
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
}

async function processDocumentInBackground(
  documentId: string,
  document: any,
  text: string,
  openaiApiKey: string,
  supabase: any
) {
  try {
    console.log('🤖 Starting AI analysis...');

    // AI analysis
    let analysis;
    try {
      analysis = await generateDocumentAnalysis(text, document, openaiApiKey);
      console.log('✅ AI analysis completed:', analysis);
    } catch (error) {
      console.error('❌ AI analysis failed:', error);
      analysis = createFallbackAnalysis(document);
    }

    // Generate embeddings for document chunks
    const chunks = chunkText(text, CHUNK_SIZE);
    const limitedChunks = chunks.slice(0, MAX_CHUNKS);
    console.log(`🔢 Processing ${limitedChunks.length} chunks for embeddings...`);

    let embeddings = [];
    try {
      embeddings = await generateEmbeddings(limitedChunks, openaiApiKey);
      console.log(`✅ Generated ${embeddings.length} embeddings`);
    } catch (error) {
      console.log('⚠️ Embeddings generation failed:', error.message);
    }

    // Store embeddings if generated
    if (embeddings.length > 0) {
      console.log('💾 Storing document with embeddings...');
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
        console.log('⚠️ Database storage failed:', error.message);
      }
    }

    // Update document record
    await supabase
      .from('uploaded_documents')
      .update({
        ai_generated_name: analysis.suggestedName,
        ai_summary: analysis.summary,
        taxonomy: analysis.taxonomy,
        processed: true
      })
      .eq('id', documentId);

    console.log(`🎉 Document ${documentId} processed successfully!`);

  } catch (error) {
    console.error('❌ Error in background processing:', error);
    
    // Mark as processed even on error
    await supabase
      .from('uploaded_documents')
      .update({
        processed: true,
        ai_summary: `Erreur de traitement: ${error.message}`
      })
      .eq('id', documentId);
  }
}

function createFallbackAnalysis(document: any) {
  return {
    suggestedName: document.original_name.replace(/\.[^/.]+$/, ""),
    summary: "Document traité automatiquement - analyse détaillée non disponible",
    taxonomy: {
      category: "Document",
      subcategory: "Fichier",
      keywords: ["document"],
      documentType: "Fichier uploadé"
    }
  };
}

async function generateDocumentAnalysis(text: string, document: any, openaiApiKey: string) {
  console.log('🤖 Calling OpenAI for document analysis...');
  
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
          content: `Tu es un expert en analyse de documents. Analysez ce document et retournez UNIQUEMENT un JSON valide avec cette structure exacte (pas de texte avant ou après le JSON):
{
  "suggestedName": "nom descriptif et professionnel du document",
  "summary": "résumé détaillé en 3-4 phrases décrivant le contenu principal",
  "taxonomy": {
    "category": "catégorie principale du document",
    "subcategory": "sous-catégorie spécifique",
    "keywords": ["mot-clé1", "mot-clé2", "mot-clé3", "mot-clé4"],
    "documentType": "type précis du document"
  }
}`
        },
        {
          role: 'user',
          content: `Analysez ce document:

Nom du fichier: ${document.original_name}

Contenu du document:
${text.substring(0, 4000)}${text.length > 4000 ? '...' : ''}

Retournez UNIQUEMENT le JSON de l'analyse.`
        }
      ],
      temperature: 0.3,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', errorText);
    throw new Error(`AI analysis failed: ${response.status} ${response.statusText}`);
  }

  const aiData = await response.json();
  const content = aiData.choices[0].message.content.trim();
  
  console.log('OpenAI response content:', content);

  try {
    // Try to extract JSON from the response if there's extra text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : content;
    
    const parsed = JSON.parse(jsonString);
    
    // Validate the structure
    if (!parsed.suggestedName || !parsed.summary || !parsed.taxonomy) {
      throw new Error('Invalid AI response structure');
    }
    
    return parsed;
  } catch (e) {
    console.error('AI response parsing failed:', e, 'Content:', content);
    throw new Error('AI response parsing failed');
  }
}

async function generateEmbeddings(chunks: string[], openaiApiKey: string): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  // Process in batches to avoid rate limits
  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3);
    console.log(`⚡ Processing embedding batch ${Math.floor(i/3) + 1}/${Math.ceil(chunks.length/3)}`);
    
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
          throw new Error(`Embedding failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.data[0].embedding;
      });

      const batchResults = await Promise.all(batchPromises);
      embeddings.push(...batchResults);
      
      // Small delay between batches
      if (i + 3 < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
    } catch (error) {
      console.log(`⚠️ Batch ${i} failed:`, error.message);
      // Continue with next batch
    }
  }

  return embeddings;
}

function chunkText(text: string, maxChunkSize: number): string[] {
  const chunks = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if ((currentChunk + ' ' + trimmedSentence).length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmedSentence;
    } else {
      currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
