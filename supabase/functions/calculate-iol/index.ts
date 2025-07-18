import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IOLRequest {
  gender: string;
  top_fields: {
    surgeon: string;
    patient_initials: string;
    id: string;
    age: string;
  };
  right_eye: {
    AL: string;
    ACD: string;
    LT: string;
    CCT: string;
    "CD (WTW)": string;
    K1: string;
    K2: string;
    "Hoffer® pACD": string;
  };
  left_eye: {
    AL: string;
    ACD: string;
    LT: string;
    CCT: string;
    "CD (WTW)": string;
    K1: string;
    K2: string;
    "Hoffer® pACD": string;
  };
}

serve(async (req) => {
  console.log('IOL calculation request received');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: IOLRequest = await req.json();
    console.log('Request data:', JSON.stringify(requestData, null, 2));

    // Call the external IOL calculation API
    const response = await fetch('https://api.srv758474.hstgr.cloud/calculate-iol', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    console.log('External API response status:', response.status);
    console.log('External API response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('External API error:', errorText);
      throw new Error(`External API error: ${response.status} - ${errorText}`);
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
        'Content-Length': imageBlob.size.toString(),
      },
    });

  } catch (error: any) {
    console.error('Error in calculate-iol function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'IOL calculation failed', 
        details: error.message 
      }), 
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    );
  }
});