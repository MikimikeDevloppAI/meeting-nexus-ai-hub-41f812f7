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
  patientInfo: {
    name: string;
    dateOfBirth: string;
    patientId: string;
  };
  measurements: {
    rightEye: {
      axialLength?: number;
      cct?: number;
      ad?: number;
      acd?: number;
      lt?: number;
      k1?: number;
      k1_radius?: number;
      k1_axis?: number;
      k2?: number;
      k2_radius?: number;
      k2_axis?: number;
      k_mean?: number;
      k_mean_radius?: number;
      astigmatism?: number;
      astigmatism_axis?: number;
      wtw?: number;
    };
    leftEye: {
      axialLength?: number;
      cct?: number;
      ad?: number;
      acd?: number;
      lt?: number;
      k1?: number;
      k1_radius?: number;
      k1_axis?: number;
      k2?: number;
      k2_radius?: number;
      k2_axis?: number;
      k_mean?: number;
      k_mean_radius?: number;
      astigmatism?: number;
      astigmatism_axis?: number;
      wtw?: number;
    };
  };
  recommendations: string;
  isScannedPdf: boolean;
  hasError: boolean;
  errorMessage: string;
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
  const data: IOLData = {
    patientInfo: {
      name: '',
      dateOfBirth: '',
      patientId: ''
    },
    measurements: {
      rightEye: {},
      leftEye: {}
    },
    recommendations: '',
    isScannedPdf: false,
    hasError: false,
    errorMessage: ''
  };

  // Nettoyer le texte
  const cleanText = rawText.replace(/\s+/g, ' ').trim();
  
  if (cleanText.length < 50) {
    data.hasError = true;
    data.errorMessage = "Le texte extrait est trop court. Il s'agit peut-être d'un PDF scanné.";
    data.isScannedPdf = true;
    return data;
  }

  // Extraire la date du document
  const dateMatch = cleanText.match(/(\d{2}\.\d{2}\.\d{4})/);
  if (dateMatch) {
    data.patientInfo.dateOfBirth = dateMatch[1];
  }

  // Extraire l'ID de calcul (CID)
  const cidMatch = cleanText.match(/ID de calcul \(CID\):\s*(\d+)/);
  if (cidMatch) {
    data.patientInfo.patientId = cidMatch[1];
  }

  // Extraire le nom du test
  const testMatch = cleanText.match(/^([^,]+),/);
  if (testMatch) {
    data.patientInfo.name = testMatch[1].trim();
  }

  // Extraire les données pour l'œil droit (OD)
  const odSection = cleanText.match(/OD[\s\S]*?(?=OS|Phaque[\s\S]*?Pas de données|$)/);
  if (odSection) {
    const odText = odSection[0];
    
    // AL (Longueur axiale)
    const alMatch = odText.match(/AL \[mm\]\s*(\d+\.\d+)/);
    if (alMatch) {
      data.measurements.rightEye.axialLength = parseFloat(alMatch[1]);
    }

    // CCT (Épaisseur cornéenne centrale)
    const cctMatch = odText.match(/CCT \[μm\]\s*(\d+)/);
    if (cctMatch) {
      data.measurements.rightEye.cct = parseInt(cctMatch[1]);
    }

    // AD (Profondeur de chambre antérieure)
    const adMatch = odText.match(/AD \[mm\]\s*(\d+\.\d+)/);
    if (adMatch) {
      data.measurements.rightEye.ad = parseFloat(adMatch[1]);
    }

    // ACD (Profondeur de chambre antérieure)
    const acdMatch = odText.match(/ACD \[mm\]\s*(\d+\.\d+)/);
    if (acdMatch) {
      data.measurements.rightEye.acd = parseFloat(acdMatch[1]);
    }

    // LT (Épaisseur du cristallin)
    const ltMatch = odText.match(/LT \[mm\]\s*(\d+\.\d+)/);
    if (ltMatch) {
      data.measurements.rightEye.lt = parseFloat(ltMatch[1]);
    }

    // K1 (Kératométrie)
    const k1Match = odText.match(/K1 \[D\/mm\/°\]\s*(\d+\.\d+)\s*\/(\d+\.\d+)\s*@\s*(\d+)/);
    if (k1Match) {
      data.measurements.rightEye.k1 = parseFloat(k1Match[1]);
      data.measurements.rightEye.k1_radius = parseFloat(k1Match[2]);
      data.measurements.rightEye.k1_axis = parseInt(k1Match[3]);
    }

    // K2 (Kératométrie)
    const k2Match = odText.match(/K2 \[D\/mm\/°\]\s*(\d+\.\d+)\s*\/(\d+\.\d+)\s*@\s*(\d+)/);
    if (k2Match) {
      data.measurements.rightEye.k2 = parseFloat(k2Match[1]);
      data.measurements.rightEye.k2_radius = parseFloat(k2Match[2]);
      data.measurements.rightEye.k2_axis = parseInt(k2Match[3]);
    }

    // K moyen
    const kMatch = odText.match(/K \[D\/mm\]\s*(\d+\.\d+)\s*\/(\d+\.\d+)/);
    if (kMatch) {
      data.measurements.rightEye.k_mean = parseFloat(kMatch[1]);
      data.measurements.rightEye.k_mean_radius = parseFloat(kMatch[2]);
    }

    // Astigmatisme
    const astMatch = odText.match(/\+AST \[D\/°\]\s*(\d+\.\d+)\s*@\s*(\d+)/);
    if (astMatch) {
      data.measurements.rightEye.astigmatism = parseFloat(astMatch[1]);
      data.measurements.rightEye.astigmatism_axis = parseInt(astMatch[2]);
    }

    // WTW (Distance blanc à blanc)
    const wtwMatch = odText.match(/WTW \[mm\]\s*(\d+\.\d+)/);
    if (wtwMatch) {
      data.measurements.rightEye.wtw = parseFloat(wtwMatch[1]);
    }
  }

  // Extraire les données pour l'œil gauche (OS) si présentes
  const osSection = cleanText.match(/OS[\s\S]*?(?=Phaque[\s\S]*?Pas de données|$)/);
  if (osSection) {
    const osText = osSection[0];
    
    // Vérifier s'il y a des données pour l'œil gauche
    if (!osText.includes('Pas de données de mesure')) {
      // Même extraction que pour l'œil droit mais pour leftEye
      const alMatch = osText.match(/AL \[mm\]\s*(\d+\.\d+)/);
      if (alMatch) {
        data.measurements.leftEye.axialLength = parseFloat(alMatch[1]);
      }

      const cctMatch = osText.match(/CCT \[μm\]\s*(\d+)/);
      if (cctMatch) {
        data.measurements.leftEye.cct = parseInt(cctMatch[1]);
      }

      // Continuer avec les autres mesures...
    }
  }

  // Extraire les recommandations
  const lensMatch = cleanText.match(/LS900 cône T (.*?)\s*-\s*\d+/);
  if (lensMatch) {
    data.recommendations = `Lentille recommandée: LS900 cône T ${lensMatch[1]}`;
  }

  return data;
};

export const extractIOLDataFromPdf = async (file: File): Promise<IOLData> => {
  try {
    const rawText = await extractTextFromPdf(file);
    
    if (!rawText || rawText.trim().length === 0) {
      return {
        patientInfo: { name: '', dateOfBirth: '', patientId: '' },
        measurements: { rightEye: {}, leftEye: {} },
        recommendations: '',
        isScannedPdf: true,
        hasError: true,
        errorMessage: 'Document scanné détecté - Aucun texte n\'a pu être extrait du PDF. Veuillez utiliser un service OCR pour traiter ce document.'
      };
    }

    // Check if extracted text is very short (likely a scanned document)
    if (rawText.trim().length < 50) {
      return {
        patientInfo: { name: '', dateOfBirth: '', patientId: '' },
        measurements: { rightEye: {}, leftEye: {} },
        recommendations: '',
        isScannedPdf: true,
        hasError: true,
        errorMessage: 'Document scanné détecté - Le texte extrait est très court. Ce document semble être une image scannée nécessitant un service OCR.'
      };
    }

    return parseIOLData(rawText);
    
  } catch (error) {
    console.error('❌ Error extracting IOL data from PDF:', error);
    return {
      patientInfo: { name: '', dateOfBirth: '', patientId: '' },
      measurements: { rightEye: {}, leftEye: {} },
      recommendations: '',
      isScannedPdf: false,
      hasError: true,
      errorMessage: `Erreur lors de l'extraction: ${error?.message || 'Erreur inconnue'}`
    };
  }
};