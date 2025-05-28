import { supabase } from "@/integrations/supabase/client";
import { uploadAudioToAssemblyAI, requestTranscription, pollForTranscription } from "@/lib/assemblyai";
import { Participant } from "@/types/meeting";
import { MeetingService } from "./meetingService";

// Helper function to chunk text for embeddings
const chunkText = (text: string, maxChunkSize: number = 1000): string[] => {
  const sentences = text.split(/[.!?]+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence + '.';
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 0);
};

// Function to generate embeddings using OpenAI
const generateEmbeddings = async (texts: string[]): Promise<number[][]> => {
  console.log('[EMBEDDINGS] Generating embeddings for', texts.length, 'chunks');
  
  const { data: functionResult, error: functionError } = await supabase.functions.invoke('generate-embeddings', {
    body: { texts }
  });

  if (functionError) {
    console.error('[EMBEDDINGS] Error generating embeddings:', functionError);
    throw functionError;
  }

  return functionResult.embeddings;
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

      console.log('[TRANSCRIBE] Transcript received, length:', result.text.length);
      
      // Save original transcript immediately
      console.log('[TRANSCRIBE] Saving transcript to database...');
      await MeetingService.updateMeetingField(meetingId, 'transcript', result.text);
      console.log('[TRANSCRIBE] Transcript saved successfully');
      
      return result.text;
    } catch (error: any) {
      console.error('[TRANSCRIBE] Transcription error:', error);
      throw new Error(`Erreur de transcription: ${error.message}`);
    }
  }

  static async processTranscriptWithAI(
    transcript: string,
    participants: Participant[],
    meetingId: string
  ): Promise<{ processedTranscript?: string; summary?: string }> {
    console.log('[PROCESS] Sending transcript to OpenAI for processing...');
    
    try {
      const { data: functionResult, error: functionError } = await supabase.functions.invoke('process-transcript', {
        body: {
          transcript,
          participants,
          meetingId
        }
      });

      if (functionError) {
        console.error('[PROCESS] OpenAI processing error:', functionError);
        throw new Error(`Erreur de traitement OpenAI: ${functionError.message}`);
      }

      const result: { processedTranscript?: string; summary?: string } = {};
      const updates: Record<string, any> = {};

      if (functionResult?.processedTranscript) {
        const processedTranscript = functionResult.processedTranscript;
        console.log('[PROCESS] Processed transcript received, length:', processedTranscript.length);
        updates.transcript = processedTranscript;
        result.processedTranscript = processedTranscript;

        // Store in vector database
        try {
          await this.storeTranscriptInVectorDB(processedTranscript, meetingId, participants);
        } catch (embeddingError: any) {
          console.error('[EMBEDDINGS] Failed to store in vector DB:', embeddingError);
          // Continue without failing the whole process
        }
      }

      if (functionResult?.summary) {
        const summary = functionResult.summary;
        console.log('[SUMMARY] Summary received, length:', summary.length);
        updates.summary = summary;
        result.summary = summary;
      }

      // Use batch update instead of multiple individual updates
      if (Object.keys(updates).length > 0) {
        console.log('[PROCESS] Saving processed data to database...');
        await MeetingService.batchUpdateMeeting(meetingId, updates);
        console.log('[PROCESS] Processed data saved successfully');
      }

      return result;
    } catch (error: any) {
      console.error('[PROCESS] Processing error:', error);
      throw new Error(`Erreur de traitement: ${error.message}`);
    }
  }

  static async storeTranscriptInVectorDB(
    transcript: string,
    meetingId: string,
    participants: Participant[]
  ): Promise<void> {
    console.log('[VECTOR_DB] Storing transcript in vector database...');
    
    try {
      // Chunk the transcript
      const chunks = chunkText(transcript, 1000);
      console.log('[VECTOR_DB] Created', chunks.length, 'chunks from transcript');

      // Generate embeddings for all chunks
      const embeddings = await generateEmbeddings(chunks);
      console.log('[VECTOR_DB] Generated embeddings for', embeddings.length, 'chunks');

      // Store in vector database using the helper function
      const { storeDocumentWithEmbeddings } = await import("@/integrations/supabase/client");
      
      const participantNames = participants.map(p => p.name).join(', ');
      const metadata = {
        meeting_id: meetingId,
        participants: participantNames,
        chunk_count: chunks.length
      };

      const documentId = await storeDocumentWithEmbeddings(
        `Meeting Transcript - ${meetingId}`,
        'meeting_transcript',
        transcript,
        chunks,
        embeddings,
        metadata,
        undefined, // createdBy will be handled by RLS
        meetingId
      );

      if (documentId) {
        console.log('[VECTOR_DB] Successfully stored transcript with document ID:', documentId);
      } else {
        throw new Error('Failed to store document - no ID returned');
      }

    } catch (error) {
      console.error('[VECTOR_DB] Error storing transcript in vector database:', error);
      throw error;
    }
  }
}
