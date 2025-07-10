import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Note: Tesseract.js temporarily disabled for debugging

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
    
    // Envoyer le PDF au webhook n8n en arrière-plan (sans attendre)
    const webhookPromise = sendPDFToWebhook(filePath, fileData);
    
    // Extract text from PDF with improved methods
    const extractedText = await extractTextFromPDF(arrayBuffer);
    
    console.log(`📝 Extracted text length: ${extractedText.length} characters`);
    console.log(`📝 First 1000 characters:`, extractedText.substring(0, 1000));

    // Parse IOL data from extracted text
    const iolData = parseIOLData(extractedText);
    
    // Ajouter le texte brut pour debug
    iolData.rawText = extractedText;

    console.log(`✅ Successfully extracted IOL data:`, iolData);

    // Utiliser waitUntil pour gérer le webhook en arrière-plan
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(webhookPromise);
    } else {
      // Fallback: démarrer la promesse sans l'attendre
      webhookPromise.catch(error => 
        console.error('❌ Webhook error (non-blocking):', error)
      );
    }

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
    console.log('🔍 Starting PDF text extraction...');
    
    // Convertir en Uint8Array pour l'analyse
    const pdfBytes = new Uint8Array(arrayBuffer);
    
    // Analyser d'abord si c'est un PDF scanné
    const isScanned = isScannedPDF(pdfBytes);
    console.log(`📋 PDF Type Analysis: ${isScanned ? 'SCANNED' : 'DIGITAL'}`);
    
    // Si c'est clairement un PDF scanné, aller directement à l'OCR
    if (isScanned) {
      console.log('📸 Scanned PDF detected - proceeding directly to OCR...');
      return await extractTextWithOCR(arrayBuffer);
    }
    
    // Méthode 1: Chercher les objets de texte dans le PDF
    const extractedText = extractTextFromPDFBytes(pdfBytes);
    
    console.log(`📊 Extracted text preview: "${extractedText.substring(0, 200)}"`);
    console.log(`📝 Initial extracted text length: ${extractedText?.length || 0}`);
    
    // Vérifier si le texte extrait est valide (pas de caractères corrompus)
    if (extractedText && extractedText.length > 50 && isValidMedicalText(extractedText)) {
      console.log('✅ Text extraction successful - valid medical text found');
      return extractedText;
    }
    
    // Si le texte contient trop de caractères corrompus, c'est probablement un PDF scanné
    if (extractedText && extractedText.length > 20 && !isValidMedicalText(extractedText)) {
      console.log('⚠️ Detected corrupted text - likely scanned PDF, trying OCR...');
      return await extractTextWithOCR(arrayBuffer);
    }
    
    // Si pas de texte du tout, essayer OCR
    if (!extractedText || extractedText.trim().length < 20) {
      console.log('❌ No readable text found - trying OCR as fallback...');
      return await extractTextWithOCR(arrayBuffer);
    }
    
    console.log('✅ Valid text extracted directly from PDF');
    return extractedText;
    
  } catch (error) {
    console.error('❌ Error in PDF extraction:', error);
    console.log('🔄 Falling back to OCR due to extraction error...');
    return await extractTextWithOCR(arrayBuffer);
  }
}

function generateScannedPDFMessage(): string {
  return `DOCUMENT SCANNÉ DÉTECTÉ

Ce PDF semble être un document scanné ou basé sur des images. L'extraction automatique de texte n'est pas possible.

POUR UTILISER CE DOCUMENT :
1. Convertissez le PDF avec un logiciel OCR (Reconnaissance Optique de Caractères)
2. Utilisez Adobe Acrobat avec fonction OCR
3. Ou saisissez manuellement les données IOL ci-dessous :

DONNÉES À RECHERCHER :
- Nom du patient
- Âge du patient  
- Longueur axiale (AL) en mm
- Kératométrie (K1, K2) en dioptries
- Profondeur chambre antérieure (ACD) en mm
- Épaisseur du cristallin (LT) en mm
- Recommandations de puissance IOL en dioptries

SUGGESTION : Essayez avec un PDF généré électroniquement (non scanné) pour une extraction automatique.`;
}

function extractTextFromPDFBytes(pdfBytes: Uint8Array): string {
  // Convertir en string pour analyser la structure
  let pdfString = '';
  
  // Utiliser différents encodages pour essayer de lire le texte
  const encodings = ['utf-8', 'latin1', 'ascii'];
  
  for (const encoding of encodings) {
    try {
      pdfString = new TextDecoder(encoding, { fatal: false }).decode(pdfBytes);
      
      // Chercher les flux de texte (streams)
      const textMatches = [];
      
      // Patterns pour différents types de contenu texte PDF
      const patterns = [
        /BT\s+(.*?)\s+ET/gs,  // Text objects (BT...ET)
        /\((.*?)\)\s*Tj/g,     // Text showing operators
        /\[(.*?)\]\s*TJ/g,     // Array text showing
        /\/F\d+\s+\d+\s+Tf\s+(.*?)(?=\/F\d+|$)/gs, // Font changes avec texte
      ];
      
      for (const pattern of patterns) {
        const matches = [...pdfString.matchAll(pattern)];
        matches.forEach(match => {
          if (match[1]) {
            textMatches.push(match[1]);
          }
        });
      }
      
      // Nettoyer et joindre le texte trouvé
      let extractedText = textMatches
        .join(' ')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (extractedText.length > 50 && isValidMedicalText(extractedText)) {
        return extractedText;
      }
      
    } catch (e) {
      continue;
    }
  }
  
  return '';
}

function extractTextAlternative(pdfBytes: Uint8Array): string {
  // Méthode alternative: chercher directement des patterns de texte
  const pdfString = new TextDecoder('latin1', { fatal: false }).decode(pdfBytes);
  
  // Chercher des mots clés médicaux pour valider qu'on a le bon contenu
  const medicalKeywords = [
    'patient', 'biometrie', 'biométrie', 'axial', 'keratometry', 'kératométrie',
    'IOL', 'lens', 'cristallin', 'diopter', 'dioptrie', 'mm', 'chamber',
    'chambre', 'anterieur', 'anterior', 'depth', 'profondeur', 'age', 'âge'
  ];
  
  // Extraire toutes les chaînes entre parenthèses qui pourraient être du texte
  const textCandidates = pdfString.match(/\([^)]{2,100}\)/g) || [];
  
  const extractedParts = textCandidates
    .map(text => text.slice(1, -1)) // Enlever les parenthèses
    .filter(text => {
      // Filtrer pour garder seulement le texte qui semble médical
      const lowerText = text.toLowerCase();
      return medicalKeywords.some(keyword => lowerText.includes(keyword)) ||
             /\d+\.?\d*\s*(mm|d|diopter|dioptrie)/i.test(text) ||
             /patient|nom|name|age|âge/i.test(text);
    })
    .join(' ');
  
  return extractedParts.trim();
}

function isValidMedicalText(text: string): boolean {
  // Vérifier si le texte contient principalement des caractères lisibles
  const readableChars = text.match(/[a-zA-Z0-9\s.,;:()\-]/g) || [];
  const readableRatio = readableChars.length / text.length;
  
  // Vérifier la présence de caractères corrompus typiques des PDFs scannés
  const corruptedChars = text.match(/[¢€¥Š‚ƒ„…†‡ˆ‰Ž''""•–—˜™ž]/g) || [];
  const corruptedRatio = corruptedChars.length / text.length;
  
  // Le texte est valide s'il a au moins 80% de caractères lisibles ET moins de 10% de caractères corrompus
  return readableRatio > 0.8 && corruptedRatio < 0.1;
}

function parseIOLData(text: string): any {
  const data: any = {};
  
  // Si c'est un message d'erreur pour PDF scanné, ne pas essayer de parser
  if (text.includes('DOCUMENT SCANNÉ DÉTECTÉ')) {
    return {
      error: true,
      message: text,
      recommendations: [
        "PDF scanné détecté - Conversion OCR nécessaire",
        "Utilisez un PDF avec du texte sélectionnable",
        "Ou saisissez les données manuellement"
      ]
    };
  }

  
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

  // Essayer d'extraire d'autres données numériques du texte
  const numericMatches = text.match(/(\d+\.?\d*)\s*(mm|d|diopter|dioptrie)/gi);
  if (numericMatches) {
    data.otherMeasurements = numericMatches;
  }

  // Extraire toutes les lignes contenant des mesures
  const measurementLines = text.split('\n').filter(line => 
    /\d+\.?\d*\s*(mm|d|diopter|dioptrie)/i.test(line) && line.trim().length > 5
  );
  if (measurementLines.length > 0) {
    data.measurementLines = measurementLines;
  }

  return data;
}

async function extractTextWithOCR(arrayBuffer: ArrayBuffer): Promise<string> {
  console.log('❌ OCR temporairement désactivé pour le debug');
  console.log('🔄 Essayons d\'extraire du texte avec des méthodes alternatives...');
  
  // Convertir en Uint8Array
  const pdfBytes = new Uint8Array(arrayBuffer);
  
  // Essayer l'extraction alternative
  const alternativeText = extractTextAlternative(pdfBytes);
  console.log(`📝 Alternative extraction result: "${alternativeText.substring(0, 200)}"`);
  
  if (alternativeText && alternativeText.length > 10) {
    console.log(`✅ Alternative method extracted ${alternativeText.length} characters`);
    return alternativeText;
  }
  
  console.log('❌ No text found with alternative methods either');
  return generateScannedPDFMessage();
}

async function convertPDFToImage(arrayBuffer: ArrayBuffer): Promise<Uint8Array | null> {
  try {
    console.log('🔄 Converting PDF to image using canvas...');
    
    // Pour Deno, nous devons utiliser une approche différente
    // Nous pouvons essayer de rendre la première page du PDF en tant qu'image
    
    // Créer un data URL du PDF
    const pdfData = new Uint8Array(arrayBuffer);
    const base64Data = btoa(String.fromCharCode(...pdfData));
    const pdfDataUrl = `data:application/pdf;base64,${base64Data}`;
    
    // Note: Dans un environnement Deno réel, nous aurions besoin d'une bibliothèque
    // pour convertir PDF en image. Pour simplifier, nous retournons les données du PDF
    // et laissons Tesseract essayer de le traiter directement
    
    console.log('📄 Using PDF data directly for OCR processing');
    return pdfData;
    
  } catch (error) {
    console.error('❌ Error converting PDF to image:', error);
    return null;
  }
}

// Fonction améliorée pour détecter les PDFs scannés
function isScannedPDF(pdfBytes: Uint8Array): boolean {
  const pdfString = new TextDecoder('utf-8', { fatal: false }).decode(pdfBytes);
  
  // Chercher des indicateurs de contenu scanné
  const imageIndicators = [
    '/Type /XObject',
    '/Subtype /Image',
    '/DCTDecode',
    '/FlateDecode',
    '/CCITTFaxDecode'
  ];
  
  const imageCount = imageIndicators.reduce((count, indicator) => {
    return count + (pdfString.match(new RegExp(indicator, 'g')) || []).length;
  }, 0);
  
  // Chercher du texte extractible
  const textIndicators = [
    '/Type /Font',
    'BT',
    'ET',
    'Tj',
    'TJ'
  ];
  
  const textCount = textIndicators.reduce((count, indicator) => {
    return count + (pdfString.match(new RegExp(indicator, 'g')) || []).length;
  }, 0);
  
  console.log(`📊 PDF Analysis: ${imageCount} image indicators, ${textCount} text indicators`);
  
  // Si on a beaucoup d'images et peu de texte, c'est probablement scanné
  return imageCount > 5 && textCount < 10;
}

// Fonction pour envoyer le PDF au webhook n8n
async function sendPDFToWebhook(filePath: string, fileData: Blob): Promise<void> {
  try {
    console.log('🚀 Sending PDF to n8n webhook...');
    
    const webhookUrl = 'https://n8n.srv758474.hstgr.cloud/webhook-test/06ff1a12-9f11-4d2c-9472-3f33a574be43';
    
    // Convertir le blob en ArrayBuffer puis en base64
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64Data = btoa(String.fromCharCode(...uint8Array));
    
    // Préparer les données à envoyer
    const payload = {
      fileName: filePath,
      fileSize: fileData.size,
      mimeType: fileData.type || 'application/pdf',
      fileData: base64Data,
      timestamp: new Date().toISOString(),
      source: 'lovable-iol-calculator'
    };
    
    console.log(`📤 Sending ${fileData.size} bytes to webhook...`);
    
    // Envoyer au webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      console.log('✅ PDF successfully sent to n8n webhook');
      const responseText = await response.text();
      console.log('📝 Webhook response:', responseText);
    } else {
      console.error(`❌ Webhook failed with status ${response.status}: ${response.statusText}`);
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Error sending PDF to webhook:', error);
    // Ne pas relancer l'erreur car c'est une tâche en arrière-plan
  }
}
