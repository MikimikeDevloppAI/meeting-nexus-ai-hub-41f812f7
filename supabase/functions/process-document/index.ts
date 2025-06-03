

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { DocumentProcessorFactory } from './document-processors.ts';
import { generateDocumentAnalysis, createFallbackAnalysis } from './ai-analysis.ts';
import { generateEmbeddings, chunkText, formatEmbeddingsForPostgres } from './embeddings.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_CHUNKS = 20;
const CHUNK_SIZE = 350;
const MAX_TEXT_LENGTH = 50000;

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
      console.error('❌ Document not found:', docError);
      throw new Error('Document not found');
    }

    console.log(`📄 Processing: ${document.original_name} (${document.content_type})`);

    // Download file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.file_path);

    if (downloadError || !fileData) {
      console.error('❌ File download failed:', downloadError);
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
      estimatedTime: '20-45 secondes selon la taille'
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
    console.log('🤖 Starting background AI analysis and vectorization...');
    console.log(`📝 Processing text of ${text.length} characters`);

    // STEP 1: Save extracted text to uploaded_documents table
    console.log('💾 Saving extracted text to uploaded_documents...');
    const { error: textUpdateError } = await supabase
      .from('uploaded_documents')
      .update({
        extracted_text: text
      })
      .eq('id', documentId);

    if (textUpdateError) {
      console.error('❌ Failed to save extracted text:', textUpdateError);
      throw textUpdateError;
    }

    console.log('✅ Extracted text saved successfully');

    // STEP 2: AI analysis
    let analysis;
    try {
      analysis = await generateDocumentAnalysis(text, document, openaiApiKey);
      console.log('✅ AI analysis completed successfully');
    } catch (error) {
      console.error('❌ AI analysis failed:', error);
      analysis = createFallbackAnalysis(document);
    }

    // STEP 3: Generate text chunks for embeddings
    const chunks = chunkText(text, CHUNK_SIZE);
    const limitedChunks = chunks.slice(0, MAX_CHUNKS);
    console.log(`🔢 Created ${limitedChunks.length} chunks for embeddings (limited from ${chunks.length})`);

    // Prepare comprehensive metadata
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
      processingVersion: '2.2',
      ...analysis.taxonomy
    };

    // STEP 4: Generate and store embeddings
    let embeddingsSuccess = false;
    let vectorDocumentId = null;

    if (limitedChunks.length > 0) {
      try {
        console.log('🔄 Starting embeddings generation...');
        const embeddings = await generateEmbeddings(limitedChunks, openaiApiKey);
        
        if (embeddings.length === limitedChunks.length) {
          console.log(`✅ Generated ${embeddings.length} embeddings successfully`);
          
          // Format embeddings for PostgreSQL
          console.log('🔧 Formatting embeddings for PostgreSQL...');
          const formattedEmbeddings = formatEmbeddingsForPostgres(embeddings);
          
          // Store embeddings with proper format
          console.log('💾 Storing document with embeddings in vector database...');
          const { data: storedDocId, error: storeError } = await supabase.rpc('store_document_with_embeddings', {
            p_title: analysis.suggestedName,
            p_type: 'uploaded_document',
            p_content: text,
            p_chunks: limitedChunks,
            p_embeddings: formattedEmbeddings,
            p_metadata: completeMetadata
          });

          if (storeError) {
            console.error('❌ Vector storage failed:', storeError);
            console.error('Error details:', JSON.stringify(storeError, null, 2));
            throw storeError;
          }
          
          console.log('✅ Document stored in vector database with ID:', storedDocId);
          vectorDocumentId = storedDocId;
          embeddingsSuccess = true;
          
        } else {
          console.error('⚠️ Embeddings count mismatch:', embeddings.length, 'vs', limitedChunks.length);
          completeMetadata.embeddingsMismatch = true;
        }
        
      } catch (error) {
        console.error('❌ Embeddings generation/storage failed:', error);
        console.error('Error stack:', error.stack);
        completeMetadata.embeddingsError = error.message;
      }
    } else {
      console.log('⚠️ No chunks available for embedding generation');
      completeMetadata.noChunksAvailable = true;
    }

    // Add final status to metadata
    completeMetadata.embeddingsGenerated = embeddingsSuccess ? limitedChunks.length : 0;
    completeMetadata.embeddingsSuccess = embeddingsSuccess;
    completeMetadata.vectorDocumentId = vectorDocumentId;

    // STEP 5: Update uploaded_documents table with ALL metadata
    console.log('📝 Updating uploaded_documents table with complete processing results...');
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
      console.error('❌ Failed to update uploaded_documents table:', updateError);
      throw updateError;
    }

    console.log(`🎉 Document ${documentId} processing completed successfully!`);
    console.log(`📊 Summary: ${embeddingsSuccess ? 'WITH' : 'WITHOUT'} embeddings, ${chunks.length} chunks, ${text.length} chars`);

  } catch (error) {
    console.error('❌ Background processing failed:', error);
    
    // Always mark as processed with error details
    try {
      await supabase
        .from('uploaded_documents')
        .update({
          processed: true,
          ai_summary: `Erreur de traitement: ${error.message}`,
          metadata: {
            error: error.message,
            errorDetails: error.toString(),
            processedAt: new Date().toISOString(),
            processingFailed: true,
            processingVersion: '2.2'
          }
        })
        .eq('id', documentId);
    } catch (updateError) {
      console.error('❌ Failed to update document with error:', updateError);
    }
  }
}

