import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getDocument } from 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.min.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IOLData {
  patientName?: string;
  patientAge?: string;
  axialLength?: string;
  keratometry?: string;
  anteriorChamberDepth?: string;
  lensThickness?: string;
  recommendations?: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filePath } = await req.json();
    
    if (!filePath) {
      throw new Error('File path is required');
    }

    console.log(`📄 Processing IOL PDF extraction for file: ${filePath}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download the PDF file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Convert blob to buffer for text extraction
    const arrayBuffer = await fileData.arrayBuffer();
    
    // Extract text from PDF using pdf.js
    const extractedText = await extractTextFromPDF(arrayBuffer);
    
    console.log(`📝 Extracted text length: ${extractedText.length} characters`);
    console.log(`📝 First 500 characters: ${extractedText.substring(0, 500)}`);

    // Parse IOL data from extracted text
    const iolData = parseIOLData(extractedText);

    console.log(`✅ Successfully extracted IOL data:`, iolData);

    return new Response(JSON.stringify(iolData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in IOL extraction:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    // Use pdf.js to properly extract text from PDF
    const pdf = await getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
    }).promise;

    let fullText = '';
    
    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n';
    }

    return fullText.trim();
  } catch (error) {
    console.error('❌ Error extracting text with pdf.js:', error);
    
    // Fallback to basic extraction
    return extractTextBasic(new Uint8Array(arrayBuffer));
  }
}

async function extractTextBasic(pdfBuffer: Uint8Array): Promise<string> {
  console.log('🔍 Using basic fallback extraction method');
  
  // Basic PDF text extraction as fallback
  // Convert buffer to string and look for text patterns
  const pdfString = new TextDecoder('latin1').decode(pdfBuffer);
  
  // Extract readable text by looking for text objects and streams
  const textMatches = pdfString.match(/\((.*?)\)/g) || [];
  const extractedTexts = textMatches
    .map(match => match.slice(1, -1)) // Remove parentheses
    .filter(text => text.length > 1 && /[a-zA-Z0-9]/.test(text)) // Filter meaningful text
    .join(' ');

  return extractedTexts;
}

function parseIOLData(text: string): IOLData {
  const data: IOLData = {};
  const lowerText = text.toLowerCase();

  console.log('🔍 Parsing text for IOL data...');

  // Patient name patterns
  const namePatterns = [
    /patient[:\s]+([a-z\s]+?)(?:\n|$|age|date)/i,
    /nom[:\s]+([a-z\s]+?)(?:\n|$|age|date)/i,
    /name[:\s]+([a-z\s]+?)(?:\n|$|age|date)/i
  ];

  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      data.patientName = match[1].trim();
      break;
    }
  }

  // Age patterns
  const agePatterns = [
    /age[:\s]+(\d+)/i,
    /(\d+)\s*ans/i,
    /(\d+)\s*years/i
  ];

  for (const pattern of agePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      data.patientAge = `${match[1]} ans`;
      break;
    }
  }

  // Axial length patterns (usually in mm)
  const axialPatterns = [
    /axial\s*length[:\s]+(\d+\.?\d*)\s*mm/i,
    /longueur\s*axiale[:\s]+(\d+\.?\d*)\s*mm/i,
    /al[:\s]+(\d+\.?\d*)\s*mm/i
  ];

  for (const pattern of axialPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      data.axialLength = `${match[1]} mm`;
      break;
    }
  }

  // Keratometry patterns
  const keratometryPatterns = [
    /k[1-2]?[:\s]+(\d+\.?\d*)\s*[d]?/i,
    /keratometry[:\s]+(\d+\.?\d*)/i,
    /kératométrie[:\s]+(\d+\.?\d*)/i,
    /corneal\s*power[:\s]+(\d+\.?\d*)/i
  ];

  for (const pattern of keratometryPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      data.keratometry = `${match[1]} D`;
      break;
    }
  }

  // Anterior chamber depth patterns
  const acdPatterns = [
    /acd[:\s]+(\d+\.?\d*)\s*mm/i,
    /anterior\s*chamber\s*depth[:\s]+(\d+\.?\d*)\s*mm/i,
    /profondeur.*chambre.*antérieure[:\s]+(\d+\.?\d*)\s*mm/i
  ];

  for (const pattern of acdPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      data.anteriorChamberDepth = `${match[1]} mm`;
      break;
    }
  }

  // Lens thickness patterns
  const lensPatterns = [
    /lens\s*thickness[:\s]+(\d+\.?\d*)\s*mm/i,
    /lt[:\s]+(\d+\.?\d*)\s*mm/i,
    /épaisseur.*cristallin[:\s]+(\d+\.?\d*)\s*mm/i
  ];

  for (const pattern of lensPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      data.lensThickness = `${match[1]} mm`;
      break;
    }
  }

  // IOL power recommendations
  const iolPatterns = [
    /iol[:\s]+(\d+\.?\d*)\s*d/gi,
    /implant[:\s]+(\d+\.?\d*)\s*d/gi,
    /power[:\s]+(\d+\.?\d*)\s*d/gi,
    /puissance[:\s]+(\d+\.?\d*)\s*d/gi
  ];

  const recommendations: string[] = [];
  for (const pattern of iolPatterns) {
    const matches = [...text.matchAll(pattern)];
    matches.forEach(match => {
      if (match[1]) {
        recommendations.push(`IOL ${match[1]} D`);
      }
    });
  }

  if (recommendations.length > 0) {
    data.recommendations = [...new Set(recommendations)]; // Remove duplicates
  }

  // Add default recommendations if none found
  if (!data.recommendations || data.recommendations.length === 0) {
    data.recommendations = [
      "Consultez un spécialiste pour le calcul précis de l'IOL",
      "Vérifiez les mesures biométriques avant la chirurgie"
    ];
  }

  return data;
}