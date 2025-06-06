
import { createSupabaseClient } from './database-service.ts'

export async function handleDocumentProcessing(
  supabaseClient: any,
  meetingId: string,
  cleanedTranscript: string,
  meetingName: string,
  meetingDate: string,
  chunks: string[]
) {
  console.log(`[DOCUMENT] Processing document for meeting: ${meetingId}`);
  console.log(`[DOCUMENT] Created ${chunks.length} chunks for embeddings`);

  try {
    // Générer les embeddings via l'API dédiée
    console.log('[DOCUMENT] 🔄 Génération des embeddings...');
    const embeddingResponse = await fetch('https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/generate-embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk`,
      },
      body: JSON.stringify({
        texts: chunks
      }),
    });

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      console.error('[DOCUMENT] ❌ Erreur génération embeddings:', errorText);
      throw new Error(`Failed to generate embeddings: ${errorText}`);
    }

    const embeddingData = await embeddingResponse.json();
    const embeddings = embeddingData.embeddings;
    
    console.log(`[DOCUMENT] ✅ ${embeddings.length} embeddings générés`);

    // Sauvegarder le document avec embeddings
    const { data: documentResult, error: storeError } = await supabaseClient.rpc(
      'store_document_with_embeddings',
      {
        p_title: `${meetingName} - ${meetingDate}`,
        p_type: 'meeting_transcript',
        p_content: cleanedTranscript,
        p_chunks: chunks,
        p_embeddings: embeddings.map((emb: number[]) => `[${emb.join(',')}]`),
        p_metadata: {
          meetingId: meetingId,
          meetingName: meetingName,
          meetingDate: meetingDate,
          chunkCount: chunks.length
        },
        p_meeting_id: meetingId
      }
    );

    if (storeError) {
      console.error('[DOCUMENT] ❌ Erreur sauvegarde document:', storeError);
      throw new Error(`Failed to store document: ${storeError.message}`);
    }

    console.log('[DOCUMENT] ✅ Document et embeddings sauvegardés avec succès');

    return {
      id: documentResult || meetingId,
      chunksCount: chunks.length
    };

  } catch (error) {
    console.error('[DOCUMENT] ❌ Erreur processing document:', error);
    // Return default values to not break the main flow
    return {
      id: meetingId,
      chunksCount: chunks.length,
      error: error.message
    };
  }
}
