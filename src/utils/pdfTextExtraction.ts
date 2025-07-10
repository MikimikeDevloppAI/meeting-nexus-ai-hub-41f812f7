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
      surgeryType?: string;
      measurementDate?: string;
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
      q?: string;
      wtw?: number;
    };
    leftEye: {
      surgeryType?: string;
      measurementDate?: string;
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
      q?: string;
      wtw?: number;
    };
  };
  recommendations: string;
  rawText?: string; // Pour debugging
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

  // Utiliser les regex patterns pour extraire les données

  // Type de chirurgie pour les deux yeux
  data.measurements.rightEye.surgeryType = "Phaque";
  data.measurements.leftEye.surgeryType = "Phaque";
  
  // Date de mesure
  const measurementDateMatches = cleanText.match(/(\d{1,2}\s\w+\s\d{4})/g);
  if (measurementDateMatches && measurementDateMatches[0]) {
    data.measurements.rightEye.measurementDate = measurementDateMatches[0];
  }
  if (measurementDateMatches && measurementDateMatches[1]) {
    data.measurements.leftEye.measurementDate = measurementDateMatches[1];
  }
  
  // AL [mm] - Longueur axiale
  const alMatches = cleanText.match(/AL\s+\[mm\]\s+([\d\.]+)/g);
  if (alMatches && alMatches[0]) {
    const alValue = alMatches[0].match(/AL\s+\[mm\]\s+([\d\.]+)/);
    if (alValue) data.measurements.rightEye.axialLength = parseFloat(alValue[1]);
  }
  if (alMatches && alMatches[1]) {
    const alValue = alMatches[1].match(/AL\s+\[mm\]\s+([\d\.]+)/);
    if (alValue) data.measurements.leftEye.axialLength = parseFloat(alValue[1]);
  }

  // CCT [μm] - Épaisseur cornéenne centrale
  const cctMatches = cleanText.match(/CCT\s+\[μm\]\s+([\d\.]+)/g);
  if (cctMatches && cctMatches[0]) {
    const cctValue = cctMatches[0].match(/CCT\s+\[μm\]\s+([\d\.]+)/);
    if (cctValue) data.measurements.rightEye.cct = parseInt(cctValue[1]);
  }
  if (cctMatches && cctMatches[1]) {
    const cctValue = cctMatches[1].match(/CCT\s+\[μm\]\s+([\d\.]+)/);
    if (cctValue) data.measurements.leftEye.cct = parseInt(cctValue[1]);
  }

  // AD [mm] - Profondeur de chambre antérieure
  const adMatches = cleanText.match(/AD\s+\[mm\]\s+([\d\.]+)/g);
  if (adMatches && adMatches[0]) {
    const adValue = adMatches[0].match(/AD\s+\[mm\]\s+([\d\.]+)/);
    if (adValue) data.measurements.rightEye.ad = parseFloat(adValue[1]);
  }
  if (adMatches && adMatches[1]) {
    const adValue = adMatches[1].match(/AD\s+\[mm\]\s+([\d\.]+)/);
    if (adValue) data.measurements.leftEye.ad = parseFloat(adValue[1]);
  }

  // ACD [mm] - Profondeur de chambre antérieure
  const acdMatches = cleanText.match(/ACD\s+\[mm\]\s+([\d\.]+)/g);
  if (acdMatches && acdMatches[0]) {
    const acdValue = acdMatches[0].match(/ACD\s+\[mm\]\s+([\d\.]+)/);
    if (acdValue) data.measurements.rightEye.acd = parseFloat(acdValue[1]);
  }
  if (acdMatches && acdMatches[1]) {
    const acdValue = acdMatches[1].match(/ACD\s+\[mm\]\s+([\d\.]+)/);
    if (acdValue) data.measurements.leftEye.acd = parseFloat(acdValue[1]);
  }

  // LT [mm] - Épaisseur du cristallin
  const ltMatches = cleanText.match(/LT\s+\[mm\]\s+([\d\.]+)/g);
  if (ltMatches && ltMatches[0]) {
    const ltValue = ltMatches[0].match(/LT\s+\[mm\]\s+([\d\.]+)/);
    if (ltValue) data.measurements.rightEye.lt = parseFloat(ltValue[1]);
  }
  if (ltMatches && ltMatches[1]) {
    const ltValue = ltMatches[1].match(/LT\s+\[mm\]\s+([\d\.]+)/);
    if (ltValue) data.measurements.leftEye.lt = parseFloat(ltValue[1]);
  }

  // K1 [D/mm/°] - Kératométrie
  const k1Matches = cleanText.match(/K1\s+\[D\/mm\/°\]\s+([\d\.]+)\s*\/\s*([\d\.]+)\s+@\s*(\d+)/g);
  if (k1Matches && k1Matches[0]) {
    const k1Value = k1Matches[0].match(/K1\s+\[D\/mm\/°\]\s+([\d\.]+)\s*\/\s*([\d\.]+)\s+@\s*(\d+)/);
    if (k1Value) {
      data.measurements.rightEye.k1 = parseFloat(k1Value[1]);
      data.measurements.rightEye.k1_radius = parseFloat(k1Value[2]);
      data.measurements.rightEye.k1_axis = parseInt(k1Value[3]);
    }
  }
  if (k1Matches && k1Matches[1]) {
    const k1Value = k1Matches[1].match(/K1\s+\[D\/mm\/°\]\s+([\d\.]+)\s*\/\s*([\d\.]+)\s+@\s*(\d+)/);
    if (k1Value) {
      data.measurements.leftEye.k1 = parseFloat(k1Value[1]);
      data.measurements.leftEye.k1_radius = parseFloat(k1Value[2]);
      data.measurements.leftEye.k1_axis = parseInt(k1Value[3]);
    }
  }

  // K2 [D/mm/°] - Kératométrie
  const k2Matches = cleanText.match(/K2\s+\[D\/mm\/°\]\s+([\d\.]+)\s*\/\s*([\d\.]+)\s+@\s*(\d+)/g);
  if (k2Matches && k2Matches[0]) {
    const k2Value = k2Matches[0].match(/K2\s+\[D\/mm\/°\]\s+([\d\.]+)\s*\/\s*([\d\.]+)\s+@\s*(\d+)/);
    if (k2Value) {
      data.measurements.rightEye.k2 = parseFloat(k2Value[1]);
      data.measurements.rightEye.k2_radius = parseFloat(k2Value[2]);
      data.measurements.rightEye.k2_axis = parseInt(k2Value[3]);
    }
  }
  if (k2Matches && k2Matches[1]) {
    const k2Value = k2Matches[1].match(/K2\s+\[D\/mm\/°\]\s+([\d\.]+)\s*\/\s*([\d\.]+)\s+@\s*(\d+)/);
    if (k2Value) {
      data.measurements.leftEye.k2 = parseFloat(k2Value[1]);
      data.measurements.leftEye.k2_radius = parseFloat(k2Value[2]);
      data.measurements.leftEye.k2_axis = parseInt(k2Value[3]);
    }
  }

  // K [D/mm] - K moyen
  const kMatches = cleanText.match(/K\s+\[D\/mm\]\s+([\d\.]+)\s*\/\s*([\d\.]+)/g);
  if (kMatches && kMatches[0]) {
    const kValue = kMatches[0].match(/K\s+\[D\/mm\]\s+([\d\.]+)\s*\/\s*([\d\.]+)/);
    if (kValue) {
      data.measurements.rightEye.k_mean = parseFloat(kValue[1]);
      data.measurements.rightEye.k_mean_radius = parseFloat(kValue[2]);
    }
  }
  if (kMatches && kMatches[1]) {
    const kValue = kMatches[1].match(/K\s+\[D\/mm\]\s+([\d\.]+)\s*\/\s*([\d\.]+)/);
    if (kValue) {
      data.measurements.leftEye.k_mean = parseFloat(kValue[1]);
      data.measurements.leftEye.k_mean_radius = parseFloat(kValue[2]);
    }
  }

  // +AST [D/°] - Astigmatisme
  const astMatches = cleanText.match(/\+AST\s+\[D\/°\]\s+([\d\.]+)\s+@\s*(\d+)/g);
  if (astMatches && astMatches[0]) {
    const astValue = astMatches[0].match(/\+AST\s+\[D\/°\]\s+([\d\.]+)\s+@\s*(\d+)/);
    if (astValue) {
      data.measurements.rightEye.astigmatism = parseFloat(astValue[1]);
      data.measurements.rightEye.astigmatism_axis = parseInt(astValue[2]);
    }
  }
  if (astMatches && astMatches[1]) {
    const astValue = astMatches[1].match(/\+AST\s+\[D\/°\]\s+([\d\.]+)\s+@\s*(\d+)/);
    if (astValue) {
      data.measurements.leftEye.astigmatism = parseFloat(astValue[1]);
      data.measurements.leftEye.astigmatism_axis = parseInt(astValue[2]);
    }
  }

  // WTW [mm] - Distance blanc à blanc
  const wtwMatches = cleanText.match(/WTW\s+\[mm\]\s+([\d\.]+)/g);
  if (wtwMatches && wtwMatches[0]) {
    const wtwValue = wtwMatches[0].match(/WTW\s+\[mm\]\s+([\d\.]+)/);
    if (wtwValue) data.measurements.rightEye.wtw = parseFloat(wtwValue[1]);
  }
  if (wtwMatches && wtwMatches[1]) {
    const wtwValue = wtwMatches[1].match(/WTW\s+\[mm\]\s+([\d\.]+)/);
    if (wtwValue) data.measurements.leftEye.wtw = parseFloat(wtwValue[1]);
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

    const parsedData = parseIOLData(rawText);
    parsedData.rawText = rawText; // Ajouter le texte brut pour debugging
    return parsedData;
    
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