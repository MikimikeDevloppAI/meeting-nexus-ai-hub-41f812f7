import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-file-name, x-file-size, x-user-id, x-timestamp, x-source, x-gdrive-link',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log("📄 Début du traitement document depuis Google Drive");

    // Récupérer les métadonnées du fichier depuis les headers
    const fileName = decodeURIComponent(req.headers.get('x-file-name') || 'unknown');
    const fileSize = parseInt(req.headers.get('x-file-size') || '0');
    const userId = req.headers.get('x-user-id');
    const gdriveLink = req.headers.get('x-gdrive-link');
    const timestamp = req.headers.get('x-timestamp') || new Date().toISOString();
    const source = req.headers.get('x-source') || 'n8n-gdrive';

    console.log("📋 Métadonnées reçues:", {
      fileName,
      fileSize,
      userId,
      gdriveLink,
      timestamp,
      source
    });

    if (!fileName || fileSize === 0) {
      throw new Error('Métadonnées de fichier manquantes ou invalides');
    }

    // Récupérer le contenu du fichier
    const fileBuffer = await req.arrayBuffer();
    const file = new Uint8Array(fileBuffer);

    console.log("📁 Fichier reçu:", fileName, "Taille:", file.length, "bytes");

    // Initialiser Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Déterminer l'extension et le type MIME
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
    let contentType = 'application/octet-stream';
    
    switch (fileExtension) {
      case 'pdf':
        contentType = 'application/pdf';
        break;
      case 'doc':
        contentType = 'application/msword';
        break;
      case 'docx':
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      case 'txt':
        contentType = 'text/plain';
        break;
    }

    // Générer un nom de fichier unique avec timestamp
    const timestamp_prefix = new Date().toISOString().replace(/[:.]/g, '-');
    const uniqueFileName = `gdrive/${timestamp_prefix}_${fileName}`;

    console.log("📤 Upload vers Supabase Storage:", uniqueFileName);

    // Upload du fichier vers Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(uniqueFileName, file, {
        contentType,
        upsert: false
      });

    if (uploadError) {
      console.error("❌ Erreur upload:", uploadError);
      throw new Error(`Erreur upload: ${uploadError.message}`);
    }

    console.log("✅ Upload réussi:", uploadData.path);

    // Créer l'entrée dans uploaded_documents
    const { data: documentData, error: insertError } = await supabase
      .from('uploaded_documents')
      .insert({
        original_name: fileName,
        file_path: uploadData.path,
        file_size: fileSize,
        content_type: contentType,
        created_by: userId,
        google_drive_link: gdriveLink,
        metadata: {
          source: source,
          uploaded_at: timestamp,
          from_gdrive: true,
          original_gdrive_link: gdriveLink
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error("❌ Erreur insertion uploaded_documents:", insertError);
      throw new Error(`Erreur insertion DB: ${insertError.message}`);
    }

    console.log("✅ Document créé en DB:", documentData.id);

    // Déclencher le traitement du document en arrière-plan
    console.log("🚀 Déclenchement du traitement en arrière-plan...");
    
    const processResponse = await supabase.functions.invoke('process-document', {
      body: { documentId: documentData.id }
    });

    if (processResponse.error) {
      console.error("⚠️ Erreur traitement document:", processResponse.error);
      // Ne pas faire échouer la requête, juste loguer l'erreur
    } else {
      console.log("✅ Traitement document initié avec succès");
    }

    return new Response(JSON.stringify({
      success: true,
      documentId: documentData.id,
      fileName: fileName,
      filePath: uploadData.path,
      gdriveLink: gdriveLink,
      message: "Document reçu et traitement initié",
      processingStatus: processResponse.error ? "error" : "initiated"
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erreur dans process-document-from-gdrive:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});