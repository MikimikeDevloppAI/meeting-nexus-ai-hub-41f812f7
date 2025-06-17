
import { supabase } from "@/integrations/supabase/client";

// Fonction pour vérifier et valider l'accès au bucket documents
export const ensureDocumentsBucket = async () => {
  try {
    console.log('Vérification du bucket documents...');
    
    // Vérifier si le bucket existe en tentant de lister les fichiers
    const { data: files, error: listError } = await supabase.storage
      .from('documents')
      .list('', { limit: 1 });
    
    if (listError) {
      console.error('Erreur lors de l\'accès au bucket documents:', listError);
      return false;
    }

    console.log('Bucket documents accessible avec succès');
    
    // Tester l'upload d'un fichier test pour vérifier les permissions
    const testFileName = `test-${Date.now()}.txt`;
    const testFile = new File(['test'], testFileName, { type: 'text/plain' });
    
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(testFileName, testFile);
    
    if (uploadError) {
      console.warn('Permission d\'upload limitée:', uploadError.message);
      // On retourne true car la lecture fonctionne, même si l'upload ne marche pas
      return true;
    }
    
    // Nettoyer le fichier test
    await supabase.storage
      .from('documents')
      .remove([testFileName]);
    
    console.log('Bucket documents entièrement fonctionnel');
    return true;
  } catch (error) {
    console.error('Erreur lors de la vérification du storage:', error);
    return false;
  }
};

// Fonction pour tester l'accès à un fichier spécifique
export const testFileAccess = async (filePath: string): Promise<boolean> => {
  try {
    const { data } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);
    
    // Tester si l'URL est accessible
    const response = await fetch(data.publicUrl, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error('Erreur lors du test d\'accès au fichier:', error);
    return false;
  }
};

// Fonction pour obtenir des informations sur le bucket
export const getBucketInfo = async () => {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Erreur lors de la récupération des buckets:', error);
      return null;
    }
    
    const documentsBucket = buckets?.find(bucket => bucket.name === 'documents');
    return documentsBucket || null;
  } catch (error) {
    console.error('Erreur lors de la récupération des informations du bucket:', error);
    return null;
  }
};
