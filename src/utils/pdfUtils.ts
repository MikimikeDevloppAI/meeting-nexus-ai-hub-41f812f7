
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
      // Load the template PDF
      const templateResponse = await fetch(letterData.templateUrl);
      const templateBytes = await templateResponse.arrayBuffer();
      pdfDoc = await PDFDocument.load(templateBytes);
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

    // Calculate actual position on PDF (convert from percentage)
    const actualX = (letterData.textPosition.x / 100) * width;
    const actualY = height - ((letterData.textPosition.y / 100) * height); // Y is inverted in PDF coordinates

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

    // Add letter content (with basic line wrapping)
    const maxWidth = width - actualX - 50; // Leave some margin
    const lines = wrapText(letterData.letterContent, font, letterData.textPosition.fontSize, maxWidth);
    
    let currentY = actualY - 60; // Start below patient name and date
    
    lines.forEach((line, index) => {
      if (currentY > 50) { // Don't go below page margin
        firstPage.drawText(line, {
          x: actualX,
          y: currentY,
          size: letterData.textPosition.fontSize,
          font: font,
          color: rgb(textColor.r, textColor.g, textColor.b),
        });
        currentY -= letterData.textPosition.fontSize + 4; // Line spacing
      }
    });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Erreur lors de la génération du PDF');
  }
};

// Helper function to wrap text
function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const textWidth = font.widthOfTextAtSize(testLine, fontSize);
    
    if (textWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
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
