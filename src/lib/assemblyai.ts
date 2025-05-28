const ASSEMBLYAI_API_KEY = "8f65f133ca6f4a1b955636df7fc22ee2";
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
  error?: string;
}

export const uploadAudioToAssemblyAI = async (audioUrl: string): Promise<string> => {
  console.log('[ASSEMBLYAI] Starting audio upload to AssemblyAI...');
  
  try {
    // First fetch the audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      const errorMsg = `Failed to fetch audio file: ${audioResponse.status} ${audioResponse.statusText}`;
      console.error('[ASSEMBLYAI]', errorMsg);
      throw new Error(errorMsg);
    }
    
    const audioBlob = await audioResponse.blob();
    console.log('[ASSEMBLYAI] Audio file fetched, size:', audioBlob.size, 'bytes');

    if (audioBlob.size === 0) {
      throw new Error('Audio file is empty (0 bytes)');
    }

    console.log('[ASSEMBLYAI] Uploading audio to AssemblyAI API...');
    const response = await fetch(`${ASSEMBLYAI_BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ASSEMBLYAI_API_KEY}`,
      },
      body: audioBlob,
    });

    const responseText = await response.text();
    console.log('[ASSEMBLYAI] Upload response:', response.status, responseText);

    if (!response.ok) {
      throw new Error(`Failed to upload audio: ${response.status} ${response.statusText} - ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Invalid JSON response from AssemblyAI: ${responseText}`);
    }

    if (!data.upload_url) {
      throw new Error(`AssemblyAI did not return an upload URL: ${JSON.stringify(data)}`);
    }

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

    const responseText = await response.text();
    console.log('[ASSEMBLYAI] Transcription request response:', response.status, responseText);

    if (!response.ok) {
      throw new Error(`Failed to request transcription: ${response.status} ${response.statusText} - ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Invalid JSON response from AssemblyAI: ${responseText}`);
    }

    if (!data.id) {
      throw new Error(`AssemblyAI did not return a transcript ID: ${JSON.stringify(data)}`);
    }

    console.log('[ASSEMBLYAI] Transcription requested successfully, ID:', data.id);
    return data.id;
  } catch (error) {
    console.error('[ASSEMBLYAI] Transcription request error:', error);
    throw error;
  }
};

export const getTranscriptionResult = async (transcriptId: string): Promise<TranscriptResult> => {
  try {
    console.log(`[ASSEMBLYAI] Fetching transcript status for ID: ${transcriptId}`);
    
    const response = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript/${transcriptId}`, {
      headers: {
        'Authorization': `Bearer ${ASSEMBLYAI_API_KEY}`,
      },
    });

    const responseText = await response.text();
    console.log('[ASSEMBLYAI] Transcript status response:', response.status, responseText);

    if (!response.ok) {
      throw new Error(`Failed to get transcription: ${response.status} ${response.statusText} - ${responseText}`);
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Invalid JSON response from AssemblyAI: ${responseText}`);
    }
    
    console.log('[ASSEMBLYAI] Transcription status:', result.status);
    
    if (result.status === 'error') {
      console.error('[ASSEMBLYAI] Transcription error:', result.error);
      throw new Error(`AssemblyAI transcription failed: ${result.error || 'Unknown error'}`);
    }
    
    if (result.status === 'completed') {
      // Log transcript details for debugging
      if (result.text) {
        console.log(`[ASSEMBLYAI] Transcript length: ${result.text.length} characters`);
        console.log(`[ASSEMBLYAI] Transcript word count: ${result.text.split(/\s+/).length} words`);
      } else {
        console.warn('[ASSEMBLYAI] Completed transcript has no text');
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
        throw new Error(`AssemblyAI transcription failed: ${result.error || 'Unknown error'}`);
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
