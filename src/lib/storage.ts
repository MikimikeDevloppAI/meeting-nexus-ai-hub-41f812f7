
import { supabase } from "@/integrations/supabase/client";

// Fonction simple pour vérifier l'accès au bucket documents
export const ensureDocumentsBucket = async () => {
  try {
    console.log('Vérification du bucket documents...');
    
    // Vérifier l'accès en lecture
    const { data: files, error: listError } = await supabase.storage
      .from('documents')
      .list('', { limit: 1 });
    
    if (listError) {
      console.error('Erreur lors de l\'accès au bucket:', listError.message);
      return false;
    }

    console.log('✅ Bucket documents accessible');
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
