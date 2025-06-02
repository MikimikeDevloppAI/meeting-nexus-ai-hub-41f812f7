
import { supabase } from "@/integrations/supabase/client";
import { uploadAudioToAssemblyAI, requestTranscription, pollForTranscription } from "@/lib/assemblyai";
import { Participant } from "@/types/meeting";
import { MeetingService } from "./meetingService";

// Helper function to chunk text for embeddings with better separation
const chunkText = (text: string, maxChunkSize: number = 800, overlap: number = 100): string[] => {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Split by paragraphs first, then sentences
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  
  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) continue;
    
    // If paragraph is small enough, add it as a chunk
    if (paragraph.length <= maxChunkSize) {
      chunks.push(paragraph.trim());
      continue;
    }
    
    // Split large paragraphs by sentences
    const sentences = paragraph.split(/[.!?]+\s+/);
    let currentChunk = '';
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;
      
      // Check if adding this sentence would exceed the limit
      const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + sentence;
      
      if (potentialChunk.length > maxChunkSize && currentChunk.length > 0) {
        // Only save chunk if it's substantial enough
        if (currentChunk.trim().length >= 150) {
          chunks.push(`[Segment ${chunks.length + 1}] ${currentChunk.trim()}.`);
        }
        
        // Start new chunk with overlap from previous
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.min(overlap / 5, words.length / 2));
        currentChunk = overlapWords.join(' ') + (overlapWords.length > 0 ? '. ' : '') + sentence;
      } else {
        currentChunk = potentialChunk;
      }
    }
    
    // Add the final chunk if it has content and is substantial
    if (currentChunk.trim().length >= 150) {
      chunks.push(`[Segment ${chunks.length + 1}] ${currentChunk.trim()}${currentChunk.endsWith('.') ? '' : '.'}`);
    }
  }
  
  // Filter out chunks that are too small (increased minimum size) and ensure uniqueness
  return chunks
    .filter(chunk => chunk.length >= 150) // Increased minimum chunk size from 50 to 150
    .map((chunk, index) => {
      // Ensure each chunk is unique by adding a timestamp or unique content
      const uniqueContent = chunk.includes('[Segment') ? chunk : `[Part ${index + 1}] ${chunk}`;
      return uniqueContent;
    })
    .filter(chunk => {
      // Final filter to ensure no chunk is too small after processing
      const cleanChunk = chunk.replace(/^\[(?:Segment|Part) \d+\]\s*/, '');
      return cleanChunk.length >= 100; // Ensure at least 100 characters of actual content
    });
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
      await MeetingService.updateMeetingField(meetingId, 'audio_url', audioUrl);
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
      
      // Save original transcript as a backup
      console.log('[TRANSCRIBE] Saving raw transcript as backup...');
      await MeetingService.updateMeetingField(meetingId, 'transcript', result.text);
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
          audioUrl: null, // We already have the transcript
          participants,
          transcript // Pass the transcript directly
        }
      });

      if (response.error) {
        throw new Error(`OpenAI processing failed: ${response.error.message}`);
      }

      const result = response.data;
      console.log('[OPENAI] Processing completed successfully');

      // Save embeddings using the CLEANED transcript from OpenAI
      if (result.processedTranscript) {
        console.log('[EMBEDDINGS] Creating embeddings for cleaned transcript...');
        const textToEmbed = result.processedTranscript; // Use the cleaned version
        const chunks = chunkText(textToEmbed);
        
        if (chunks.length > 0) {
          console.log(`[EMBEDDINGS] Created ${chunks.length} unique chunks from cleaned transcript`);
          const embeddings = await generateEmbeddings(chunks);
          await this.saveEmbeddings(meetingId, chunks, embeddings, textToEmbed);
        }
      } else {
        console.warn('[EMBEDDINGS] No processed transcript available, using original');
        const chunks = chunkText(transcript);
        if (chunks.length > 0) {
          const embeddings = await generateEmbeddings(chunks);
          await this.saveEmbeddings(meetingId, chunks, embeddings, transcript);
        }
      }

      return result;
    } catch (error: any) {
      console.error('[OPENAI] Processing failed:', error);
      throw error;
    }
  }

  private static async saveEmbeddings(
    meetingId: string, 
    chunks: string[], 
    embeddings: number[][],
    fullTranscript: string
  ) {
    try {
      console.log(`[EMBEDDINGS] Starting to save ${embeddings.length} embeddings for meeting ${meetingId}`);
      
      // First, store the document
      const { data: documentData, error: documentError } = await supabase
        .from('documents')
        .insert({
          title: `Meeting Transcript - ${meetingId}`,
          type: 'meeting_transcript',
          content: fullTranscript,
          metadata: { meeting_id: meetingId }
        })
        .select()
        .single();

      if (documentError) {
        console.error('[EMBEDDINGS] Error creating document:', documentError);
        throw documentError;
      }

      console.log(`[EMBEDDINGS] Document created with ID: ${documentData.id}`);

      // Then store embeddings in batches
      const batchSize = 10;
      for (let i = 0; i < embeddings.length; i += batchSize) {
        const batch = [];
        const endIndex = Math.min(i + batchSize, embeddings.length);
        
        for (let j = i; j < endIndex; j++) {
          // Convert embedding array to the format expected by the vector type
          const embeddingVector = `[${embeddings[j].join(',')}]`;
          
          batch.push({
            document_id: documentData.id,
            meeting_id: meetingId,
            embedding: embeddingVector,
            chunk_text: chunks[j],
            chunk_index: j,
            type: 'meeting_transcript',
            metadata: { meeting_id: meetingId, chunk_index: j }
          });
        }

        const { error: embeddingError } = await supabase
          .from('document_embeddings')
          .insert(batch);

        if (embeddingError) {
          console.error(`[EMBEDDINGS] Error saving batch ${i / batchSize + 1}:`, embeddingError);
          throw embeddingError;
        }

        console.log(`[EMBEDDINGS] Saved batch ${i / batchSize + 1}/${Math.ceil(embeddings.length / batchSize)}`);
      }

      console.log(`[EMBEDDINGS] Successfully saved all ${embeddings.length} embeddings`);
    } catch (error) {
      console.error('[EMBEDDINGS] Failed to save embeddings:', error);
      throw error;
    }
  }
}
