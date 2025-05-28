

const ASSEMBLYAI_API_KEY = "7501ed0e8e0a4fc9acb21a7df6a6b31c";
const ASSEMBLYAI_BASE_URL = "https://api.assemblyai.com/v2";

export interface TranscriptResult {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  utterances?: Array<{
    speaker: string;
    text: string;
    start: number;
    end: number;
  }>;
}

export const uploadAudioToAssemblyAI = async (audioUrl: string): Promise<string> => {
  console.log('[ASSEMBLYAI] Starting audio upload to AssemblyAI...');
  
  try {
    // First fetch the audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio file: ${audioResponse.status} ${audioResponse.statusText}`);
    }
    
    const audioBlob = await audioResponse.blob();
    console.log('[ASSEMBLYAI] Audio file fetched, size:', audioBlob.size, 'bytes');

    const response = await fetch(`${ASSEMBLYAI_BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ASSEMBLYAI_API_KEY}`,
      },
      body: audioBlob,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ASSEMBLYAI] Upload failed:', response.status, errorText);
      throw new Error(`Failed to upload audio: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[ASSEMBLYAI] Audio uploaded successfully, URL:', data.upload_url);
    return data.upload_url;
  } catch (error) {
    console.error('[ASSEMBLYAI] Upload error:', error);
    throw error;
  }
};

export const requestTranscription = async (uploadUrl: string, participantCount: number = 2): Promise<string> => {
  console.log('[ASSEMBLYAI] Requesting transcription with', participantCount, 'expected speakers...');
  
  try {
    const transcriptionConfig = {
      audio_url: uploadUrl,
      speaker_labels: true,
      speakers_expected: Math.max(participantCount, 2),
      language_detection: true,
      punctuate: true,
      format_text: true,
      speech_model: 'nano',
      dual_channel: false,
    };

    console.log('[ASSEMBLYAI] Transcription config:', transcriptionConfig);

    const response = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ASSEMBLYAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transcriptionConfig),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ASSEMBLYAI] Transcription request failed:', response.status, errorText);
      throw new Error(`Failed to request transcription: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[ASSEMBLYAI] Transcription requested successfully, ID:', data.id);
    return data.id;
  } catch (error) {
    console.error('[ASSEMBLYAI] Transcription request error:', error);
    throw error;
  }
};

export const getTranscriptionResult = async (transcriptId: string): Promise<TranscriptResult> => {
  try {
    const response = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript/${transcriptId}`, {
      headers: {
        'Authorization': `Bearer ${ASSEMBLYAI_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ASSEMBLYAI] Get transcription failed:', response.status, errorText);
      throw new Error(`Failed to get transcription: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[ASSEMBLYAI] Transcription status:', result.status);
    
    if (result.status === 'completed') {
      // Log transcript details for debugging
      if (result.text) {
        console.log(`[ASSEMBLYAI] Transcript length: ${result.text.length} characters`);
        console.log(`[ASSEMBLYAI] Transcript word count: ${result.text.split(/\s+/).length} words`);
      }

      // Check if we have utterances (speaker diarization)
      if (result.utterances && result.utterances.length > 0) {
        console.log(`[ASSEMBLYAI] Found ${result.utterances.length} speaker utterances`);
        
        // Format transcript with speaker labels
        const formattedTranscript = result.utterances
          .map((utterance: any) => `Speaker ${utterance.speaker}: ${utterance.text}`)
          .join('\n\n');
        
        result.text = formattedTranscript;
        console.log('[ASSEMBLYAI] Formatted transcript with speaker labels');
      } else {
        console.warn('[ASSEMBLYAI] No speaker utterances found, using plain transcript');
        if (result.text) {
          // If no speaker diarization but we have text, format it as a single speaker
          result.text = `Speaker A: ${result.text}`;
          console.log('[ASSEMBLYAI] Formatted as single speaker transcript');
        }
      }
    }

    return result;
  } catch (error) {
    console.error('[ASSEMBLYAI] Get transcription error:', error);
    throw error;
  }
};

export const pollForTranscription = async (transcriptId: string): Promise<TranscriptResult> => {
  const maxAttempts = 60; // 5 minutes max
  let attempts = 0;

  console.log('[ASSEMBLYAI] Starting transcription polling...');

  while (attempts < maxAttempts) {
    try {
      const result = await getTranscriptionResult(transcriptId);
      
      if (result.status === 'completed') {
        // Ensure we have the complete transcript
        if (!result.text || result.text.length === 0) {
          throw new Error('Transcript completed but no text returned');
        }
        
        console.log(`[ASSEMBLYAI] Final transcript received with ${result.text.length} characters`);
        return result;
      }
      
      if (result.status === 'error') {
        throw new Error('AssemblyAI transcription failed with error status');
      }

      console.log(`[ASSEMBLYAI] Polling attempt ${attempts + 1}/${maxAttempts}, status: ${result.status}`);
      
      // Wait 5 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    } catch (error) {
      console.error('[ASSEMBLYAI] Polling error:', error);
      throw error;
    }
  }

  throw new Error('Transcription timeout after 5 minutes');
};

