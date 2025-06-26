
import JSZip from 'jszip';
import { supabase } from "@/integrations/supabase/client";

interface Invoice {
  id: string;
  original_filename: string;
  file_path: string;
  supplier_name?: string;
  invoice_date?: string;
  total_amount?: number;
  currency?: string;
  compte?: string;
  purchase_category?: string;
  purchase_subcategory?: string;
  [key: string]: any;
}

export const createInvoiceZip = async (invoices: Invoice[], filename: string) => {
  const zip = new JSZip();
  
  // Créer le CSV des factures avec les nouveaux champs
  const csvData = invoices.map(invoice => ({
    id: invoice.id,
    nom_fichier: invoice.original_filename,
    fournisseur: invoice.supplier_name || 'N/A',
    date_facture: invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('fr-FR') : 'N/A',
    montant_ttc: invoice.total_amount || 0,
    devise: invoice.currency || 'EUR',
    compte: invoice.compte || 'N/A',
    categorie_achat: invoice.purchase_category || 'N/A',
    sous_categorie_achat: invoice.purchase_subcategory || 'N/A',
    statut: invoice.status || 'N/A',
    date_creation: invoice.created_at ? new Date(invoice.created_at).toLocaleDateString('fr-FR') : 'N/A'
  }));

  // Créer le contenu CSV
  const csvContent = createCSVContent(csvData);
  zip.file('factures.csv', csvContent);

  // Créer un dossier pour les fichiers
  const filesFolder = zip.folder('fichiers');
  
  let downloadedFiles = 0;
  let failedFiles = 0;

  // Télécharger et ajouter chaque fichier de facture
  for (const invoice of invoices) {
    if (invoice.file_path) {
      try {
        console.log(`Téléchargement du fichier: ${invoice.file_path}`);
        
        const { data: fileData, error } = await supabase.storage
          .from('invoices')
          .download(invoice.file_path);

        if (error) {
          console.error(`Erreur lors du téléchargement de ${invoice.file_path}:`, error);
          failedFiles++;
          continue;
        }

        if (fileData) {
          // Créer un nom de fichier unique en cas de doublons
          const supplierPrefix = invoice.supplier_name ? 
            invoice.supplier_name.replace(/[^a-zA-Z0-9\s-_.]/g, '').substring(0, 20) : 
            'inconnu';
          
          const safeFilename = `${supplierPrefix}_${invoice.original_filename}`;
          
          filesFolder?.file(safeFilename, fileData);
          downloadedFiles++;
          console.log(`Fichier ajouté au ZIP: ${safeFilename}`);
        }
      } catch (error) {
        console.error(`Erreur lors du traitement de ${invoice.file_path}:`, error);
        failedFiles++;
      }
    }
  }

  console.log(`Fichiers téléchargés: ${downloadedFiles}, Échecs: ${failedFiles}`);

  // Générer et télécharger le ZIP
  try {
    const zipBlob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    
    // Créer le lien de téléchargement
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log(`ZIP créé avec succès: ${filename}`);
  } catch (error) {
    console.error('Erreur lors de la génération du ZIP:', error);
    throw new Error('Impossible de créer le fichier ZIP');
  }
};

const createCSVContent = (data: any[]): string => {
  if (data.length === 0) return '';
  
  // Créer l'en-tête CSV
  const headers = Object.keys(data[0]);
  const csvHeader = headers.join(',');
  
  // Créer les lignes CSV
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      
      if (value === null || value === undefined) {
        return '';
      }
      
      const stringValue = String(value);
      // Échapper les guillemets et entourer de guillemets si nécessaire
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      
      return stringValue;
    }).join(',')
  );
  
  return [csvHeader, ...csvRows].join('\n');
};
