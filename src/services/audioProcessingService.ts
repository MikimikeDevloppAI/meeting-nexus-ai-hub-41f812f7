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
      
      // Save original transcript with a different field temporarily
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
      const response = await fetch(
        `https://ecziljpkvshvapjsxaty.functions.supabase.co/functions/v1/process-transcript`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk`,
          },
          body: JSON.stringify({
            transcript,
            participants,
            meetingId
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI processing failed: ${errorText}`);
      }

      const result = await response.json();
      console.log('[OPENAI] Processing completed successfully');

      // CRITICAL: Save processed transcript if available
      if (result.processedTranscript && result.processedTranscript.length > 0) {
        console.log('[SAVE] Saving processed transcript to replace raw version...');
        await this.saveProcessedTranscript(meetingId, result.processedTranscript);
        console.log('[SAVE] Processed transcript saved successfully, length:', result.processedTranscript.length);
      } else {
        console.warn('[SAVE] No processed transcript returned, keeping raw version');
      }

      // Save summary if available
      if (result.summary) {
        console.log('[SAVE] Saving summary...');
        await this.saveSummary(meetingId, result.summary);
      }

      // Save tasks if available
      if (result.tasks && result.tasks.length > 0) {
        console.log(`[SAVE] Saving ${result.tasks.length} tasks...`);
        await this.saveTasks(meetingId, result.tasks, participants);
      }

      // Save embeddings if available
      if (result.embeddings && result.embeddings.chunks && result.embeddings.embeddings) {
        console.log(`[SAVE] Saving ${result.embeddings.embeddings.length} embeddings...`);
        await this.saveEmbeddings(
          meetingId, 
          result.embeddings.chunks, 
          result.embeddings.embeddings,
          result.processedTranscript || transcript
        );
      }

      return result;
    } catch (error: any) {
      console.error('[OPENAI] Processing failed:', error);
      throw error;
    }
  }

  private static async saveProcessedTranscript(meetingId: string, transcript: string) {
    console.log('[SAVE] Updating meeting transcript with processed version...');
    try {
      await MeetingService.updateMeetingField(meetingId, 'transcript', transcript);
      console.log('[SAVE] Processed transcript saved successfully');
    } catch (error) {
      console.error('[SAVE] Failed to save processed transcript:', error);
      throw error;
    }
  }

  private static async saveSummary(meetingId: string, summary: string) {
    console.log('[SAVE] Saving summary...');
    await MeetingService.updateMeetingField(meetingId, 'summary', summary);
    console.log('[SAVE] Summary saved successfully');
  }

  private static async saveTasks(meetingId: string, tasks: any[], participants: any[]) {
    try {
      const tasksToSave = tasks.map(task => {
        // Find participant by name if assigned
        let assignedParticipantId = null;
        if (task.assigned_to) {
          const participant = participants.find(p => 
            p.name.toLowerCase().includes(task.assigned_to.toLowerCase()) ||
            task.assigned_to.toLowerCase().includes(p.name.toLowerCase())
          );
          if (participant) {
            assignedParticipantId = participant.id;
          }
        }

        return {
          meeting_id: meetingId,
          description: task.description,
          assigned_to: assignedParticipantId,
          due_date: task.due_date || null,
          status: 'pending'
        };
      }).filter(task => task.assigned_to); // Only save tasks with valid participants

      if (tasksToSave.length > 0) {
        const { error } = await supabase
          .from('todos')
          .insert(tasksToSave);

        if (error) {
          console.error('[TASKS] Error saving tasks:', error);
          throw error;
        }

        console.log(`[TASKS] Successfully saved ${tasksToSave.length} tasks`);
      } else {
        console.log('[TASKS] No tasks with valid participants to save');
      }
    } catch (error) {
      console.error('[TASKS] Failed to save tasks:', error);
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
