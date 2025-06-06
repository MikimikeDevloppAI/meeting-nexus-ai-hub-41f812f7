
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
    // Generate embeddings for the chunks
    const response = await fetch('https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/generate-embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk`,
      },
      body: JSON.stringify({
        title: `${meetingName} - ${meetingDate}`,
        type: 'meeting_transcript',
        content: cleanedTranscript,
        chunks: chunks,
        meetingId: meetingId
      }),
    });

    if (!response.ok) {
      console.error('[DOCUMENT] Embeddings generation failed:', await response.text());
      throw new Error('Failed to generate embeddings');
    }

    const result = await response.json();
    console.log('[DOCUMENT] ✅ Embeddings generated successfully');

    return {
      id: result.documentId || meetingId,
      chunksCount: chunks.length
    };

  } catch (error) {
    console.error('[DOCUMENT] Error processing document:', error);
    // Return default values to not break the main flow
    return {
      id: meetingId,
      chunksCount: chunks.length
    };
  }
}
