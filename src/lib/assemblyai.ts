
const ASSEMBLYAI_API_KEY = "YOUR_API_KEY_HERE"; // You'll need to set this
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

export const requestTranscription = async (uploadUrl: string): Promise<string> => {
  const response = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript`, {
    method: 'POST',
    headers: {
      'Authorization': ASSEMBLYAI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: uploadUrl,
      speaker_labels: true,
      speakers_expected: 2, // Can be adjusted
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

  return response.json();
};

export const pollForTranscription = async (transcriptId: string): Promise<TranscriptResult> => {
  const maxAttempts = 60; // 5 minutes max
  let attempts = 0;

  while (attempts < maxAttempts) {
    const result = await getTranscriptionResult(transcriptId);
    
    if (result.status === 'completed') {
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
