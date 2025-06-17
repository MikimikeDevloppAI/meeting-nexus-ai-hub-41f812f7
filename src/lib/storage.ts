
import { supabase } from "@/integrations/supabase/client";

// Fonction pour vérifier et créer le bucket documents si nécessaire
export const ensureDocumentsBucket = async () => {
  try {
    console.log('Vérification du bucket documents...');
    
    // Vérifier si le bucket existe
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Erreur lors de la vérification des buckets:', listError);
      return false;
    }

    const documentsBucket = buckets?.find(bucket => bucket.name === 'documents');
    
    if (!documentsBucket) {
      console.log('Le bucket documents n\'existe pas, tentative de création...');
      
      const { error: createError } = await supabase.storage.createBucket('documents', {
        public: true,
        allowedMimeTypes: [
          'application/pdf',
          'text/plain',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'image/*'
        ],
        fileSizeLimit: 50 * 1024 * 1024 // 50MB
      });
      
      if (createError) {
        console.error('Erreur lors de la création du bucket:', createError);
        return false;
      }
      
      console.log('Bucket documents créé avec succès');
    } else {
      console.log('Bucket documents trouvé');
    }
    
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
