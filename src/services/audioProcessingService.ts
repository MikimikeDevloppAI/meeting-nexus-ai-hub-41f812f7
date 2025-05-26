
import { supabase } from "@/integrations/supabase/client";
import { uploadAudioToAssemblyAI, requestTranscription, pollForTranscription } from "@/lib/assemblyai";
import { Participant } from "@/types/meeting";
import { MeetingService } from "./meetingService";

export class AudioProcessingService {
  static async uploadAudio(audioBlob: Blob | null, audioFile: File | null): Promise<string> {
    const fileToUpload = audioFile || new File([audioBlob!], "recording.webm", { 
      type: audioBlob?.type || "audio/webm" 
    });
    
    const fileName = `meetings/${Date.now()}-${fileToUpload.name}`;
    console.log('[UPLOAD] Uploading audio file:', fileName);

    const { data, error } = await supabase.storage
      .from("meeting-audio")
      .upload(fileName, fileToUpload);

    if (error) {
      console.error('[UPLOAD] Storage upload error:', error);
      throw error;
    }
    
    const { data: publicUrlData } = supabase.storage
      .from("meeting-audio")
      .getPublicUrl(fileName);
    
    const audioFileUrl = publicUrlData.publicUrl;
    console.log('[UPLOAD] Audio uploaded to:', audioFileUrl);
    
    return audioFileUrl;
  }

  static async saveAudioUrl(meetingId: string, audioUrl: string): Promise<void> {
    console.log('[SAVE_AUDIO] Saving audio URL to database...', audioUrl);
    
    try {
      await MeetingService.updateMeetingField(meetingId, 'audio_url', audioUrl);
      console.log('[SAVE_AUDIO] Audio URL saved successfully');
    } catch (error) {
      console.error('[SAVE_AUDIO] Failed to save audio URL:', error);
      throw error;
    }
  }

  static async transcribeAudio(
    audioUrl: string, 
    participantCount: number,
    meetingId: string
  ): Promise<string> {
    console.log('[TRANSCRIBE] Starting transcription process...');
    
    const uploadUrl = await uploadAudioToAssemblyAI(audioUrl);
    const transcriptId = await requestTranscription(uploadUrl, participantCount);
    const result = await pollForTranscription(transcriptId);
    
    if (!result.text) {
      throw new Error("No transcript text received");
    }

    console.log('[TRANSCRIBE] Transcript received, length:', result.text.length);
    
    // Save original transcript immediately
    console.log('[TRANSCRIBE] Saving transcript to database...');
    await MeetingService.updateMeetingField(meetingId, 'transcript', result.text);
    console.log('[TRANSCRIBE] Transcript saved successfully');
    
    return result.text;
  }

  static async processTranscriptWithAI(
    transcript: string,
    participants: Participant[],
    meetingId: string
  ): Promise<{ processedTranscript?: string; summary?: string }> {
    console.log('[PROCESS] Sending transcript to OpenAI for processing...');
    
    const { data: functionResult, error: functionError } = await supabase.functions.invoke('process-transcript', {
      body: {
        transcript,
        participants,
        meetingId
      }
    });

    if (functionError) {
      console.error('[PROCESS] OpenAI processing error:', functionError);
      throw functionError;
    }

    const result: { processedTranscript?: string; summary?: string } = {};

    if (functionResult?.processedTranscript) {
      const processedTranscript = functionResult.processedTranscript;
      console.log('[PROCESS] Processed transcript received, length:', processedTranscript.length);
      
      // Update with processed transcript
      console.log('[PROCESS] Saving processed transcript to database...');
      await MeetingService.updateMeetingField(meetingId, 'transcript', processedTranscript);
      console.log('[PROCESS] Processed transcript saved successfully');
      
      result.processedTranscript = processedTranscript;
    }

    if (functionResult?.summary) {
      const summary = functionResult.summary;
      console.log('[SUMMARY] Summary received, length:', summary.length);
      
      // Save summary immediately
      console.log('[SUMMARY] Saving summary to database...');
      await MeetingService.updateMeetingField(meetingId, 'summary', summary);
      console.log('[SUMMARY] Summary saved successfully');
      
      result.summary = summary;
    }

    return result;
  }
}
