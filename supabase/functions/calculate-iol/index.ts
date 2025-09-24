import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  console.log('IOL calculation request received');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    const requestData = await req.json();
    console.log('Request data:', JSON.stringify(requestData, null, 2));

    // Validate required fields
    if (!requestData.gender || !requestData.top_fields || !requestData.right_eye || !requestData.left_eye) {
      throw new Error('Missing required fields');
    }

    // Set up timeout - increased to 70 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 70000); // 70 seconds

    try {
      // Call the external IOL calculation API
      const response = await fetch('https://api-iol.vps.allia-solutions.ch/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log('External API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('External API error:', errorText);
        throw new Error(`External API error: ${response.status}`);
      }

      // Get the image blob from the response
      const imageBlob = await response.blob();
      console.log('Image blob size:', imageBlob.size, 'bytes');

      // Return the image blob with proper headers
      return new Response(imageBlob, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/png',
          'Cache-Control': 'no-cache'
        }
      });

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - calculation took too long (70s limit)');
      }
      throw error;
    }

  } catch (error) {
    console.error('Error in calculate-iol function:', error);
    return new Response(JSON.stringify({
      error: 'IOL calculation failed',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});