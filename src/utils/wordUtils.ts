import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  AlignmentType, 
  HeadingLevel,
  ImageRun,
  SectionType,
  convertInchesToTwip,
  convertMillimetersToTwip,
  Header
} from 'docx';
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

// Convertir le PDF en image pour l'utiliser comme background - Version améliorée
const convertPdfToImageForWord = async (pdfUrl: string): Promise<Uint8Array | null> => {
  try {
    console.log('🔄 Conversion PDF vers image pour Word - URL:', pdfUrl);
    
    // Vérifier si c'est déjà une image
    if (pdfUrl.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      console.log('✅ Fichier déjà image, téléchargement direct');
      const imageResponse = await fetch(pdfUrl);
      if (imageResponse.ok) {
        const imageBuffer = await imageResponse.arrayBuffer();
        console.log('✅ Image téléchargée, taille:', imageBuffer.byteLength);
        return new Uint8Array(imageBuffer);
      }
    }

    // Sinon, convertir le PDF
    console.log('🔄 Conversion PDF via service...');
    const response = await fetch('https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/convert-pdf-to-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk`,
      },
      body: JSON.stringify({ pdfUrl, scale: 2, quality: 0.9 }) // Haute résolution
    });

    if (response.ok) {
      const data = await response.json();
      console.log('📄 Résultat conversion:', data);
      
      if (data.success && data.imageUrl) {
        const imageResponse = await fetch(data.imageUrl);
        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer();
          console.log('✅ Image convertie téléchargée, taille:', imageBuffer.byteLength);
          return new Uint8Array(imageBuffer);
        }
      }
    } else {
      console.error('❌ Erreur HTTP:', response.status, await response.text());
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erreur lors de la conversion PDF vers image:', error);
    return null;
  }
};

export const generateLetterWord = async (letterData: LetterData): Promise<Uint8Array> => {
  try {
    const dimensions = getLetterDimensions();
    
    // Convertir le PDF en image de fond si disponible
    let backgroundImage: Uint8Array | null = null;
    if (letterData.templateUrl) {
      console.log('🔍 Template URL fourni:', letterData.templateUrl);
      backgroundImage = await convertPdfToImageForWord(letterData.templateUrl);
    }

    // Obtenir les lignes formatées avec le même système que la prévisualisation
    const lines = wrapTextUnified(letterData.letterContent, dimensions.usableWidth, letterData.textPosition.fontSize);

    // Créer les paragraphes
    const paragraphs: Paragraph[] = [];

    // En-tête avec nom du patient
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Patient: ${letterData.patientName}`,
            bold: true,
            size: (letterData.textPosition.fontSize + 2) * 2, // Word utilise des demi-points
            font: LETTER_CONSTANTS.FONT_FAMILY.split(',')[0].trim(),
          })
        ],
        spacing: {
          after: convertMillimetersToTwip(3),
        }
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
        spacing: {
          after: convertMillimetersToTwip(5),
        }
      })
    );

    // Contenu principal avec formatage identique à la prévisualisation
    let currentParagraphRuns: TextRun[] = [];
    let isFirstLineOfParagraph = true;

    lines.forEach((line, index) => {
      if (line.isEmpty) {
        // Ligne vide = fin de paragraphe
        if (currentParagraphRuns.length > 0) {
          paragraphs.push(
            new Paragraph({
              children: currentParagraphRuns,
              alignment: AlignmentType.JUSTIFIED,
              indent: {
                firstLine: isFirstLineOfParagraph ? convertMillimetersToTwip(LETTER_CONSTANTS.PARAGRAPH_INDENT_PERCENT * 2.1) : 0,
              },
              spacing: {
                line: Math.round(letterData.textPosition.fontSize * LETTER_CONSTANTS.LINE_HEIGHT_MULTIPLIER * 20),
                after: convertMillimetersToTwip(LETTER_CONSTANTS.PARAGRAPH_SPACING_MULTIPLIER * 3),
              }
            })
          );
          currentParagraphRuns = [];
        }
        isFirstLineOfParagraph = true;
      } else {
        // Ajouter le texte de la ligne
        if (currentParagraphRuns.length > 0) {
          // Ajouter un saut de ligne si ce n'est pas la première ligne du paragraphe
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

    // Ajouter le dernier paragraphe s'il existe
    if (currentParagraphRuns.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: currentParagraphRuns,
          alignment: AlignmentType.JUSTIFIED,
          indent: {
            firstLine: isFirstLineOfParagraph ? convertMillimetersToTwip(LETTER_CONSTANTS.PARAGRAPH_INDENT_PERCENT * 2.1) : 0,
          },
          spacing: {
            line: Math.round(letterData.textPosition.fontSize * LETTER_CONSTANTS.LINE_HEIGHT_MULTIPLIER * 20),
          }
        })
      );
    }

    // Configuration du document
    const docConfig: any = {
      sections: [
        {
          properties: {
            page: {
              size: {
                orientation: 'portrait',
                width: convertMillimetersToTwip(210), // A4 largeur
                height: convertMillimetersToTwip(297), // A4 hauteur
              },
              margin: {
                top: convertMillimetersToTwip(LETTER_CONSTANTS.MARGIN_TOP_PERCENT * 2.97),
                right: convertMillimetersToTwip(LETTER_CONSTANTS.MARGIN_RIGHT_PERCENT * 2.1),
                bottom: convertMillimetersToTwip(LETTER_CONSTANTS.MARGIN_BOTTOM_PERCENT * 2.97),
                left: convertMillimetersToTwip(LETTER_CONSTANTS.MARGIN_LEFT_PERCENT * 2.1),
              },
            },
          },
          children: paragraphs,
        },
      ],
    };

    // Ajouter l'image de fond si disponible - Méthode améliorée
    if (backgroundImage) {
      console.log('🖼️ Ajout de l\'image de fond en arrière-plan');
      
      // Créer l'image de fond comme premier élément avec position absolue
      const backgroundImageRun = new ImageRun({
        data: backgroundImage,
        transformation: {
          width: convertMillimetersToTwip(210), // Largeur A4
          height: convertMillimetersToTwip(297), // Hauteur A4
        },
        type: "png",
        floating: {
          horizontalPosition: {
            relative: 'page',
            offset: convertMillimetersToTwip(0),
          },
          verticalPosition: {
            relative: 'page', 
            offset: convertMillimetersToTwip(0),
          },
          wrap: {
            type: 0, // 0 = behind text (derrière le texte)
            side: 'bothSides'
          },
          margins: {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
          },
          behindDocument: true, // Placer l'image derrière le document
        }
      });

      // Ajouter l'image comme premier paragraphe invisible
      const backgroundParagraph = new Paragraph({
        children: [backgroundImageRun],
        spacing: {
          before: 0,
          after: 0,
        }
      });

      // Insérer l'image en premier dans le document
      docConfig.sections[0].children.unshift(backgroundParagraph);
      
      console.log('✅ Image de fond ajoutée avec succès');
    } else if (letterData.templateUrl) {
      console.log('⚠️ Template fourni mais conversion échouée:', letterData.templateUrl);
    }

    const doc = new Document(docConfig);

    // Générer et retourner le blob (compatible navigateur)
    const blob = await Packer.toBlob(doc);
    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    console.error('Erreur lors de la génération du document Word:', error);
    throw new Error('Erreur lors de la génération du document Word');
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
  // Les navigateurs ne peuvent pas imprimer directement les fichiers Word
  // On télécharge le fichier et informe l'utilisateur
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