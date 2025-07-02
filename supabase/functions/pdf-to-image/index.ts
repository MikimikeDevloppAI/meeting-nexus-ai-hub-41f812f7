import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { pdfUrl } = await req.json();
    
    if (!pdfUrl) {
      return new Response(
        JSON.stringify({ error: "PDF URL is required" }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Récupérer la clé API ConvertAPI depuis les secrets
    const CONVERTAPI_SECRET = Deno.env.get('CONVERTAPI_SECRET');
    if (!CONVERTAPI_SECRET) {
      return new Response(
        JSON.stringify({ error: "ConvertAPI secret not configured" }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    console.log('Converting PDF to image:', pdfUrl);

    // Appeler ConvertAPI pour convertir PDF en image
    const convertResponse = await fetch(`https://v2.convertapi.com/convert/pdf/to/png?Secret=${CONVERTAPI_SECRET}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Parameters: [
          {
            Name: 'File',
            FileValue: {
              Url: pdfUrl
            }
          },
          {
            Name: 'PageRange',
            Value: '1'  // Convertir seulement la première page
          },
          {
            Name: 'ImageResolution',
            Value: '150'  // Bonne qualité pour l'aperçu
          }
        ]
      })
    });

    if (!convertResponse.ok) {
      const errorText = await convertResponse.text();
      console.error('ConvertAPI error:', errorText);
      return new Response(
        JSON.stringify({ error: "Failed to convert PDF to image" }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    const convertResult = await convertResponse.json();
    console.log('Conversion successful:', convertResult);

    // Extraire l'URL de l'image convertie
    const imageUrl = convertResult.Files[0].Url;

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: imageUrl,
        message: "PDF converted to image successfully"
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error converting PDF to image:', error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error during PDF conversion",
        details: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});