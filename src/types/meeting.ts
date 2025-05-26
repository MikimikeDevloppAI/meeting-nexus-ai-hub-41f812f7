
export interface Participant {
  id: string;
  name: string;
  email: string;
}

export interface ProcessingStep {
  id: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export interface MeetingCreationData {
  title: string;
  audioBlob: Blob | null;
  audioFile: File | null;
  participants: Participant[];
  selectedParticipantIds: string[];
}
