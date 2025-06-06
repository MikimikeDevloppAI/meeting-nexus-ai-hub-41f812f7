import { supabase } from "@/integrations/supabase/client";
import { uploadAudioToAssemblyAI, requestTranscription, pollForTranscription } from "@/lib/assemblyai";
import { Participant } from "@/types/meeting";
import { MeetingService } from "./meetingService";

// Helper function to chunk text for embeddings with sentence boundaries and size constraints
const chunkText = (text: string, minChunkSize: number = 300, maxChunkSize: number = 1000): string[] => {
  if (!text || text.trim().length === 0) {
    return [];
  }

  console.log(`[CHUNKING] Processing text of ${text.length} characters with min: ${minChunkSize}, max: ${maxChunkSize}`);
  
  const chunks: string[] = [];
  
  // Split by sentences using proper sentence endings
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;
    
    const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + trimmedSentence;
    
    // If adding this sentence would exceed max size and current chunk meets min size
    if (potentialChunk.length > maxChunkSize && currentChunk.length >= minChunkSize) {
      chunks.push(`[Segment ${chunks.length + 1}] ${currentChunk.trim()}`);
      console.log(`[CHUNKING] Created chunk ${chunks.length}: ${currentChunk.length} chars`);
      currentChunk = trimmedSentence;
    } else {
      currentChunk = potentialChunk;
    }
  }
  
  // Handle the final chunk
  if (currentChunk.trim().length >= minChunkSize) {
    chunks.push(`[Segment ${chunks.length + 1}] ${currentChunk.trim()}`);
    console.log(`[CHUNKING] Created final chunk: ${currentChunk.length} chars`);
  } else if (currentChunk.trim().length > 0) {
    // Try to merge with previous chunk if possible
    if (chunks.length > 0) {
      const lastChunk = chunks[chunks.length - 1];
      const content = lastChunk.replace(/^\[Segment \d+\]\s*/, '');
      const mergedContent = content + ' ' + currentChunk.trim();
      
      if (mergedContent.length <= maxChunkSize) {
        chunks[chunks.length - 1] = `[Segment ${chunks.length}] ${mergedContent}`;
        console.log(`[CHUNKING] Merged final chunk with previous: ${mergedContent.length} chars`);
      } else {
        // Keep as separate chunk even if small
        chunks.push(`[Final-segment ${chunks.length + 1}] ${currentChunk.trim()}`);
        console.log(`[CHUNKING] Kept small final chunk: ${currentChunk.length} chars`);
      }
    } else {
      chunks.push(`[Single-segment] ${currentChunk.trim()}`);
      console.log(`[CHUNKING] Single chunk: ${currentChunk.length} chars`);
    }
  }
  
  // Log final statistics
  const chunkSizes = chunks.map(chunk => {
    const cleanChunk = chunk.replace(/^\[(?:Segment|Final-segment|Single-segment).*?\]\s*/, '');
    return cleanChunk.length;
  });
  
  const avgSize = chunkSizes.length > 0 ? Math.round(chunkSizes.reduce((a,b) => a+b, 0) / chunkSizes.length) : 0;
  
  console.log(`[CHUNKING] Final result: ${chunks.length} chunks`);
  console.log(`[CHUNKING] Size distribution: min=${Math.min(...chunkSizes)}, max=${Math.max(...chunkSizes)}, avg=${avgSize}`);
  
  return chunks;
};

// Function to generate embeddings using OpenAI
const generateEmbeddings = async (texts: string[]): Promise<number[][]> => {
  console.log('[EMBEDDINGS] Generating embeddings for', texts.length, 'unique chunks');
  
  // Log first few characters of each chunk to verify they're different
  texts.forEach((text, index) => {
    console.log(`[EMBEDDINGS] Chunk ${index + 1} preview:`, text.substring(0, 100) + '...');
  });
  
  try {
    const { data: functionResult, error: functionError } = await supabase.functions.invoke('generate-embeddings', {
      body: { texts }
    });

    if (functionError) {
      console.error('[EMBEDDINGS] Error generating embeddings:', functionError);
      throw functionError;
    }

    console.log('[EMBEDDINGS] Successfully generated embeddings');
    return functionResult.embeddings;
  } catch (error) {
    console.error('[EMBEDDINGS] Failed to generate embeddings:', error);
    throw error;
  }
};

export class AudioProcessingService {
  static async uploadAudio(audioBlob: Blob | null, audioFile: File | null): Promise<string> {
    console.log('[UPLOAD] Starting audio upload...');

    if (!audioBlob && !audioFile) {
      throw new Error("Aucun fichier audio fourni pour le téléchargement");
    }

    const fileToUpload = audioFile || new File([audioBlob!], "recording.webm", { 
      type: audioBlob?.type || "audio/webm" 
    });
    
    if (fileToUpload.size === 0) {
      throw new Error("Le fichier audio est vide (0 octets)");
    }
    
    const fileName = `meetings/${Date.now()}-${fileToUpload.name}`;
    console.log('[UPLOAD] Uploading audio file:', fileName, 'Size:', fileToUpload.size, 'bytes');

    try {
      // Use the existing meeting-audio bucket instead of meeting-recordings
      const { data, error } = await supabase.storage
        .from("meeting-audio")
        .upload(fileName, fileToUpload);

      if (error) {
        console.error('[UPLOAD] Storage upload error:', error);
        throw new Error(`Erreur de stockage: ${error.message}`);
      }
      
      const { data: publicUrlData } = supabase.storage
        .from("meeting-audio")
        .getPublicUrl(fileName);
      
      const audioFileUrl = publicUrlData.publicUrl;
      console.log('[UPLOAD] Audio uploaded to:', audioFileUrl);
      
      return audioFileUrl;
    } catch (error: any) {
      console.error('[UPLOAD] Upload error:', error);
      throw new Error(`Erreur de téléchargement: ${error.message}`);
    }
  }

  static async saveAudioUrl(meetingId: string, audioUrl: string): Promise<void> {
    console.log('[SAVE_AUDIO] Saving audio URL to database for meeting:', meetingId, 'URL:', audioUrl);
    
    if (!meetingId) {
      throw new Error('Meeting ID is required to save audio URL');
    }

    if (!audioUrl) {
      throw new Error('Audio URL is required');
    }
    
    try {
      // CORRECTION: Utiliser directement la méthode Supabase au lieu de MeetingService
      const { error } = await supabase
        .from('meetings')
        .update({ audio_url: audioUrl })
        .eq('id', meetingId);

      if (error) {
        console.error('[SAVE_AUDIO] Error updating meeting with audio URL:', error);
        throw new Error(`Échec de l'enregistrement de l'URL audio: ${error.message}`);
      }

      console.log('[SAVE_AUDIO] Audio URL saved successfully');
    } catch (error: any) {
      console.error('[SAVE_AUDIO] Failed to save audio URL for meeting:', meetingId, error);
      throw new Error(`Échec de l'enregistrement de l'URL audio: ${error.message}`);
    }
  }

  static async transcribeAudio(
    audioUrl: string, 
    participantCount: number,
    meetingId: string,
    onTranscriptReceived?: () => void
  ): Promise<string> {
    console.log('[TRANSCRIBE] Starting transcription process with AssemblyAI...');
    
    if (!audioUrl) {
      throw new Error("URL audio manquante pour la transcription");
    }
    
    try {
      console.log('[TRANSCRIBE] Uploading audio to AssemblyAI:', audioUrl);
      const uploadUrl = await uploadAudioToAssemblyAI(audioUrl);
      
      console.log('[TRANSCRIBE] Requesting transcription with', participantCount, 'participants');
      const transcriptId = await requestTranscription(uploadUrl, participantCount);
      
      console.log('[TRANSCRIBE] Polling for transcription results');
      const result = await pollForTranscription(transcriptId);
      
      if (!result.text) {
        throw new Error("La transcription a été complétée mais aucun texte n'a été reçu");
      }

      console.log('[TRANSCRIBE] Raw transcript received, length:', result.text.length);
      
      // Save original transcript as a backup
      console.log('[TRANSCRIBE] Saving raw transcript as backup...');
      const { error } = await supabase
        .from('meetings')
        .update({ transcript: result.text })
        .eq('id', meetingId);

      if (error) {
        console.error('[TRANSCRIBE] Error saving raw transcript:', error);
        throw new Error(`Erreur de sauvegarde du transcript: ${error.message}`);
      }

      console.log('[TRANSCRIBE] Raw transcript saved successfully');
      
      // Déclencher la simulation de progression après réception du transcript
      if (onTranscriptReceived) {
        console.log('[TRANSCRIBE] Triggering processing flow simulation');
        onTranscriptReceived();
      }
      
      return result.text;
    } catch (error: any) {
      console.error('[TRANSCRIBE] Transcription error:', error);
      throw new Error(`Erreur de transcription: ${error.message}`);
    }
  }

  static async processTranscriptWithAI(
    transcript: string,
    participants: any[],
    meetingId: string
  ) {
    console.log('[OPENAI] Starting transcript processing...');
    
    try {
      const response = await supabase.functions.invoke('process-transcript', {
        body: {
          meetingId,
          participants,
          transcript // Pass the transcript directly
        }
      });

      if (response.error) {
        console.error('[OPENAI] Edge function error:', response.error);
        throw new Error(`OpenAI processing failed: ${response.error.message}`);
      }

      const result = response.data;
      console.log('[OPENAI] Processing completed successfully:', result);

      // CORRECTION: Ne plus traiter les embeddings ici car c'est déjà fait dans process-transcript
      console.log('[EMBEDDINGS] Embeddings processing handled by process-transcript function');

      return result;
    } catch (error: any) {
      console.error('[OPENAI] Processing failed:', error);
      throw error;
    }
  }

  // CORRECTION: Supprimer la fonction processEmbeddingsInBackground car elle cause la duplication
  // Les embeddings sont maintenant gérés uniquement dans process-transcript

  // CORRECTION: Supprimer la fonction saveEmbeddings car elle n'est plus utilisée
}
