import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    console.log('Converting PDF to image:', pdfUrl);

    // Pour l'instant, retourner une image de placeholder simple
    // En SVG encodé en base64
    const placeholderSvg = `
      <svg width="600" height="800" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="800" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>
        <text x="300" y="400" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#6b7280">
          PDF Template
        </text>
        <text x="300" y="440" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#9ca3af">
          Preview Available in Export
        </text>
        <text x="300" y="480" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#d1d5db">
          ${new URL(pdfUrl).pathname.split('/').pop()}
        </text>
      </svg>
    `;

    // Convertir le SVG en base64
    const base64Svg = btoa(unescape(encodeURIComponent(placeholderSvg)));
    const imageDataUrl = `data:image/svg+xml;base64,${base64Svg}`;

    console.log('Generated placeholder image for PDF preview');

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: imageDataUrl,
        message: "PDF placeholder generated successfully" 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in convert-pdf-to-image function:', error);
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