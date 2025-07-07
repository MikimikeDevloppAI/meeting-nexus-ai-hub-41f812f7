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

// Générer une lettre Word avec ajout direct du contenu
export const generateLetterFromTemplate = async (letterData: LetterData): Promise<Uint8Array> => {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } = await import('docx');
  
  try {
    console.log('🔄 Génération du document Word avec ajout direct...');
    
    // Créer un nouveau document avec le contenu de la lettre
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // En-tête avec nom du patient
          new Paragraph({
            children: [
              new TextRun({
                text: `Patient: ${letterData.patientName}`,
                bold: true,
                size: 28, // 14pt
              })
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: {
              after: 400, // espacement après
            }
          }),
          
          // Date
          new Paragraph({
            children: [
              new TextRun({
                text: `Date: ${new Date().toLocaleDateString('fr-FR')}`,
                size: 24, // 12pt
              })
            ],
            spacing: {
              after: 600,
            }
          }),
          
          // Ligne de séparation
          new Paragraph({
            children: [
              new TextRun({
                text: '─────────────────────────────────────────',
                size: 20,
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: {
              after: 400,
            }
          }),
          
          // Contenu de la lettre
          ...letterData.letterContent.split('\n').map(line => 
            new Paragraph({
              children: [
                new TextRun({
                  text: line.trim(),
                  size: 24, // 12pt
                })
              ],
              spacing: {
                after: line.trim() === '' ? 200 : 120,
              },
              alignment: AlignmentType.JUSTIFIED,
            })
          )
        ]
      }]
    });

    console.log('✅ Document créé avec succès');
    const blob = await Packer.toBlob(doc);
    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
    
  } catch (error) {
    console.error('❌ Erreur lors de la génération:', error);
    throw new Error(`Erreur lors de la génération: ${error.message}`);
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
  // On télécharge le document pour que l'utilisateur l'ouvre et l'imprime
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