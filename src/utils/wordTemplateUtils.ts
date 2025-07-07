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

// Modifier un template Word existant avec docxtemplater
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

    // Créer un PizZip à partir du template
    const zip = new PizZip(templateBuffer);
    
    // Initialiser docxtemplater avec le template
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Préparer les données à injecter dans le template
    const templateData = {
      patientName: letterData.patientName,
      date: new Date().toLocaleDateString('fr-FR'),
      letterContent: letterData.letterContent,
      // Formatage du contenu en paragraphes pour un meilleur rendu
      letterParagraphs: letterData.letterContent.split('\n').filter(p => p.trim()).map(p => ({ text: p.trim() }))
    };

    console.log('📝 Données du template:', templateData);

    // Remplacer les balises dans le template
    doc.render(templateData);

    // Générer le document modifié
    const buffer = doc.getZip().generate({
      type: 'uint8array',
      compression: 'DEFLATE',
    });

    console.log('✅ Document généré avec succès, taille:', buffer.byteLength);
    return buffer;

  } catch (error) {
    console.error('❌ Erreur lors de la génération depuis template:', error);
    
    // Si le template n'a pas les bonnes balises, on fournit des instructions claires
    if (error.message?.includes('tag')) {
      throw new Error(`Le template Word doit contenir les balises suivantes : {{patientName}}, {{date}}, {{letterContent}}. Erreur: ${error.message}`);
    }
    
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