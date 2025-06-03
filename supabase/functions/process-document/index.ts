
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { DocumentProcessorFactory } from './document-processors.ts';
import { generateDocumentAnalysis, createFallbackAnalysis } from './ai-analysis.ts';
import { generateEmbeddings, chunkText } from './embeddings.ts';

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

    console.log(`📄 Processing: ${document.original_name} (${document.content_type})`);

    // Download file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.file_path);

    if (downloadError || !fileData) {
      throw new Error('Could not download file');
    }

    console.log(`📁 File downloaded: ${fileData.size} bytes`);

    // Process document using appropriate processor
    const processorFactory = new DocumentProcessorFactory();
    const processor = processorFactory.getProcessor(document.content_type);
    
    if (!processor) {
      const supportedTypes = processorFactory.getSupportedTypes();
      throw new Error(`Unsupported file type: ${document.content_type}. Supported types: ${supportedTypes.join(', ')}`);
    }

    let text = '';
    try {
      text = await processor.extractText(fileData, pdfcoApiKey);
      console.log(`📝 Text extracted successfully: ${text.length} characters`);
      
      if (!text || text.trim().length === 0) {
        throw new Error('Text extraction resulted in empty content');
      }
    } catch (extractionError) {
      console.error('❌ Text extraction failed:', extractionError);
      throw new Error(`Text extraction failed: ${extractionError.message}`);
    }

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
      fileType: document.content_type,
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

async function processDocumentInBackground(
  documentId: string,
  document: any,
  text: string,
  openaiApiKey: string,
  supabase: any
) {
  try {
    console.log('🤖 Starting AI analysis...');
    console.log(`📝 Processing text of ${text.length} characters`);

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

    // Prepare complete metadata
    const completeMetadata = {
      documentId: documentId,
      originalName: document.original_name,
      aiGeneratedName: analysis.suggestedName,
      aiSummary: analysis.summary,
      contentType: document.content_type,
      fileSize: document.file_size,
      processedAt: new Date().toISOString(),
      textLength: text.length,
      chunksGenerated: limitedChunks.length,
      embeddingsGenerated: embeddings.length,
      ...analysis.taxonomy
    };

    // Store embeddings with complete metadata if generated
    if (embeddings.length > 0) {
      console.log('💾 Storing document with embeddings and complete metadata...');
      try {
        await supabase.rpc('store_document_with_embeddings', {
          p_title: analysis.suggestedName,
          p_type: 'uploaded_document',
          p_content: text,
          p_chunks: limitedChunks,
          p_embeddings: embeddings,
          p_metadata: completeMetadata
        });
        console.log('✅ Document stored with embeddings and complete metadata successfully');
      } catch (error) {
        console.log('⚠️ Database storage failed:', error.message);
        console.log('⚠️ Error details:', error);
      }
    } else {
      console.log('⚠️ No embeddings generated, storing document without embeddings');
    }

    // IMPORTANT: Update uploaded_documents table with ALL metadata
    console.log('📝 Updating uploaded_documents table with complete metadata...');
    const { error: updateError } = await supabase
      .from('uploaded_documents')
      .update({
        ai_generated_name: analysis.suggestedName,
        ai_summary: analysis.summary,
        taxonomy: analysis.taxonomy,
        processed: true,
        metadata: completeMetadata
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('❌ Failed to update uploaded_documents:', updateError);
      throw updateError;
    }

    console.log(`🎉 Document ${documentId} processed successfully with complete metadata!`);

  } catch (error) {
    console.error('❌ Error in background processing:', error);
    
    // Mark as processed even on error with error details in metadata
    await supabase
      .from('uploaded_documents')
      .update({
        processed: true,
        ai_summary: `Erreur de traitement: ${error.message}`,
        metadata: {
          error: error.message,
          errorDetails: error.toString(),
          processedAt: new Date().toISOString(),
          processingFailed: true
        }
      })
      .eq('id', documentId);
  }
}
