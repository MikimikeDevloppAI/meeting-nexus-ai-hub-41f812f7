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

// Générer une lettre Word en utilisant le template et en ajoutant le contenu
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

    // Utiliser JSZip pour manipuler le document Word
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const doc = await zip.loadAsync(templateBuffer);
    
    console.log('🔄 Modification du document Word...');
    
    // Lire le document principal (document.xml)
    const docXmlFile = doc.file('word/document.xml');
    if (!docXmlFile) {
      throw new Error('Structure de document Word invalide');
    }
    
    const docXmlContent = await docXmlFile.async('string');
    
    // Créer le contenu à ajouter
    const contentToAdd = `
      <w:p>
        <w:pPr>
          <w:spacing w:after="240"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:b/>
            <w:sz w:val="28"/>
          </w:rPr>
          <w:t>Patient: ${letterData.patientName}</w:t>
        </w:r>
      </w:p>
      <w:p>
        <w:pPr>
          <w:spacing w:after="240"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:sz w:val="24"/>
          </w:rPr>
          <w:t>Date: ${new Date().toLocaleDateString('fr-FR')}</w:t>
        </w:r>
      </w:p>
      <w:p>
        <w:pPr>
          <w:spacing w:after="240"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:sz w:val="20"/>
          </w:rPr>
          <w:t>─────────────────────────────────────────</w:t>
        </w:r>
      </w:p>`;
    
    // Ajouter chaque ligne du contenu
    const contentLines = letterData.letterContent.split('\n');
    const contentParagraphs = contentLines.map(line => `
      <w:p>
        <w:pPr>
          <w:spacing w:after="120"/>
          <w:jc w:val="both"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:sz w:val="24"/>
          </w:rPr>
          <w:t>${line.trim()}</w:t>
        </w:r>
      </w:p>`).join('');
    
    // Trouver la fin du body et insérer le nouveau contenu
    const bodyEndIndex = docXmlContent.lastIndexOf('</w:body>');
    if (bodyEndIndex === -1) {
      throw new Error('Structure XML invalide - balise </w:body> non trouvée');
    }
    
    const modifiedXml = docXmlContent.substring(0, bodyEndIndex) + 
                       contentToAdd + 
                       contentParagraphs + 
                       docXmlContent.substring(bodyEndIndex);
    
    // Remplacer le contenu du document
    doc.file('word/document.xml', modifiedXml);
    
    console.log('✅ Contenu ajouté au template');
    
    // Générer le nouveau fichier Word
    const modifiedBuffer = await doc.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE'
    });
    
    console.log('✅ Document Word généré avec succès');
    return modifiedBuffer;
    
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