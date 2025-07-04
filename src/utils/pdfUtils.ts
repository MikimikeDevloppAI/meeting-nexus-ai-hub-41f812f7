
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface TextPosition {
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

interface LetterData {
  patientName: string;
  letterContent: string;
  templateUrl?: string;
  textPosition: TextPosition;
}

export const generateLetterPDF = async (letterData: LetterData): Promise<Uint8Array> => {
  try {
    let pdfDoc: PDFDocument;

    if (letterData.templateUrl) {
      // Check if the templateUrl is a PNG (converted) and try to find the original PDF
      let pdfUrl = letterData.templateUrl;
      
      if (letterData.templateUrl.includes('pdf_conversion_') && letterData.templateUrl.endsWith('.png')) {
        // This is a converted PNG, we need to find the original PDF
        // The PNG is named like: pdf_conversion_1751446597584.png
        // We need to find the corresponding template PDF in storage
        console.log('🔍 Detected PNG template, searching for original PDF...');
        
        // For now, try to create a PDF without template since we can't easily get the original
        // TODO: We should store both URLs (PNG for display, PDF for generation) in the database
        console.log('⚠️ Using blank template since PNG cannot be used for PDF generation');
        pdfDoc = await PDFDocument.create();
        pdfDoc.addPage([595.28, 841.89]); // A4 size in points
      } else if (letterData.templateUrl.endsWith('.pdf')) {
        // Load the template PDF
        console.log('📄 Loading PDF template:', letterData.templateUrl);
        const templateResponse = await fetch(letterData.templateUrl);
        if (!templateResponse.ok) {
          throw new Error(`Failed to fetch PDF template: ${templateResponse.status}`);
        }
        const templateBytes = await templateResponse.arrayBuffer();
        pdfDoc = await PDFDocument.load(templateBytes);
      } else {
        // Unknown format, create blank PDF
        console.log('❓ Unknown template format, creating blank PDF');
        pdfDoc = await PDFDocument.create();
        pdfDoc.addPage([595.28, 841.89]); // A4 size in points
      }
    } else {
      // Create a new PDF if no template
      pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([595.28, 841.89]); // A4 size in points
    }

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    // Load font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Convert color from hex to RGB
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
      } : { r: 0, g: 0, b: 0 };
    };

    const textColor = hexToRgb(letterData.textPosition.color);

    // Position fixe avec marges raisonnables pour document A4
    const actualX = width * 0.08; // Marge gauche de 8% 
    const actualY = height * 0.85; // Position à 85% de la hauteur (marge haute de 15%)

    // Add patient name
    const patientText = `Patient: ${letterData.patientName}`;
    firstPage.drawText(patientText, {
      x: actualX,
      y: actualY,
      size: letterData.textPosition.fontSize + 2, // Slightly larger for header
      font: boldFont,
      color: rgb(textColor.r, textColor.g, textColor.b),
    });

    // Add date
    const dateText = `Date: ${new Date().toLocaleDateString('fr-FR')}`;
    firstPage.drawText(dateText, {
      x: actualX,
      y: actualY - 25,
      size: letterData.textPosition.fontSize,
      font: font,
      color: rgb(textColor.r, textColor.g, textColor.b),
    });

    // Add letter content with automatic pagination
    const maxWidth = width - actualX - 50; // Leave some margin
    const lines = wrapText(letterData.letterContent, font, letterData.textPosition.fontSize, maxWidth);
    
    let currentY = actualY - 60; // Start below patient name and date
    let currentPage = firstPage;
    const bottomMargin = 50; // Minimum distance from bottom
    const lineHeight = letterData.textPosition.fontSize + 4;
    const paragraphSpacing = letterData.textPosition.fontSize + 8;
    
    lines.forEach((line, index) => {
      const spaceNeeded = line.trim() === '' ? paragraphSpacing : lineHeight;
      
      // Check if we need a new page (only if we actually have content to add)
      if (currentY - spaceNeeded < bottomMargin && line.trim() !== '') {
        // Create new page only when needed
        const newPage = pdfDoc.addPage([595.28, 841.89]);
        currentPage = newPage;
        currentY = height * 0.9; // Start near top of new page
      }
      
      if (line.trim() === '') {
        // Ligne vide = espacement de paragraphe (seulement si on a de la place)
        if (currentY - paragraphSpacing >= bottomMargin) {
          currentY -= paragraphSpacing;
        }
      } else {
        currentPage.drawText(line, {
          x: actualX,
          y: currentY,
          size: letterData.textPosition.fontSize,
          font: font,
          color: rgb(textColor.r, textColor.g, textColor.b),
        });
        currentY -= lineHeight;
      }
    });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Erreur lors de la génération du PDF');
  }
};

// Calculate how many pages the content will need
export const calculatePagesNeeded = (text: string, fontSize: number = 12): number => {
  const linesPerPage = Math.floor((841.89 * 0.7) / (fontSize + 4)); // Approximate lines per page
  const lines = text.split('\n');
  let totalLines = 0;
  
  lines.forEach(line => {
    if (line === '') {
      totalLines += 1; // Empty line for paragraph spacing
    } else {
      // Estimate word wrapping - very rough calculation
      const wordsPerLine = Math.floor(80 / (fontSize * 0.6)); // Rough estimate
      const words = line.split(' ').length;
      const linesForThisText = Math.max(1, Math.ceil(words / wordsPerLine));
      totalLines += linesForThisText;
    }
  });
  
  return Math.max(1, Math.ceil(totalLines / linesPerPage));
};

// Helper function to wrap text with better word breaking
function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  // Diviser le texte par lignes exactement comme saisi par l'utilisateur
  const lines = text.split('\n');
  const allLines: string[] = [];

  lines.forEach(line => {
    // Ligne vide : ajouter une ligne vide pour marquer les paragraphes
    if (line.trim() === '') {
      allLines.push('');
      return;
    }

    // Vérifier si la ligne entière tient sur la largeur
    try {
      const lineWidth = font.widthOfTextAtSize(line, fontSize);
      if (lineWidth <= maxWidth) {
        allLines.push(line);
        return;
      }
    } catch (error) {
      // En cas d'erreur, continuer avec le wrapping
    }

    // La ligne est trop longue : découper intelligemment
    const words = line.split(' ');
    let currentLine = '';

    words.forEach((word, wordIndex) => {
      // Tester si on peut ajouter ce mot à la ligne courante
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      
      try {
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        
        if (testWidth <= maxWidth) {
          // Le mot rentre, on l'ajoute
          currentLine = testLine;
        } else {
          // Le mot ne rentre pas
          if (currentLine) {
            // On finalise la ligne courante
            allLines.push(currentLine);
            currentLine = word;
          } else {
            // Le mot seul est trop long, il faut le couper
            if (word.length > 15) {
              // Couper le mot long avec un tiret
              const cutPoint = Math.floor(word.length * 0.7);
              const firstPart = word.substring(0, cutPoint) + '-';
              const secondPart = word.substring(cutPoint);
              
              allLines.push(firstPart);
              currentLine = secondPart;
            } else {
              // Mot pas si long, on le met tel quel
              currentLine = word;
            }
          }
        }
      } catch (error) {
        // En cas d'erreur, traitement basique
        if (currentLine) {
          allLines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = word;
        }
      }
    });
    
    // Ajouter la dernière ligne si elle existe
    if (currentLine) {
      allLines.push(currentLine);
    }
  });
  
  return allLines;
}

export const downloadPDF = (pdfBytes: Uint8Array, filename: string) => {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const printPDF = (pdfBytes: Uint8Array) => {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  const printWindow = window.open(url);
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
  
  // Clean up after a delay
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};
