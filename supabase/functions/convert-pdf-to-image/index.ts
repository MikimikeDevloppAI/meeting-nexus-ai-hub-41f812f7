import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const pdfcoApiKey = Deno.env.get('PDFCO_API_KEY');

serve(async (req) => {
  console.log('🚀 PDF to Image conversion function called');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { pdfUrl } = await req.json();
    
    console.log('📄 Converting PDF:', pdfUrl);

    if (!pdfcoApiKey) {
      throw new Error('PDFCO_API_KEY not configured');
    }

    // Step 1: Convert PDF to PNG using PDF.co API
    console.log('🔄 Calling PDF.co API for conversion...');
    const conversionResponse = await fetch('https://api.pdf.co/v1/pdf/convert/to/png', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': pdfcoApiKey,
      },
      body: JSON.stringify({
        url: pdfUrl,
        pages: "0", // Convert only first page
        name: `converted_${Date.now()}.png`
      }),
    });

    const conversionResult = await conversionResponse.json();
    console.log('📄 PDF.co conversion result:', conversionResult);

    if (!conversionResult.url) {
      throw new Error(`PDF conversion failed: ${conversionResult.message || 'Unknown error'}`);
    }

    // Step 2: Download the converted image
    console.log('📥 Downloading converted image from:', conversionResult.url);
    const imageResponse = await fetch(conversionResult.url);
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to download converted image: ${imageResponse.statusText}`);
    }

    const imageBlob = await imageResponse.blob();
    const imageArrayBuffer = await imageBlob.arrayBuffer();
    console.log('📥 Downloaded image size:', imageArrayBuffer.byteLength);

    // Step 3: Upload the image to Supabase Storage
    const fileName = `pdf_conversion_${Date.now()}.png`;
    console.log('📤 Uploading to Supabase Storage as:', fileName);
    
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

    // Step 4: Get public URL
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

  } catch (error) {
    console.error('❌ Error in PDF to image conversion:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});