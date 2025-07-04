
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { LETTER_CONSTANTS, getLetterDimensions, wrapTextUnified } from './letterLayout';

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

    // Load font - utiliser Helvetica pour correspondre à la prévisualisation
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

    // Utiliser les dimensions standardisées
    const dimensions = getLetterDimensions();
    const actualX = dimensions.marginLeft;
    const actualY = height - dimensions.marginTop;

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

    // Add letter content with automatic pagination using unified wrapping
    // Utiliser exactement la même largeur que dans la prévisualisation
    const lines = wrapTextUnified(letterData.letterContent, dimensions.usableWidth, letterData.textPosition.fontSize);
    
    let currentY = actualY - 60; // Start below patient name and date
    let currentPage = firstPage;
    const bottomMargin = dimensions.marginTop; // Use consistent margin
    const lineHeight = dimensions.lineHeight;
    const paragraphSpacing = dimensions.paragraphSpacing;
    
    lines.forEach((line, index) => {
      const spaceNeeded = line.isEmpty ? paragraphSpacing : lineHeight;
      
      // Check if we need a new page (only if we actually have content to add)
      if (currentY - spaceNeeded < bottomMargin && !line.isEmpty) {
        // Create new page only when needed
        const newPage = pdfDoc.addPage([595.28, 841.89]);
        currentPage = newPage;
        currentY = height * 0.9; // Start near top of new page
      }
      
      if (line.isEmpty) {
        // Ligne vide = espacement de paragraphe (seulement si on a de la place)
        if (currentY - paragraphSpacing >= bottomMargin) {
          currentY -= paragraphSpacing;
        }
      } else {
        // Calculer la position X selon si c'est une première ligne de paragraphe
        const textX = line.isFirstLineOfParagraph ? actualX + dimensions.paragraphIndent : actualX;
        
        // Justifier le texte si nécessaire (sauf dernière ligne de paragraphe)
        const shouldJustify = !line.isFirstLineOfParagraph && line.text.length > 30;
        
        if (shouldJustify) {
          // Justification simple : espacement uniforme des mots
          const availableWidth = dimensions.usableWidth - (line.isFirstLineOfParagraph ? dimensions.paragraphIndent : 0);
          const words = line.text.split(' ');
          
          if (words.length > 1) {
            const totalTextWidth = words.join('').length * letterData.textPosition.fontSize * 0.55;
            const extraSpace = availableWidth - totalTextWidth;
            const spaceBetweenWords = extraSpace / (words.length - 1);
            
            let currentX = textX;
            words.forEach((word, wordIndex) => {
              currentPage.drawText(word, {
                x: currentX,
                y: currentY,
                size: letterData.textPosition.fontSize,
                font: font,
                color: rgb(textColor.r, textColor.g, textColor.b),
              });
              
              if (wordIndex < words.length - 1) {
                currentX += word.length * letterData.textPosition.fontSize * 0.55 + spaceBetweenWords;
              }
            });
          } else {
            currentPage.drawText(line.text, {
              x: textX,
              y: currentY,
              size: letterData.textPosition.fontSize,
              font: font,
              color: rgb(textColor.r, textColor.g, textColor.b),
            });
          }
        } else {
          currentPage.drawText(line.text, {
            x: textX,
            y: currentY,
            size: letterData.textPosition.fontSize,
            font: font,
            color: rgb(textColor.r, textColor.g, textColor.b),
          });
        }
        
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

// Calculate how many pages the content will need (now uses unified calculation)
export const calculatePagesNeeded = (text: string, fontSize: number = 12): number => {
  const dimensions = getLetterDimensions();
  const lines = wrapTextUnified(text, dimensions.usableWidth, fontSize);
  
  // Calculer l'espace nécessaire
  let totalHeight = 0;
  const headerHeight = dimensions.lineHeight * 3; // Patient + Date + espacement
  
  totalHeight += headerHeight;
  
  lines.forEach(line => {
    if (line.isEmpty) {
      totalHeight += dimensions.paragraphSpacing;
    } else {
      totalHeight += dimensions.lineHeight;
    }
  });
  
  // Calculer le nombre de pages
  return Math.max(1, Math.ceil(totalHeight / dimensions.usableHeight));
};

// Note: wrapText function is now replaced by wrapTextUnified from letterLayout.ts

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
