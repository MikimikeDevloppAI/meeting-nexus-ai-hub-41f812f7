
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
  const response = await fetch(`${ASSEMBLYAI_BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': ASSEMBLYAI_API_KEY,
      'Content-Type': 'application/octet-stream',
    },
    body: await fetch(audioUrl).then(r => r.blob()),
  });

  if (!response.ok) {
    throw new Error(`Failed to upload audio: ${response.statusText}`);
  }

  const data = await response.json();
  return data.upload_url;
};

export const requestTranscription = async (uploadUrl: string, participantCount: number = 2): Promise<string> => {
  const response = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript`, {
    method: 'POST',
    headers: {
      'Authorization': ASSEMBLYAI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: uploadUrl,
      speaker_labels: true,
      speakers_expected: Math.max(participantCount, 2),
      language_code: 'fr',
      punctuate: true,
      format_text: true,
      diarization: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to request transcription: ${response.statusText}`);
  }

  const data = await response.json();
  return data.id;
};

export const getTranscriptionResult = async (transcriptId: string): Promise<TranscriptResult> => {
  const response = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript/${transcriptId}`, {
    headers: {
      'Authorization': ASSEMBLYAI_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get transcription: ${response.statusText}`);
  }

  const result = await response.json();
  
  // Log transcript details for debugging
  if (result.text) {
    console.log(`AssemblyAI transcript length: ${result.text.length} characters`);
    console.log(`AssemblyAI transcript word count: ${result.text.split(/\s+/).length} words`);
  }

  // Check if we have utterances (speaker diarization)
  if (result.utterances && result.utterances.length > 0) {
    console.log(`AssemblyAI found ${result.utterances.length} speaker utterances`);
    
    // Format transcript with speaker labels
    const formattedTranscript = result.utterances
      .map((utterance: any) => `Speaker ${utterance.speaker}: ${utterance.text}`)
      .join('\n\n');
    
    result.text = formattedTranscript;
    console.log('Formatted transcript with speaker labels');
  } else {
    console.warn('No speaker utterances found, using plain transcript');
  }

  return result;
};

export const pollForTranscription = async (transcriptId: string): Promise<TranscriptResult> => {
  const maxAttempts = 60; // 5 minutes max
  let attempts = 0;

  while (attempts < maxAttempts) {
    const result = await getTranscriptionResult(transcriptId);
    
    if (result.status === 'completed') {
      // Ensure we have the complete transcript
      if (!result.text || result.text.length === 0) {
        throw new Error('Transcript completed but no text returned');
      }
      
      console.log(`Final transcript received with ${result.text.length} characters`);
      return result;
    }
    
    if (result.status === 'error') {
      throw new Error('Transcription failed');
    }

    // Wait 5 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;
  }

  throw new Error('Transcription timeout');
};
