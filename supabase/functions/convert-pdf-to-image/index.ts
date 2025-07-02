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

    // Télécharger le PDF
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    console.log('PDF downloaded, size:', pdfBuffer.byteLength);

    // Utiliser l'API Canvas du navigateur côté serveur avec Deno
    // Créer un document HTML temporaire avec canvas
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
      </head>
      <body>
        <canvas id="pdfCanvas"></canvas>
        <script>
          // Configuration PDF.js
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          
          async function convertPdfToImage() {
            try {
              const pdfData = new Uint8Array(${JSON.stringify(Array.from(new Uint8Array(pdfBuffer)))});
              const pdf = await pdfjsLib.getDocument({data: pdfData}).promise;
              const page = await pdf.getPage(1);
              
              const viewport = page.getViewport({scale: 1.5});
              const canvas = document.getElementById('pdfCanvas');
              const context = canvas.getContext('2d');
              
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              
              await page.render({
                canvasContext: context,
                viewport: viewport
              }).promise;
              
              const imageDataUrl = canvas.toDataURL('image/png', 0.8);
              console.log('RESULT:', imageDataUrl);
            } catch (error) {
              console.log('ERROR:', error.message);
            }
          }
          
          convertPdfToImage();
        </script>
      </body>
      </html>
    `;

    // Alternative plus simple : utiliser puppeteer ou similaire
    // Pour l'instant, on va retourner une image générée avec Canvas2D directement
    
    // Créer une image de placeholder en attendant une vraie conversion
    const canvas = new OffscreenCanvas(600, 800);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    
    // Dessiner un fond blanc
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 600, 800);
    
    // Ajouter un texte indiquant que c'est un placeholder
    ctx.fillStyle = '#666666';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PDF Template', 300, 400);
    ctx.fillText('Preview will be available', 300, 430);
    ctx.fillText('in final export', 300, 460);
    
    // Convertir en blob puis en base64
    const blob = await canvas.convertToBlob({ type: 'image/png', quality: 0.8 });
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const imageDataUrl = `data:image/png;base64,${base64}`;

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: imageDataUrl,
        message: "PDF preview generated (placeholder)" 
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