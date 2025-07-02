import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const convertApiSecret = Deno.env.get('CONVERTAPI_SECRET');

serve(async (req) => {
  console.log('🚀 PDF to Image conversion function called');
  console.log('📧 Request method:', req.method);
  console.log('🌍 Request URL:', req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🔍 Environment check:');
  console.log('- SUPABASE_URL exists:', !!supabaseUrl);
  console.log('- SUPABASE_SERVICE_ROLE_KEY exists:', !!supabaseServiceKey);
  console.log('- CONVERTAPI_SECRET exists:', !!convertApiSecret);
  console.log('- CONVERTAPI_SECRET length:', convertApiSecret?.length || 0);

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Step 1: Parse and validate request
    let pdfUrl: string;
    try {
      const body = await req.json();
      pdfUrl = body.pdfUrl;
      
      if (!pdfUrl) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Missing pdfUrl parameter',
            stage: 'request_validation'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        );
      }
      
      console.log('📄 Converting PDF:', pdfUrl);
    } catch (parseError) {
      console.error('❌ Request parsing error:', parseError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid JSON in request body',
          stage: 'request_parsing'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Step 2: Validate ConvertAPI secret
    if (!convertApiSecret) {
      console.error('❌ CONVERTAPI_SECRET not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'CONVERTAPI_SECRET not configured',
          stage: 'api_key_validation'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    console.log('✅ ConvertAPI secret is configured');
    console.log('🔑 ConvertAPI secret length:', convertApiSecret.length);

    // Step 3: Download the PDF file with timeout and size limits
    console.log('📥 Downloading PDF file from:', pdfUrl);
    let pdfArrayBuffer: ArrayBuffer;
    let pdfBase64: string;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const pdfResponse = await fetch(pdfUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Supabase-Edge-Function'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!pdfResponse.ok) {
        throw new Error(`HTTP ${pdfResponse.status}: ${pdfResponse.statusText}`);
      }

      const contentLength = pdfResponse.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 20 * 1024 * 1024) { // 20MB limit
        throw new Error('PDF file too large (max 20MB)');
      }

      pdfArrayBuffer = await pdfResponse.arrayBuffer();
      console.log('📄 PDF downloaded, size:', pdfArrayBuffer.byteLength, 'bytes');
      
      // More robust Base64 conversion for large files
      const uint8Array = new Uint8Array(pdfArrayBuffer);
      const chunks: string[] = [];
      const chunkSize = 8192;
      
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        chunks.push(String.fromCharCode(...chunk));
      }
      
      pdfBase64 = btoa(chunks.join(''));
      console.log('📄 PDF converted to Base64, size:', pdfBase64.length);
      
    } catch (downloadError) {
      console.error('❌ PDF download error:', downloadError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to download PDF: ${downloadError.message}`,
          stage: 'pdf_download'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Step 4: Convert PDF to PNG using ConvertAPI v2
    console.log('🔄 Calling ConvertAPI v2 for conversion...');
    let conversionResult: any;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for conversion
      
      const conversionResponse = await fetch('https://v2.convertapi.com/convert/pdf/to/png', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${convertApiSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Parameters: [
            {
              Name: 'File',
              FileValue: {
                Name: 'document.pdf',
                Data: pdfBase64
              }
            },
            {
              Name: 'PageRange',
              Value: '1'
            },
            {
              Name: 'StoreFile',
              Value: true
            }
          ]
        }),
      });

      clearTimeout(timeoutId);
      
      console.log('📊 ConvertAPI response status:', conversionResponse.status);
      console.log('📊 ConvertAPI response headers:', Object.fromEntries(conversionResponse.headers.entries()));

      if (!conversionResponse.ok) {
        const errorText = await conversionResponse.text();
        console.error('❌ ConvertAPI HTTP error:', conversionResponse.status, errorText);
        throw new Error(`ConvertAPI HTTP ${conversionResponse.status}: ${errorText}`);
      }

      conversionResult = await conversionResponse.json();
      console.log('📄 ConvertAPI conversion result:', conversionResult);

      if (!conversionResult.Files || conversionResult.Files.length === 0) {
        throw new Error(`PDF conversion failed: ${conversionResult.Error || 'Unknown error'}`);
      }
      
    } catch (conversionError) {
      console.error('❌ ConvertAPI conversion error:', conversionError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `PDF conversion failed: ${conversionError.message}`,
          stage: 'pdf_conversion'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    const imageUrl = conversionResult.Files[0].Url;

    // Step 5: Download the converted image
    console.log('📥 Downloading converted image from:', imageUrl);
    let imageArrayBuffer: ArrayBuffer;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const imageResponse = await fetch(imageUrl, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!imageResponse.ok) {
        throw new Error(`HTTP ${imageResponse.status}: ${imageResponse.statusText}`);
      }

      const imageBlob = await imageResponse.blob();
      imageArrayBuffer = await imageBlob.arrayBuffer();
      console.log('📥 Downloaded image size:', imageArrayBuffer.byteLength);
      
    } catch (imageDownloadError) {
      console.error('❌ Image download error:', imageDownloadError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to download converted image: ${imageDownloadError.message}`,
          stage: 'image_download'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    // Step 6: Upload the image to Supabase Storage
    const fileName = `pdf_conversion_${Date.now()}.png`;
    console.log('📤 Uploading to Supabase Storage as:', fileName);
    
    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('letter-templates')
        .upload(fileName, imageArrayBuffer, {
          contentType: 'image/png',
          cacheControl: '3600'
        });

      if (uploadError) {
        console.error('❌ Upload error:', uploadError);
        throw uploadError;
      }

      console.log('✅ Upload successful:', uploadData);

      // Step 7: Get public URL
      const { data: urlData } = supabase.storage
        .from('letter-templates')
        .getPublicUrl(fileName);

      console.log('🔗 Public URL generated:', urlData.publicUrl);

      return new Response(
        JSON.stringify({ 
          success: true, 
          imageUrl: urlData.publicUrl,
          originalPdfUrl: pdfUrl
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
      
    } catch (uploadError) {
      console.error('❌ Storage upload error:', uploadError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to upload image to storage: ${uploadError.message}`,
          stage: 'storage_upload'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

  } catch (error) {
    console.error('❌ Unexpected error in PDF to image conversion:', error);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    
    // Log detailed error information
    if (error instanceof Error) {
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown conversion error',
        stage: 'unexpected_error',
        details: error instanceof Error ? {
          name: error.name,
          message: error.message
        } : error
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});