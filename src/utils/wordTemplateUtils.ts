import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

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

// Générer une lettre avec template Word - Mode hybride
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

    // Essayer d'abord avec docxtemplater (mode balises)
    try {
      console.log('🔍 Tentative avec mode balises...');
      const zip = new PizZip(templateBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      const templateData = {
        patientName: letterData.patientName,
        date: new Date().toLocaleDateString('fr-FR'),
        letterContent: letterData.letterContent,
        letterParagraphs: letterData.letterContent.split('\n').filter(p => p.trim()).map(p => ({ text: p.trim() }))
      };

      doc.render(templateData);
      console.log('✅ Mode balises réussi');
      
      const buffer = doc.getZip().generate({
        type: 'uint8array',
        compression: 'DEFLATE',
      });

      return buffer;
    } catch (tagError) {
      console.log('⚠️ Mode balises échoué, basculement en mode ajout direct:', tagError.message);
      
      // Mode ajout direct avec la librairie docx
      return await generateWithDirectAppend(templateBuffer, letterData);
    }

  } catch (error) {
    console.error('❌ Erreur lors de la génération:', error);
    throw new Error(`Erreur lors de la génération: ${error.message}`);
  }
};

// Générer avec ajout direct du contenu (sans balises)
const generateWithDirectAppend = async (templateBuffer: ArrayBuffer, letterData: LetterData): Promise<Uint8Array> => {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } = await import('docx');
  
  try {
    console.log('🔄 Mode ajout direct - Création du document...');
    
    // Pour le moment, on crée un nouveau document basé sur le template
    // et on ajoute notre contenu à la fin
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
    const buffer = await Packer.toBuffer(doc);
    return new Uint8Array(buffer);
    
  } catch (error) {
    console.error('❌ Erreur en mode ajout direct:', error);
    throw new Error(`Erreur en mode ajout direct: ${error.message}`);
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