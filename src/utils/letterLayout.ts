// Constantes communes pour le formatage des lettres
export const LETTER_CONSTANTS = {
  // Dimensions A4 en points (1 point = 1/72 inch)
  A4_WIDTH: 595.28,
  A4_HEIGHT: 841.89,
  
  // Marges en pourcentage
  MARGIN_LEFT_PERCENT: 8,
  MARGIN_TOP_PERCENT: 15,
  MARGIN_RIGHT_PERCENT: 8,
  MARGIN_BOTTOM_PERCENT: 6,
  
  // Indentation des paragraphes
  PARAGRAPH_INDENT_PERCENT: 5,
  
  // Espacement
  LINE_HEIGHT_MULTIPLIER: 1.4,
  PARAGRAPH_SPACING_MULTIPLIER: 2,
  
  // Police
  FONT_SIZE: 12,
  FONT_FAMILY: "Helvetica, Arial, sans-serif",
  
  // Couleurs
  DEFAULT_TEXT_COLOR: "#000000"
};

// Calcul des dimensions utiles
export const getLetterDimensions = () => {
  const usableWidth = LETTER_CONSTANTS.A4_WIDTH * (100 - LETTER_CONSTANTS.MARGIN_LEFT_PERCENT - LETTER_CONSTANTS.MARGIN_RIGHT_PERCENT) / 100;
  const usableHeight = LETTER_CONSTANTS.A4_HEIGHT * (100 - LETTER_CONSTANTS.MARGIN_TOP_PERCENT - LETTER_CONSTANTS.MARGIN_BOTTOM_PERCENT) / 100;
  
  const marginLeft = LETTER_CONSTANTS.A4_WIDTH * LETTER_CONSTANTS.MARGIN_LEFT_PERCENT / 100;
  const marginTop = LETTER_CONSTANTS.A4_HEIGHT * LETTER_CONSTANTS.MARGIN_TOP_PERCENT / 100;
  const marginRight = LETTER_CONSTANTS.A4_WIDTH * LETTER_CONSTANTS.MARGIN_RIGHT_PERCENT / 100;
  const paragraphIndent = LETTER_CONSTANTS.A4_WIDTH * LETTER_CONSTANTS.PARAGRAPH_INDENT_PERCENT / 100;
  
  return {
    usableWidth,
    usableHeight,
    marginLeft,
    marginTop,
    marginRight,
    paragraphIndent,
    lineHeight: LETTER_CONSTANTS.FONT_SIZE * LETTER_CONSTANTS.LINE_HEIGHT_MULTIPLIER,
    paragraphSpacing: LETTER_CONSTANTS.FONT_SIZE * LETTER_CONSTANTS.PARAGRAPH_SPACING_MULTIPLIER
  };
};

// Structure pour représenter une ligne avec ses propriétés
export interface FormattedLine {
  text: string;
  isFirstLineOfParagraph: boolean;
  isEmpty: boolean;
}

// Fonction de wrapping de texte unifié avec gestion des paragraphes
export const wrapTextUnified = (text: string, maxWidthInPoints: number, fontSize: number = LETTER_CONSTANTS.FONT_SIZE): FormattedLine[] => {
  const paragraphs = text.split('\n\n'); // Séparer par double saut de ligne
  const wrappedLines: FormattedLine[] = [];
  
  // Estimation calibrée pour Helvetica : environ 0.55 * fontSize en largeur moyenne par caractère
  const avgCharWidth = fontSize * 0.55;
  const dimensions = getLetterDimensions();
  
  // Utiliser la largeur complète disponible (avec marge droite)
  const fullUsableWidth = dimensions.usableWidth;
  const maxCharsPerLine = Math.floor(fullUsableWidth / avgCharWidth);
  const maxCharsPerIndentedLine = Math.floor((fullUsableWidth - dimensions.paragraphIndent) / avgCharWidth);
  
  paragraphs.forEach((paragraph, paragraphIndex) => {
    if (paragraph.trim() === '') {
      // Paragraphe vide = espacement
      wrappedLines.push({ text: '', isEmpty: true, isFirstLineOfParagraph: false });
      return;
    }
    
    const lines = paragraph.split('\n'); // Gérer les sauts de ligne simples dans le paragraphe
    
    lines.forEach((line, lineIndex) => {
      if (line.trim() === '') {
        wrappedLines.push({ text: '', isEmpty: true, isFirstLineOfParagraph: false });
        return;
      }
      
      const words = line.split(' ');
      let currentLine = '';
      let isFirstLineOfCurrentParagraph = lineIndex === 0;
      
      words.forEach((word, wordIndex) => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const maxChars = isFirstLineOfCurrentParagraph ? maxCharsPerIndentedLine : maxCharsPerLine;
        
        if (testLine.length <= maxChars) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            wrappedLines.push({ 
              text: currentLine, 
              isEmpty: false, 
              isFirstLineOfParagraph: isFirstLineOfCurrentParagraph 
            });
            currentLine = word;
            isFirstLineOfCurrentParagraph = false; // Les lignes suivantes ne sont plus des premières lignes
          } else {
            // Mot trop long, le couper avec tiret
            if (word.length > maxChars && maxChars > 5) {
              const cutPoint = Math.floor(maxChars * 0.8);
              const firstPart = word.substring(0, cutPoint) + '-';
              const secondPart = word.substring(cutPoint);
              
              wrappedLines.push({ 
                text: firstPart, 
                isEmpty: false, 
                isFirstLineOfParagraph: isFirstLineOfCurrentParagraph 
              });
              currentLine = secondPart;
              isFirstLineOfCurrentParagraph = false;
            } else {
              currentLine = word;
            }
          }
        }
      });
      
      if (currentLine) {
        wrappedLines.push({ 
          text: currentLine, 
          isEmpty: false, 
          isFirstLineOfParagraph: isFirstLineOfCurrentParagraph 
        });
      }
    });
  });
  
  return wrappedLines;
};

// Calcul précis du nombre de pages nécessaires
export const calculatePagesNeededPrecise = (text: string, fontSize: number = LETTER_CONSTANTS.FONT_SIZE): number => {
  const dimensions = getLetterDimensions();
  const wrappedLines = wrapTextUnified(text, dimensions.usableWidth, fontSize);
  
  // Calculer l'espace nécessaire
  let totalHeight = 0;
  const headerHeight = dimensions.lineHeight * 3; // Patient + Date + espacement
  
  totalHeight += headerHeight;
  
  wrappedLines.forEach(line => {
    if (line.isEmpty) {
      totalHeight += dimensions.paragraphSpacing;
    } else {
      totalHeight += dimensions.lineHeight;
    }
  });
  
  // Calculer le nombre de pages
  const pages = Math.max(1, Math.ceil(totalHeight / dimensions.usableHeight));
  
  return pages;
};

// Fonction pour formater le texte avec les mêmes règles que le PDF
export const formatTextForPreview = (text: string, fontSize: number = LETTER_CONSTANTS.FONT_SIZE): { lines: FormattedLine[], pages: number } => {
  const dimensions = getLetterDimensions();
  const lines = wrapTextUnified(text, dimensions.usableWidth, fontSize);
  const pages = calculatePagesNeededPrecise(text, fontSize);
  
  return { lines, pages };
};