import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

// Import PDF.js legacy build for better Node/SSR compatibility
import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@5.3.31/legacy/build/pdf.js'
import * as pdfjsWorker from 'https://esm.sh/pdfjs-dist@5.3.31/build/pdf.worker.entry.js'

declare global {
  const pdfjsLib: any;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting PDF text extraction in edge function');
    
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📄 Processing file:', file.name, 'Size:', file.size);

    // Convert file to array buffer
    const arrayBuffer = await file.arrayBuffer();
    console.log('✅ File converted to array buffer');

    // Configure PDF.js with proper worker for Node/SSR environment
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
    
    // Load the PDF document using the imported pdfjsLib
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      verbosity: 0,
      isEvalSupported: false,
      useWorkerFetch: false,
    });
    
    const pdf = await loadingTask.promise;
    console.log('✅ PDF loaded successfully, pages:', pdf.numPages);

    let fullText = '';

    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`📖 Processing page ${pageNum}/${pdf.numPages}`);
      
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine all text items from the page
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n';
      console.log(`✅ Page ${pageNum} text extracted (${pageText.length} chars)`);
    }

    console.log('🎉 PDF text extraction completed successfully!');
    console.log('📊 Total extracted text length:', fullText.length);
    
    return new Response(
      JSON.stringify({ 
        text: fullText.trim(),
        pages: pdf.numPages,
        extractedLength: fullText.length
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
    
  } catch (error) {
    console.error('❌ Error extracting text from PDF:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'PDF text extraction failed',
        message: error?.message || 'Erreur inconnue'
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
})