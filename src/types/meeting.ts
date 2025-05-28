
export interface Participant {
  id: string;
  name: string;
  email: string;
}

export interface MeetingCreationData {
  title: string;
  participants: Participant[];
  selectedParticipantIds: string[];
  audioBlob: Blob | null;
  audioFile: File | null;
}

export interface ProcessingStep {
  id: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export interface Todo {
  id: string;
  description: string;
  status: 'pending' | 'confirmed' | 'completed';
  meeting_id: string;
  assigned_to?: string;
  created_at: string;
  ai_recommendation_generated: boolean;
  meetings: { title: string }[];
  participants: { name: string }[];
  todo_participants: {
    participant_id: string;
    participants: {
      id: string;
      name: string;
      email: string;
    };
  }[];
}
