interface TextPosition {
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

interface LetterData {
  patientName: string;
  patientAddress: string;
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
    
    // Fonction pour échapper les caractères XML spéciaux
    const escapeXml = (text: string) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };
    
    // Créer le contenu à ajouter au début (XML bien formé)
    const patientName = escapeXml(letterData.patientName);
    const patientAddress = escapeXml(letterData.patientAddress);
    const currentDate = escapeXml(new Date().toLocaleDateString('fr-FR'));
    
    let contentToAdd = `
    <w:p>
      <w:pPr>
        <w:spacing w:after="360"/>
      </w:pPr>
    </w:p>
    <w:p>
      <w:pPr>
        <w:spacing w:after="240"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="28"/>
        </w:rPr>
        <w:t>Patient: ${patientName}</w:t>
      </w:r>
    </w:p>`;

    // Ajouter l'adresse si elle est fournie
    if (patientAddress && patientAddress.trim()) {
      const addressLines = patientAddress.split('\n').filter(line => line.trim());
      for (const line of addressLines) {
        const escapedLine = escapeXml(line.trim());
        contentToAdd += `
    <w:p>
      <w:pPr>
        <w:spacing w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="24"/>
        </w:rPr>
        <w:t>${escapedLine}</w:t>
      </w:r>
    </w:p>`;
      }
    }

    contentToAdd += `
    <w:p>
      <w:pPr>
        <w:spacing w:after="240"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="24"/>
        </w:rPr>
        <w:t>Date: ${currentDate}</w:t>
      </w:r>
    </w:p>`;
    
    // Ajouter chaque ligne du contenu avec échappement XML
    const contentLines = letterData.letterContent.split('\n');
    const contentParagraphs = contentLines.map(line => {
      const escapedLine = escapeXml(line.trim());
      if (escapedLine === '') {
        return '<w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>';
      }
      return `
    <w:p>
      <w:pPr>
        <w:spacing w:after="120"/>
        <w:jc w:val="both"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="24"/>
        </w:rPr>
        <w:t>${escapedLine}</w:t>
      </w:r>
    </w:p>`;
    }).join('');

    // Estimer la longueur du contenu
    const totalLines = contentLines.length + 4;
    const approximateLinesPerPage = 35;
    const needsSecondPage = totalLines > approximateLinesPerPage;
    
    console.log(`📄 Contenu estimé: ${totalLines} lignes, ${needsSecondPage ? '2 pages' : '1 page'} nécessaire(s)`);
    
    // Trouver le body du document
    const bodyStartMatch = docXmlContent.match(/<w:body[^>]*>/);
    if (!bodyStartMatch) {
      throw new Error('Structure XML invalide - balise <w:body> non trouvée');
    }
    
    const bodyStartIndex = bodyStartMatch.index! + bodyStartMatch[0].length;
    const bodyEndIndex = docXmlContent.lastIndexOf('</w:body>');
    
    if (bodyEndIndex === -1) {
      throw new Error('Structure XML invalide - balise </w:body> non trouvée');
    }
    
    // Extraire le contenu du template entre <w:body> et </w:body>
    let templateContent = docXmlContent.substring(bodyStartIndex, bodyEndIndex);
    
    // Gérer les pages selon le contenu
    let finalContent = '';
    
    if (!needsSecondPage) {
      // Contenu court : supprimer les sauts de page du template
      console.log('📝 Stratégie: Contenu sur première page seulement');
      templateContent = templateContent.replace(/<w:br[^>]*w:type="page"[^>]*\/>/g, '');
      finalContent = contentToAdd + contentParagraphs + templateContent;
    } else {
      // Contenu long : ajouter saut de page et limiter template
      console.log('📝 Stratégie: Contenu + saut de page + template');
      
      // Limiter le template à la première page après un saut de page
      const pageBreakMatch = templateContent.match(/<w:br[^>]*w:type="page"[^>]*\/>/);
      if (pageBreakMatch) {
        const firstPageBreakEnd = pageBreakMatch.index! + pageBreakMatch[0].length;
        templateContent = templateContent.substring(0, firstPageBreakEnd);
      }
      
      const pageBreak = `
    <w:p>
      <w:r>
        <w:br w:type="page"/>
      </w:r>
    </w:p>`;
      
      finalContent = contentToAdd + contentParagraphs + pageBreak + templateContent;
    }
    
    // Reconstruire le document XML complet
    const documentStart = docXmlContent.substring(0, bodyStartIndex);
    const documentEnd = docXmlContent.substring(bodyEndIndex);
    const modifiedXml = documentStart + finalContent + documentEnd;
    
    // Vérifier que le XML est bien formé (validation basique)
    const openTags = (modifiedXml.match(/<w:\w+[^/>]*>/g) || []).length;
    const closeTags = (modifiedXml.match(/<\/w:\w+>/g) || []).length;
    const selfClosingTags = (modifiedXml.match(/<w:\w+[^>]*\/>/g) || []).length;
    
    console.log(`🔍 Validation XML - Balises ouvertes: ${openTags}, fermées: ${closeTags}, auto-fermées: ${selfClosingTags}`);
    
    // Remplacer le contenu du document
    doc.file('word/document.xml', modifiedXml);
    
    console.log('✅ Contenu ajouté au début du template');
    
    // Générer le nouveau fichier Word
    const modifiedBuffer = await doc.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE'
    });
    
    console.log('✅ Document Word généré avec succès, taille:', modifiedBuffer.length);
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

export const printWord = async (wordBytes: Uint8Array) => {
  try {
    console.log('🔄 Conversion Word vers PDF pour impression...');
    
    // Créer un blob temporaire du fichier Word
    const wordBlob = new Blob([wordBytes], { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
    
    // Créer un FormData pour envoyer le fichier Word
    const formData = new FormData();
    formData.append('file', wordBlob, 'lettre_impression.docx');
    
    // Appeler un service de conversion Word vers PDF
    const response = await fetch('https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/convert-word-to-pdf', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk`,
      },
      body: formData,
    });
    
    if (response.ok) {
      const pdfBlob = await response.blob();
      
      // Créer une URL temporaire pour le PDF
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Ouvrir le PDF dans une nouvelle fenêtre et lancer l'impression
      const printWindow = window.open(pdfUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
          // Nettoyer l'URL après un délai
          setTimeout(() => {
            URL.revokeObjectURL(pdfUrl);
            printWindow.close();
          }, 1000);
        };
      } else {
        // Si popup bloqué, fallback : télécharger pour impression
        console.log('⚠️ Popup bloqué, téléchargement pour impression...');
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `lettre_impression_${new Date().getTime()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(pdfUrl);
      }
    } else {
      throw new Error('Échec de la conversion en PDF');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la conversion pour impression:', error);
    
    // Fallback : télécharger le Word pour impression manuelle
    console.log('🔄 Fallback : téléchargement du fichier Word...');
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
  }
};