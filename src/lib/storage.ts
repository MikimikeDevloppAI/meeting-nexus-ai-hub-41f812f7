
import { supabase } from "@/integrations/supabase/client";

// Fonction pour vérifier et valider l'accès au bucket documents
export const ensureDocumentsBucket = async () => {
  try {
    console.log('=== DIAGNOSTIC COMPLET DU STORAGE SUPABASE ===');
    
    // 1. Vérifier la connexion Supabase
    console.log('1. Vérification de la connexion Supabase...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Erreur de session:', sessionError);
    } else {
      console.log('Session:', session ? 'Utilisateur connecté' : 'Utilisateur anonyme');
    }

    // 2. Lister tous les buckets disponibles
    console.log('2. Liste des buckets disponibles...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('Erreur lors de la récupération des buckets:', bucketsError);
      return false;
    }
    
    console.log('Buckets trouvés:', buckets?.map(b => ({ name: b.name, public: b.public, id: b.id })));
    
    // 3. Vérifier spécifiquement le bucket documents
    const documentsBucket = buckets?.find(bucket => bucket.name === 'documents');
    
    if (!documentsBucket) {
      console.error('❌ PROBLÈME: Le bucket "documents" n\'existe pas');
      console.log('Buckets disponibles:', buckets?.map(b => b.name));
      return false;
    }
    
    console.log('✅ Bucket documents trouvé:', documentsBucket);
    
    // 4. Tester l'accès en lecture
    console.log('3. Test d\'accès en lecture au bucket documents...');
    const { data: files, error: listError } = await supabase.storage
      .from('documents')
      .list('', { limit: 1 });
    
    if (listError) {
      console.error('❌ Erreur lors de l\'accès en lecture:', listError);
      console.log('Message d\'erreur:', listError.message);
      return false;
    }

    console.log('✅ Accès en lecture réussi. Fichiers trouvés:', files?.length || 0);
    
    // 5. Tester l'upload si l'utilisateur est connecté
    if (session) {
      console.log('4. Test d\'upload (utilisateur connecté)...');
      const testFileName = `test-${Date.now()}.txt`;
      const testFile = new File(['test'], testFileName, { type: 'text/plain' });
      
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(testFileName, testFile);
      
      if (uploadError) {
        console.warn('⚠️ Upload limité:', uploadError.message);
      } else {
        console.log('✅ Upload réussi');
        // Nettoyer le fichier test
        await supabase.storage
          .from('documents')
          .remove([testFileName]);
        console.log('✅ Nettoyage effectué');
      }
    } else {
      console.log('4. Skip test upload (utilisateur non connecté)');
    }
    
    console.log('=== FIN DU DIAGNOSTIC ===');
    return true;
    
  } catch (error) {
    console.error('❌ ERREUR CRITIQUE lors de la vérification du storage:', error);
    if (error instanceof Error) {
      console.error('Message d\'erreur:', error.message);
      console.error('Stack:', error.stack);
    }
    return false;
  }
};

// Fonction pour tester l'accès à un fichier spécifique
export const testFileAccess = async (filePath: string): Promise<boolean> => {
  try {
    console.log('Test d\'accès au fichier:', filePath);
    
    const { data } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);
    
    console.log('URL publique générée:', data.publicUrl);
    
    // Tester si l'URL est accessible
    const response = await fetch(data.publicUrl, { method: 'HEAD' });
    const accessible = response.ok;
    
    console.log('Fichier accessible:', accessible, 'Status:', response.status);
    return accessible;
  } catch (error) {
    console.error('Erreur lors du test d\'accès au fichier:', error);
    return false;
  }
};

// Fonction pour obtenir des informations détaillées sur le bucket
export const getBucketInfo = async () => {
  try {
    console.log('Récupération des informations détaillées du bucket...');
    
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Erreur lors de la récupération des buckets:', error);
      return null;
    }
    
    const documentsBucket = buckets?.find(bucket => bucket.name === 'documents');
    
    if (documentsBucket) {
      console.log('Informations du bucket documents:', {
        id: documentsBucket.id,
        name: documentsBucket.name,
        public: documentsBucket.public,
        file_size_limit: documentsBucket.file_size_limit,
        allowed_mime_types: documentsBucket.allowed_mime_types
      });
    }
    
    return documentsBucket || null;
  } catch (error) {
    console.error('Erreur lors de la récupération des informations du bucket:', error);
    return null;
  }
};

// Fonction pour diagnostiquer les permissions
export const diagnoseBucketPermissions = async () => {
  try {
    console.log('=== DIAGNOSTIC DES PERMISSIONS ===');
    
    // Tester différentes opérations
    const tests = {
      listBuckets: false,
      listFiles: false,
      getPublicUrl: false,
      uploadFile: false
    };
    
    // Test 1: Lister les buckets
    try {
      const { error } = await supabase.storage.listBuckets();
      tests.listBuckets = !error;
      console.log('Test listBuckets:', tests.listBuckets ? '✅' : '❌', error?.message);
    } catch (e) {
      console.log('Test listBuckets: ❌', e);
    }
    
    // Test 2: Lister les fichiers
    try {
      const { error } = await supabase.storage.from('documents').list('', { limit: 1 });
      tests.listFiles = !error;
      console.log('Test listFiles:', tests.listFiles ? '✅' : '❌', error?.message);
    } catch (e) {
      console.log('Test listFiles: ❌', e);
    }
    
    // Test 3: Générer URL publique
    try {
      const { data } = supabase.storage.from('documents').getPublicUrl('test.txt');
      tests.getPublicUrl = !!data.publicUrl;
      console.log('Test getPublicUrl:', tests.getPublicUrl ? '✅' : '❌');
    } catch (e) {
      console.log('Test getPublicUrl: ❌', e);
    }
    
    // Test 4: Upload (si connecté)
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      try {
        const testFile = new File(['test'], 'diagnostic-test.txt', { type: 'text/plain' });
        const { error } = await supabase.storage
          .from('documents')
          .upload(`diagnostic-${Date.now()}.txt`, testFile);
        tests.uploadFile = !error;
        console.log('Test uploadFile:', tests.uploadFile ? '✅' : '❌', error?.message);
      } catch (e) {
        console.log('Test uploadFile: ❌', e);
      }
    } else {
      console.log('Test uploadFile: ⏭️ (non connecté)');
    }
    
    console.log('=== RÉSUMÉ DES TESTS ===', tests);
    return tests;
    
  } catch (error) {
    console.error('Erreur lors du diagnostic des permissions:', error);
    return null;
  }
};
