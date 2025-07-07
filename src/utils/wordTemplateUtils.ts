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

    // Estimer la longueur du contenu pour déterminer le nombre de pages nécessaires
    const totalLines = contentLines.length + 4; // +4 pour patient, date, séparateur, espacement
    const approximateLinesPerPage = 35; // Estimation basée sur la taille de police 12pt
    const needsSecondPage = totalLines > approximateLinesPerPage;
    
    console.log(`📄 Contenu estimé: ${totalLines} lignes, ${needsSecondPage ? '2 pages' : '1 page'} nécessaire(s)`);
    
    // Trouver le début du body
    const bodyStartIndex = docXmlContent.indexOf('<w:body>');
    if (bodyStartIndex === -1) {
      throw new Error('Structure XML invalide - balise <w:body> non trouvée');
    }
    
    const bodyTagEnd = docXmlContent.indexOf('>', bodyStartIndex) + 1;
    
    // Extraire le contenu original du template
    let templateContent = docXmlContent.substring(bodyTagEnd);
    const bodyEndIndex = templateContent.lastIndexOf('</w:body>');
    
    if (bodyEndIndex !== -1) {
      templateContent = templateContent.substring(0, bodyEndIndex);
    }
    
    // Compter les pages du template original
    const templatePageBreaks = (templateContent.match(/<w:br[^>]*w:type="page"[^>]*\/>/g) || []).length;
    const templatePages = templatePageBreaks + 1;
    
    console.log(`📑 Template original: ${templatePages} page(s)`);
    
    // Décider de la stratégie selon le contenu et le template
    let finalContent = '';
    
    if (!needsSecondPage) {
      // Contenu court : utiliser seulement la première page du template
      console.log('📝 Stratégie: Contenu sur première page seulement');
      
      // Si template multi-pages, ne garder que jusqu'au premier saut de page
      if (templatePageBreaks > 0) {
        const firstPageBreakIndex = templateContent.search(/<w:br[^>]*w:type="page"[^>]*\/>/);
        if (firstPageBreakIndex !== -1) {
          templateContent = templateContent.substring(0, firstPageBreakIndex);
        }
      }
      
      // Insérer le contenu au début, sans saut de page
      finalContent = contentToAdd + contentParagraphs + templateContent;
      
    } else {
      // Contenu long : utiliser première page + saut de page + deuxième page si disponible
      console.log('📝 Stratégie: Contenu sur première page + saut de page + template');
      
      // Limiter le template à 2 pages maximum
      if (templatePageBreaks > 1) {
        let pageCount = 0;
        let cutIndex = templateContent.length;
        
        const regex = /<w:br[^>]*w:type="page"[^>]*\/>/g;
        let match;
        
        while ((match = regex.exec(templateContent)) !== null && pageCount < 1) {
          pageCount++;
          if (pageCount === 1) {
            cutIndex = match.index + match[0].length;
          }
        }
        
        templateContent = templateContent.substring(0, cutIndex);
      }
      
      // Ajouter un saut de page entre le contenu et le template
      const pageBreak = `
        <w:p>
          <w:r>
            <w:br w:type="page"/>
          </w:r>
        </w:p>`;
      
      finalContent = contentToAdd + contentParagraphs + pageBreak + templateContent;
    }
    
    const modifiedXml = docXmlContent.substring(0, bodyTagEnd) + 
                       finalContent + 
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