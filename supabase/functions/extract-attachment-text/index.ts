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
    const { attachmentId } = await req.json();
    
    if (!attachmentId) {
      throw new Error('Attachment ID is required');
    }

    console.log('🔍 Starting text extraction for attachment:', attachmentId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get attachment info
    const { data: attachment, error: attachmentError } = await supabase
      .from('todo_attachments')
      .select('*')
      .eq('id', attachmentId)
      .single();

    if (attachmentError || !attachment) {
      throw new Error('Attachment not found');
    }

    console.log('📎 Found attachment:', attachment.file_name);

    // Skip if text already extracted
    if (attachment.extracted_text) {
      console.log('✅ Text already extracted for this attachment');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Text already extracted',
        extractedText: attachment.extracted_text 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if file type is supported for text extraction
    const supportedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!supportedTypes.includes(attachment.content_type)) {
      console.log('⚠️ File type not supported for text extraction:', attachment.content_type);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'File type not supported for text extraction' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('todo-attachments')
      .download(attachment.file_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download attachment file');
    }

    console.log('📥 File downloaded, size:', fileData.size);

    // Prepare ConvertAPI request
    const convertApiSecret = Deno.env.get('CONVERTAPI_SECRET');
    if (!convertApiSecret) {
      throw new Error('ConvertAPI secret not configured');
    }

    let extractedText = '';

    // Handle different file types
    if (attachment.content_type === 'text/plain') {
      // For text files, just read the content
      extractedText = await fileData.text();
      console.log('📝 Text file processed directly');
    } else {
      // For other file types, use ConvertAPI
      const formData = new FormData();
      formData.append('File', fileData, attachment.file_name);
      formData.append('StoreFile', 'true');

      let apiEndpoint = '';
      
      // Determine ConvertAPI endpoint based on file type
      if (attachment.content_type === 'application/pdf') {
        apiEndpoint = `https://v2.convertapi.com/convert/pdf/to/txt?Secret=${convertApiSecret}`;
      } else if (attachment.content_type.includes('word') || attachment.content_type.includes('document')) {
        apiEndpoint = `https://v2.convertapi.com/convert/docx/to/txt?Secret=${convertApiSecret}`;
      } else if (attachment.content_type.includes('excel') || attachment.content_type.includes('spreadsheet')) {
        apiEndpoint = `https://v2.convertapi.com/convert/xlsx/to/txt?Secret=${convertApiSecret}`;
      }

      console.log('🔄 Calling ConvertAPI endpoint:', apiEndpoint);

      const convertResponse = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
      });

      if (!convertResponse.ok) {
        throw new Error(`ConvertAPI failed: ${convertResponse.status}`);
      }

      const convertResult = await convertResponse.json();
      console.log('✅ ConvertAPI response received');

      // Download the converted text file
      if (convertResult.Files && convertResult.Files.length > 0) {
        const textFileUrl = convertResult.Files[0].Url;
        const textResponse = await fetch(textFileUrl);
        
        if (textResponse.ok) {
          extractedText = await textResponse.text();
          console.log('📝 Text extracted, length:', extractedText.length);
        }
      }
    }

    // Clean and truncate text if too long
    extractedText = extractedText.trim();
    if (extractedText.length > 10000) {
      extractedText = extractedText.substring(0, 10000) + '... [texte tronqué]';
    }

    // Update attachment with extracted text
    const { error: updateError } = await supabase
      .from('todo_attachments')
      .update({ extracted_text: extractedText })
      .eq('id', attachmentId);

    if (updateError) {
      throw new Error('Failed to update attachment with extracted text');
    }

    console.log('💾 Text extraction completed and saved');

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Text extracted successfully',
      extractedText: extractedText,
      textLength: extractedText.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in extract-attachment-text:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});