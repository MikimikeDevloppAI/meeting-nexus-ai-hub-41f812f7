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
  
  // Espacement
  LINE_HEIGHT_MULTIPLIER: 1.4,
  PARAGRAPH_SPACING_MULTIPLIER: 2,
  
  // Police
  FONT_SIZE: 12,
  FONT_FAMILY: "'Times New Roman', serif",
  
  // Couleurs
  DEFAULT_TEXT_COLOR: "#000000"
};

// Calcul des dimensions utiles
export const getLetterDimensions = () => {
  const usableWidth = LETTER_CONSTANTS.A4_WIDTH * (100 - LETTER_CONSTANTS.MARGIN_LEFT_PERCENT - LETTER_CONSTANTS.MARGIN_RIGHT_PERCENT) / 100;
  const usableHeight = LETTER_CONSTANTS.A4_HEIGHT * (100 - LETTER_CONSTANTS.MARGIN_TOP_PERCENT - LETTER_CONSTANTS.MARGIN_BOTTOM_PERCENT) / 100;
  
  const marginLeft = LETTER_CONSTANTS.A4_WIDTH * LETTER_CONSTANTS.MARGIN_LEFT_PERCENT / 100;
  const marginTop = LETTER_CONSTANTS.A4_HEIGHT * LETTER_CONSTANTS.MARGIN_TOP_PERCENT / 100;
  
  return {
    usableWidth,
    usableHeight,
    marginLeft,
    marginTop,
    lineHeight: LETTER_CONSTANTS.FONT_SIZE * LETTER_CONSTANTS.LINE_HEIGHT_MULTIPLIER,
    paragraphSpacing: LETTER_CONSTANTS.FONT_SIZE * LETTER_CONSTANTS.PARAGRAPH_SPACING_MULTIPLIER
  };
};

// Fonction de wrapping de texte unifié (utilisée par la prévisualisation ET le PDF)
export const wrapTextUnified = (text: string, maxWidthInPoints: number, fontSize: number = LETTER_CONSTANTS.FONT_SIZE): string[] => {
  const lines = text.split('\n');
  const wrappedLines: string[] = [];
  
  // Estimation approximative : Times New Roman fait environ 0.6 * fontSize en largeur moyenne par caractère
  const avgCharWidth = fontSize * 0.6;
  const maxCharsPerLine = Math.floor(maxWidthInPoints / avgCharWidth);
  
  lines.forEach(line => {
    if (line.trim() === '') {
      wrappedLines.push('');
      return;
    }
    
    // Si la ligne est courte, l'ajouter directement
    if (line.length <= maxCharsPerLine) {
      wrappedLines.push(line);
      return;
    }
    
    // Découper la ligne en mots
    const words = line.split(' ');
    let currentLine = '';
    
    words.forEach((word, wordIndex) => {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      
      if (testLine.length <= maxCharsPerLine) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          wrappedLines.push(currentLine);
          currentLine = word;
        } else {
          // Mot trop long, le couper avec tiret
          if (word.length > maxCharsPerLine && maxCharsPerLine > 5) {
            const cutPoint = Math.floor(maxCharsPerLine * 0.8);
            const firstPart = word.substring(0, cutPoint) + '-';
            const secondPart = word.substring(cutPoint);
            
            wrappedLines.push(firstPart);
            currentLine = secondPart;
          } else {
            currentLine = word;
          }
        }
      }
    });
    
    if (currentLine) {
      wrappedLines.push(currentLine);
    }
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
    if (line.trim() === '') {
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
export const formatTextForPreview = (text: string, fontSize: number = LETTER_CONSTANTS.FONT_SIZE): { lines: string[], pages: number } => {
  const dimensions = getLetterDimensions();
  const lines = wrapTextUnified(text, dimensions.usableWidth, fontSize);
  const pages = calculatePagesNeededPrecise(text, fontSize);
  
  return { lines, pages };
};