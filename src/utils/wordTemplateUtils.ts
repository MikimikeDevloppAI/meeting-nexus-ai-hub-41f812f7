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

// Générer une lettre Word en utilisant le template et en ajoutant le contenu au début
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
    
    // Créer le contenu à ajouter au début
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

    // Ajouter un saut de page pour séparer le contenu ajouté du template
    const pageBreak = `
      <w:p>
        <w:r>
          <w:br w:type="page"/>
        </w:r>
      </w:p>`;
    
    // Trouver le début du body et insérer le nouveau contenu au début
    const bodyStartIndex = docXmlContent.indexOf('<w:body>');
    if (bodyStartIndex === -1) {
      throw new Error('Structure XML invalide - balise <w:body> non trouvée');
    }
    
    const bodyTagEnd = docXmlContent.indexOf('>', bodyStartIndex) + 1;
    
    // Limiter le template aux 2 premières pages maximum
    let templateContent = docXmlContent.substring(bodyTagEnd);
    const bodyEndIndex = templateContent.lastIndexOf('</w:body>');
    
    if (bodyEndIndex !== -1) {
      templateContent = templateContent.substring(0, bodyEndIndex);
    }
    
    // Compter les sauts de page dans le template
    const pageBreakCount = (templateContent.match(/<w:br[^>]*w:type="page"[^>]*\/>/g) || []).length;
    
    // Si le template a plus d'une page, le limiter aux 2 premières
    if (pageBreakCount > 1) {
      const pageBreakMatches = templateContent.match(/<w:br[^>]*w:type="page"[^>]*\/>/g);
      if (pageBreakMatches && pageBreakMatches.length > 1) {
        // Trouver la position du 2ème saut de page
        let secondPageBreakIndex = -1;
        let count = 0;
        let searchIndex = 0;
        
        while (count < 2 && searchIndex < templateContent.length) {
          const match = templateContent.indexOf('<w:br', searchIndex);
          if (match === -1) break;
          
          const endMatch = templateContent.indexOf('/>', match);
          if (endMatch === -1) break;
          
          const fullMatch = templateContent.substring(match, endMatch + 2);
          if (fullMatch.includes('w:type="page"')) {
            count++;
            if (count === 2) {
              secondPageBreakIndex = endMatch + 2;
              break;
            }
          }
          searchIndex = endMatch + 2;
        }
        
        if (secondPageBreakIndex !== -1) {
          templateContent = templateContent.substring(0, secondPageBreakIndex);
        }
      }
    }
    
    const modifiedXml = docXmlContent.substring(0, bodyTagEnd) + 
                       contentToAdd + 
                       contentParagraphs + 
                       pageBreak +
                       templateContent + 
                       '</w:body></w:document>';
    
    // Remplacer le contenu du document
    doc.file('word/document.xml', modifiedXml);
    
    console.log('✅ Contenu ajouté au début du template');
    
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