// Load PDF.js dynamically from CDN like in the working HTML example
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

// Function to dynamically load PDF.js from CDN
async function loadPdfJs(): Promise<any> {
  if (window.pdfjsLib) {
    return window.pdfjsLib;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.onload = () => {
      console.log('✅ PDF.js loaded from CDN');
      // Configure worker to use CDN version to match the working HTML example
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    script.onerror = () => {
      console.error('❌ Failed to load PDF.js from CDN');
      reject(new Error('Failed to load PDF.js'));
    };
    document.head.appendChild(script);
  });
}

export interface IOLData {
  // Informations générales
  surgeryType?: string;
  measurementDate?: string;
  
  // Données pour œil droit (OD)
  rightEye?: {
    AL?: string; // AL [mm]
    CCT?: string; // CCT [μm]
    AD?: string; // AD [mm]
    ACD?: string; // ACD [mm]
    LT?: string; // LT [mm]
    K1?: string; // K1 [D/mm/°]
    K2?: string; // K2 [D/mm/°]
    K?: string; // K [D/mm]
    AST?: string; // Astigmatisme (AST) [D/°]
    WTW?: string; // Distance blanc à blanc (WTW) [mm]
    targetRefraction?: string; // Réfraction cible
  };
  
  // Données pour œil gauche (OS)
  leftEye?: {
    AL?: string; // AL [mm]
    CCT?: string; // CCT [μm]
    AD?: string; // AD [mm]
    ACD?: string; // ACD [mm]
    LT?: string; // LT [mm]
    K1?: string; // K1 [D/mm/°]
    K2?: string; // K2 [D/mm/°]
    K?: string; // K [D/mm]
    AST?: string; // Astigmatisme (AST) [D/°]
    WTW?: string; // Distance blanc à blanc (WTW) [mm]
    targetRefraction?: string; // Réfraction cible
  };
  
  rawText?: string;
  error?: boolean;
  message?: string;
  calculatedResults?: any; // Results from calculate-iol edge function
  extractedDataForAPI?: any; // Données formatées pour l'API
}

export const extractTextFromPdf = async (file: File): Promise<string> => {
  try {
    console.log('🔄 Starting PDF text extraction with HTML approach');
    console.log('📄 File:', file.name, 'Size:', file.size);

    // Load PDF.js from CDN exactly like in the working HTML example
    const pdfjsLib = await loadPdfJs();
    
    // Convert file to array buffer exactly like in the HTML example
    const arrayBuffer = await file.arrayBuffer();

    // Use exactly the same approach as the working HTML example
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log('✅ PDF loaded successfully, pages:', pdf.numPages);

    let fullText = '';

    // Extract text from all pages exactly like in the HTML example
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`📖 Processing page ${pageNum}/${pdf.numPages}`);
      
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += `--- Page ${pageNum} ---\n${pageText}\n\n`;
      
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
    rightEye: {},
    leftEye: {}
  };

  try {
    // Fonction helper pour extraire une valeur par regex avec gestion des occurrences multiples
    const extractValue = (pattern: RegExp, occurrence: number = 1): string | undefined => {
      const matches = [...rawText.matchAll(new RegExp(pattern.source, 'g'))];
      if (matches.length >= occurrence && matches[occurrence - 1]) {
        return matches[occurrence - 1][1];
      }
      return undefined;
    };

    // Fonction helper pour extraire des valeurs multiples (K1, K2, K, AST)
    const extractMultipleValues = (pattern: RegExp, occurrence: number = 1): string | undefined => {
      const matches = [...rawText.matchAll(new RegExp(pattern.source, 'g'))];
      if (matches.length >= occurrence && matches[occurrence - 1]) {
        const match = matches[occurrence - 1];
        if (match.length === 4) { // K1, K2 avec angle: 45.17 /7.47 @ 178
          return `${match[1]} / ${match[2]} @ ${match[3]}`;
        } else if (match.length === 3 && pattern.source.includes('AST')) { // AST: 0.89 @ 88
          return `${match[1]} @ ${match[2]}`;
        } else if (match.length === 3) { // K sans angle: 45.62 /7.40
          return `${match[1]} / ${match[2]}`;
        }
      }
      return undefined;
    };

    // Fonction helper pour extraire la réfraction cible après "refraction cible:"
    const extractTargetRefraction = (occurrence: number = 1): string | undefined => {
      const pattern = /refraction\s+cible\s*:\s*([-\+]?[\d\.]+(?:\s*[-\+]?\s*[\d\.]+)?[^\s]*)/gi;
      const matches = [...rawText.matchAll(pattern)];
      if (matches.length >= occurrence && matches[occurrence - 1]) {
        return matches[occurrence - 1][1].trim();
      }
      return undefined;
    };

    // 1. Extraire le type de chirurgie
    if (rawText.includes('Phaque')) {
      data.surgeryType = 'Phaque';
    }

    // 2. Extraire la date de mesure (LS900 cône T <date>)
    const dateMatch = rawText.match(/LS900 cône T\s+(\d{1,2}\s+\w+\s+\d{4})/);
    if (dateMatch) {
      data.measurementDate = dateMatch[1];
    }

    // 3. Extraire les données pour les deux yeux avec gestion des espaces multiples
    // AL [mm] - pattern ajusté pour gérer les espaces multiples
    data.rightEye!.AL = extractValue(/AL\s+\[mm\]\s+([\d\.]+)/g, 1);
    data.leftEye!.AL = extractValue(/AL\s+\[mm\]\s+([\d\.]+)/g, 2);

    // CCT [μm] - pattern ajusté pour gérer les espaces multiples
    data.rightEye!.CCT = extractValue(/CCT\s+\[μm\]\s+([\d\.]+)/g, 1);
    data.leftEye!.CCT = extractValue(/CCT\s+\[μm\]\s+([\d\.]+)/g, 2);

    // AD [mm] - pattern ajusté pour gérer les espaces multiples
    data.rightEye!.AD = extractValue(/AD\s+\[mm\]\s+([\d\.]+)/g, 1);
    data.leftEye!.AD = extractValue(/AD\s+\[mm\]\s+([\d\.]+)/g, 2);

    // ACD [mm] - pattern ajusté pour gérer les espaces multiples
    data.rightEye!.ACD = extractValue(/ACD\s+\[mm\]\s+([\d\.]+)/g, 1);
    data.leftEye!.ACD = extractValue(/ACD\s+\[mm\]\s+([\d\.]+)/g, 2);

    // LT [mm] - pattern ajusté pour gérer les espaces multiples
    data.rightEye!.LT = extractValue(/LT\s+\[mm\]\s+([\d\.]+)/g, 1);
    data.leftEye!.LT = extractValue(/LT\s+\[mm\]\s+([\d\.]+)/g, 2);

    // K1 [D/mm/°] - on ne prend que le nombre avant le / 
    data.rightEye!.K1 = extractValue(/K1\s+\[D\/mm\/°\]\s+([\d\.]+)/g, 1);
    data.leftEye!.K1 = extractValue(/K1\s+\[D\/mm\/°\]\s+([\d\.]+)/g, 2);

    // K2 [D/mm/°] - on ne prend que le nombre avant le /
    data.rightEye!.K2 = extractValue(/K2\s+\[D\/mm\/°\]\s+([\d\.]+)/g, 1);
    data.leftEye!.K2 = extractValue(/K2\s+\[D\/mm\/°\]\s+([\d\.]+)/g, 2);

    // K [D/mm] - format: 45.62 /7.40 - pattern ajusté
    data.rightEye!.K = extractMultipleValues(/K\s+\[D\/mm\]\s+([\d\.]+)\s*\/\s*([\d\.]+)/g, 1);
    data.leftEye!.K = extractMultipleValues(/K\s+\[D\/mm\]\s+([\d\.]+)\s*\/\s*([\d\.]+)/g, 2);

    // +AST [D/°] - format: 0.89 @ 88 - pattern ajusté
    data.rightEye!.AST = extractMultipleValues(/\+AST\s+\[D\/°\]\s+([\d\.]+)\s+@\s*(\d+)/g, 1);
    data.leftEye!.AST = extractMultipleValues(/\+AST\s+\[D\/°\]\s+([\d\.]+)\s+@\s*(\d+)/g, 2);

    // WTW [mm] - pattern ajusté pour gérer les espaces multiples
    data.rightEye!.WTW = extractValue(/WTW\s+\[mm\]\s+([\d\.]+)/g, 1);
    data.leftEye!.WTW = extractValue(/WTW\s+\[mm\]\s+([\d\.]+)/g, 2);

    // Extraction de la réfraction cible pour chaque œil
    data.rightEye!.targetRefraction = extractTargetRefraction(1);
    data.leftEye!.targetRefraction = extractTargetRefraction(2);

    console.log('✅ IOL data parsing completed');
    console.log('📊 Extracted data:', {
      surgeryType: data.surgeryType,
      measurementDate: data.measurementDate,
      rightEye: data.rightEye,
      leftEye: data.leftEye
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
        message: 'Document scanné détecté - Aucun texte n\'a pu être extrait du PDF. Veuillez utiliser un service OCR pour traiter ce document.',
        rawText: ''
      };
    }

    // Check if extracted text is very short (likely a scanned document)
    if (rawText.trim().length < 50) {
      return {
        error: true,
        message: 'Document scanné détecté - Le texte extrait est très court. Ce document semble être une image scannée nécessitant un service OCR.',
        rawText
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