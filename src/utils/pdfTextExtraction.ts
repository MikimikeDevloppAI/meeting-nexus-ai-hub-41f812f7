import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js to work without worker in Lovable environment
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

export interface IOLData {
  patientName?: string;
  patientAge?: string;
  axialLength?: string;
  keratometry?: string;
  anteriorChamberDepth?: string;
  lensThickness?: string;
  recommendations?: string[];
  rawText?: string;
  error?: boolean;
  message?: string;
}

export const extractTextFromPdf = async (file: File): Promise<string> => {
  try {
    console.log('🔄 Starting PDF text extraction');
    console.log('📄 File:', file.name, 'Size:', file.size);

    // Convert file to array buffer
    const arrayBuffer = await file.arrayBuffer();
    console.log('✅ File converted to array buffer');

    // Try using Supabase edge function for PDF text extraction
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/extract-pdf-text', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk`
        },
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.text) {
          console.log('✅ PDF text extracted via Supabase edge function');
          return result.text.trim();
        }
      }
    } catch (edgeFunctionError) {
      console.log('⚠️ Edge function failed, falling back to client-side extraction');
    }

    // Fallback to client-side PDF.js extraction
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
    
    return fullText.trim();
    
  } catch (error) {
    console.error('❌ Error extracting text from PDF:');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error?.message);
    console.error('Full error:', error);
    throw error;
  }
};

export const parseIOLData = (rawText: string): IOLData => {
  console.log('🔍 Parsing IOL data from extracted text');
  
  const data: IOLData = {
    rawText,
    error: false,
    recommendations: []
  };

  try {
    // Clean and normalize text
    const text = rawText.toLowerCase().replace(/\s+/g, ' ');
    
    // Extract patient name - looking for patterns like "patient: john doe" or "nom: jean dupont"
    const namePatterns = [
      /(?:patient|nom|name)\s*:?\s*([a-zA-ZÀ-ÿ\s]+?)(?:\s|$|,|\n)/i,
      /^([a-zA-ZÀ-ÿ\s]+)(?:\s|$|,)/
    ];
    
    for (const pattern of namePatterns) {
      const nameMatch = text.match(pattern);
      if (nameMatch && nameMatch[1] && nameMatch[1].trim().length > 2) {
        data.patientName = nameMatch[1].trim();
        break;
      }
    }

    // Extract age - looking for patterns like "age: 65" or "65 ans"
    const agePatterns = [
      /(?:age|âge)\s*:?\s*(\d{1,3})/i,
      /(\d{1,3})\s*(?:ans?|years?|y\.o\.)/i
    ];
    
    for (const pattern of agePatterns) {
      const ageMatch = text.match(pattern);
      if (ageMatch && ageMatch[1]) {
        const age = parseInt(ageMatch[1]);
        if (age >= 0 && age <= 120) {
          data.patientAge = age.toString();
          break;
        }
      }
    }

    // Extract axial length - looking for patterns like "AL: 23.45" or "longueur axiale: 23.45mm"
    const axialPatterns = [
      /(?:al|axial length|longueur axiale)\s*:?\s*(\d{1,2}\.?\d{0,2})\s*mm?/i,
      /(\d{1,2}\.\d{1,2})\s*mm.*(?:axial|longueur)/i
    ];
    
    for (const pattern of axialPatterns) {
      const axialMatch = text.match(pattern);
      if (axialMatch && axialMatch[1]) {
        const length = parseFloat(axialMatch[1]);
        if (length >= 15 && length <= 35) {
          data.axialLength = `${length} mm`;
          break;
        }
      }
    }

    // Extract keratometry - looking for patterns like "K1: 42.5" or "kératométrie: 42.5/43.2"
    const keratoPatterns = [
      /(?:k1?|keratometry|kératométrie)\s*:?\s*(\d{1,2}\.?\d{0,2}(?:\/\d{1,2}\.?\d{0,2})?)/i,
      /(\d{1,2}\.\d{1,2}\/\d{1,2}\.\d{1,2}).*(?:d|dioptri)/i
    ];
    
    for (const pattern of keratoPatterns) {
      const keratoMatch = text.match(pattern);
      if (keratoMatch && keratoMatch[1]) {
        data.keratometry = keratoMatch[1];
        break;
      }
    }

    // Extract anterior chamber depth - looking for patterns like "ACD: 3.2" or "profondeur: 3.2mm"
    const acdPatterns = [
      /(?:acd|anterior chamber depth|profondeur.*chambre)\s*:?\s*(\d{1,2}\.?\d{0,2})\s*mm?/i,
      /(\d{1,2}\.\d{1,2})\s*mm.*(?:chamber|chambre|profondeur)/i
    ];
    
    for (const pattern of acdPatterns) {
      const acdMatch = text.match(pattern);
      if (acdMatch && acdMatch[1]) {
        const depth = parseFloat(acdMatch[1]);
        if (depth >= 1 && depth <= 6) {
          data.anteriorChamberDepth = `${depth} mm`;
          break;
        }
      }
    }

    // Extract lens thickness
    const lensPatterns = [
      /(?:lens thickness|épaisseur.*cristallin)\s*:?\s*(\d{1,2}\.?\d{0,2})\s*mm?/i,
      /(\d{1,2}\.\d{1,2})\s*mm.*(?:lens|cristallin|thickness|épaisseur)/i
    ];
    
    for (const pattern of lensPatterns) {
      const lensMatch = text.match(pattern);
      if (lensMatch && lensMatch[1]) {
        const thickness = parseFloat(lensMatch[1]);
        if (thickness >= 2 && thickness <= 8) {
          data.lensThickness = `${thickness} mm`;
          break;
        }
      }
    }

    // Look for IOL recommendations
    const recommendationPatterns = [
      /(?:iol|implant|lentille).*?(\d{1,2}\.?\d{0,2})\s*d/gi,
      /recommand.*?(\d{1,2}\.?\d{0,2})\s*dioptri/gi
    ];
    
    const recommendations: string[] = [];
    for (const pattern of recommendationPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const power = parseFloat(match[1]);
        if (power >= 5 && power <= 35) {
          recommendations.push(`IOL ${power}D recommandé`);
        }
      }
    }
    
    if (recommendations.length > 0) {
      data.recommendations = [...new Set(recommendations)]; // Remove duplicates
    }

    console.log('✅ IOL data parsing completed');
    console.log('📊 Extracted data:', {
      patientName: data.patientName,
      patientAge: data.patientAge,
      axialLength: data.axialLength,
      keratometry: data.keratometry,
      recommendations: data.recommendations?.length
    });

  } catch (error) {
    console.error('❌ Error parsing IOL data:', error);
    data.error = true;
    data.message = 'Erreur lors de l\'analyse des données IOL';
  }

  return data;
};

export const extractIOLDataFromPdf = async (file: File): Promise<IOLData> => {
  try {
    const rawText = await extractTextFromPdf(file);
    
    if (!rawText || rawText.trim().length === 0) {
      return {
        error: true,
        message: 'Aucun texte n\'a pu être extrait du PDF. Le document pourrait être une image scannée.',
        rawText: ''
      };
    }

    return parseIOLData(rawText);
    
  } catch (error) {
    console.error('❌ Error extracting IOL data from PDF:', error);
    return {
      error: true,
      message: `Erreur lors de l'extraction: ${error?.message || 'Erreur inconnue'}`,
      rawText: ''
    };
  }
};