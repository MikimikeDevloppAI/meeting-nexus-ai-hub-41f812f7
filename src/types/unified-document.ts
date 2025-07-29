
export interface UnifiedDocumentItem {
  id: string;
  type: 'document' | 'meeting';
  original_name: string;
  ai_generated_name: string | null;
  file_path?: string;
  file_size?: number | null;
  content_type?: string | null;
  taxonomy: any;
  ai_summary: string | null;
  processed: boolean;
  created_at: string;
  created_by: string;
  extracted_text: string | null;
  google_drive_link?: string | null;
  
  // Champs spécifiques aux meetings
  meeting_id?: string;
  audio_url?: string | null;
  transcript?: string | null;
  summary?: string | null;
  participants?: Array<{ name: string; email: string }>;
}
