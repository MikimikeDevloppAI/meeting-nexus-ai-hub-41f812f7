import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import PizZip from 'pizzip';
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

// Lire et modifier un template Word existant
export const generateLetterFromTemplate = async (letterData: LetterData): Promise<Uint8Array> => {
  try {
    if (!letterData.templateUrl) {
      throw new Error('Template Word requis');
    }

    console.log('🔄 Téléchargement du template Word:', letterData.templateUrl);
    
    // Télécharger le template Word
    const templateResponse = await fetch(letterData.templateUrl);
    if (!templateResponse.ok) {
      throw new Error(`Impossible de télécharger le template: ${templateResponse.status}`);
    }
    
    const templateBuffer = await templateResponse.arrayBuffer();
    console.log('✅ Template téléchargé, taille:', templateBuffer.byteLength);

    // Créer un nouveau document avec le même contenu mais avec le texte ajouté
    const dimensions = getLetterDimensions();
    const lines = wrapTextUnified(letterData.letterContent, dimensions.usableWidth, letterData.textPosition.fontSize);

    // Créer les paragraphes de contenu
    const paragraphs: Paragraph[] = [];

    // En-tête avec nom du patient
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Patient: ${letterData.patientName}`,
            bold: true,
            size: (letterData.textPosition.fontSize + 2) * 2,
            font: LETTER_CONSTANTS.FONT_FAMILY.split(',')[0].trim(),
          })
        ],
        spacing: { after: 200 }
      })
    );

    // Date
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Date: ${new Date().toLocaleDateString('fr-FR')}`,
            size: letterData.textPosition.fontSize * 2,
            font: LETTER_CONSTANTS.FONT_FAMILY.split(',')[0].trim(),
          })
        ],
        spacing: { after: 300 }
      })
    );

    // Contenu principal
    let currentParagraphRuns: TextRun[] = [];
    let isFirstLineOfParagraph = true;

    lines.forEach((line) => {
      if (line.isEmpty) {
        if (currentParagraphRuns.length > 0) {
          paragraphs.push(
            new Paragraph({
              children: currentParagraphRuns,
              alignment: AlignmentType.JUSTIFIED,
              spacing: { after: 200 }
            })
          );
          currentParagraphRuns = [];
        }
        isFirstLineOfParagraph = true;
      } else {
        if (currentParagraphRuns.length > 0) {
          currentParagraphRuns.push(new TextRun({ text: '\n' }));
        }
        
        currentParagraphRuns.push(
          new TextRun({
            text: line.text,
            size: letterData.textPosition.fontSize * 2,
            font: LETTER_CONSTANTS.FONT_FAMILY.split(',')[0].trim(),
          })
        );
        
        if (line.isFirstLineOfParagraph) {
          isFirstLineOfParagraph = false;
        }
      }
    });

    if (currentParagraphRuns.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: currentParagraphRuns,
          alignment: AlignmentType.JUSTIFIED,
        })
      );
    }

    // Créer un nouveau document avec les paragraphes
    // Note: Pour une vraie modification de template, il faudrait utiliser une bibliothèque 
    // comme docxtemplater, mais pour maintenant on crée un nouveau document
    const doc = new Document({
      sections: [{
        children: paragraphs,
        properties: {
          page: {
            size: {
              orientation: 'portrait',
              width: 11906, // A4 width in twips
              height: 16838, // A4 height in twips
            },
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
      }],
    });

    const blob = await Packer.toBlob(doc);
    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);

  } catch (error) {
    console.error('❌ Erreur lors de la génération depuis template:', error);
    throw new Error(`Erreur lors de la génération depuis template: ${error.message}`);
  }
};

export const downloadWord = (wordBytes: Uint8Array, filename: string) => {
  const blob = new Blob([wordBytes], { 
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
  });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.replace('.pdf', '.docx');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const printWord = (wordBytes: Uint8Array) => {
  const blob = new Blob([wordBytes], { 
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
  });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `lettre_impression_${new Date().getTime()}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};