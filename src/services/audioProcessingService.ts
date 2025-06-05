import { supabase } from "@/integrations/supabase/client";
import { uploadAudioToAssemblyAI, requestTranscription, pollForTranscription } from "@/lib/assemblyai";
import { Participant } from "@/types/meeting";
import { MeetingService } from "./meetingService";

// Helper function to chunk text for embeddings with improved preservation
const chunkText = (text: string, maxChunkSize: number = 800, overlap: number = 100): string[] => {
  if (!text || text.trim().length === 0) {
    return [];
  }

  console.log(`[CHUNKING] Processing text of ${text.length} characters`);
  
  // Split by paragraphs first, then sentences
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let totalCharactersProcessed = 0;
  
  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) continue;
    
    totalCharactersProcessed += paragraph.length;
    
    // If paragraph is small enough, add it as a chunk (reduced threshold)
    if (paragraph.length <= maxChunkSize) {
      if (paragraph.trim().length >= 30) { // Reduced from 150 to 30
        chunks.push(`[Segment ${chunks.length + 1}] ${paragraph.trim()}`);
        console.log(`[CHUNKING] Added small paragraph chunk: ${paragraph.length} chars`);
      } else {
        // Preserve small paragraphs by combining with previous chunk if possible
        if (chunks.length > 0 && chunks[chunks.length - 1].length + paragraph.length <= maxChunkSize) {
          chunks[chunks.length - 1] += ` ${paragraph.trim()}`;
          console.log(`[CHUNKING] Combined small paragraph with previous chunk`);
        } else {
          // Create a minimal chunk to not lose content
          chunks.push(`[Mini-segment ${chunks.length + 1}] ${paragraph.trim()}`);
          console.log(`[CHUNKING] Created mini-chunk to preserve content: ${paragraph.length} chars`);
        }
      }
      continue;
    }
    
    // Split large paragraphs by sentences with improved logic
    const sentences = paragraph.split(/[.!?]+\s+/);
    let currentChunk = '';
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;
      
      // Add proper punctuation if missing
      const punctuatedSentence = sentence.endsWith('.') || sentence.endsWith('!') || sentence.endsWith('?') 
        ? sentence 
        : sentence + '.';
      
      // Check if adding this sentence would exceed the limit
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + punctuatedSentence;
      
      if (potentialChunk.length > maxChunkSize && currentChunk.length > 0) {
        // Save current chunk with reduced minimum threshold
        if (currentChunk.trim().length >= 50) { // Reduced from 150 to 50
          chunks.push(`[Segment ${chunks.length + 1}] ${currentChunk.trim()}`);
          console.log(`[CHUNKING] Added sentence-based chunk: ${currentChunk.length} chars`);
        }
        
        // Start new chunk with smart overlap
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.min(15, Math.floor(words.length / 3))); // More intelligent overlap
        currentChunk = overlapWords.join(' ') + (overlapWords.length > 0 ? ' ' : '') + punctuatedSentence;
      } else {
        currentChunk = potentialChunk;
      }
    }
    
    // Add the final chunk with reduced threshold
    if (currentChunk.trim().length >= 30) { // Reduced from 150 to 30
      chunks.push(`[Segment ${chunks.length + 1}] ${currentChunk.trim()}`);
      console.log(`[CHUNKING] Added final chunk: ${currentChunk.length} chars`);
    } else if (currentChunk.trim().length > 0) {
      // Don't lose any content - create mini-chunk
      chunks.push(`[Final-mini ${chunks.length + 1}] ${currentChunk.trim()}`);
      console.log(`[CHUNKING] Created final mini-chunk: ${currentChunk.length} chars`);
    }
  }
  
  // Recovery phase: if we lost too much content, create additional chunks from remaining text
  const processedLength = chunks.reduce((total, chunk) => {
    const cleanChunk = chunk.replace(/^\[(?:Segment|Part|Mini-segment|Final-mini) \d+\]\s*/, '');
    return total + cleanChunk.length;
  }, 0);
  
  const retentionRate = processedLength / text.length;
  console.log(`[CHUNKING] Content retention rate: ${(retentionRate * 100).toFixed(1)}% (${processedLength}/${text.length} chars)`);
  
  if (retentionRate < 0.85) { // If we're losing more than 15% of content
    console.log(`[CHUNKING] Low retention detected, attempting content recovery...`);
    
    // Find text portions that might have been missed
    const allChunkText = chunks.join(' ').toLowerCase();
    const originalWords = text.toLowerCase().split(/\s+/);
    const missingWords = originalWords.filter(word => 
      word.length > 3 && !allChunkText.includes(word)
    );
    
    if (missingWords.length > 0) {
      // Create recovery chunks from missing content
      const recoveryText = missingWords.join(' ');
      if (recoveryText.length >= 20) {
        chunks.push(`[Recovery ${chunks.length + 1}] Content analysis: ${recoveryText.substring(0, 400)}`);
        console.log(`[CHUNKING] Added recovery chunk with ${missingWords.length} missing words`);
      }
    }
  }
  
  // Final filtering with much more lenient criteria
  const finalChunks = chunks.filter(chunk => {
    const cleanChunk = chunk.replace(/^\[(?:Segment|Part|Mini-segment|Final-mini|Recovery) \d+\]\s*/, '');
    return cleanChunk.length >= 20; // Very permissive minimum - reduced from 100 to 20
  });
  
  console.log(`[CHUNKING] Final result: ${finalChunks.length} chunks from ${text.length} chars (${chunks.length} initial chunks)`);
  
  // Log chunk distribution for debugging
  const chunkSizes = finalChunks.map(chunk => {
    const cleanChunk = chunk.replace(/^\[(?:Segment|Part|Mini-segment|Final-mini|Recovery) \d+\]\s*/, '');
    return cleanChunk.length;
  });
  
  console.log(`[CHUNKING] Chunk size distribution: min=${Math.min(...chunkSizes)}, max=${Math.max(...chunkSizes)}, avg=${Math.round(chunkSizes.reduce((a,b) => a+b, 0) / chunkSizes.length)}`);
  
  return finalChunks;
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
    meetingId: string
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
      
      // Save original transcript as a backup - CORRECTION: utiliser directement Supabase
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
