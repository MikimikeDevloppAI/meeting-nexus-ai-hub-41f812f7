
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          approved: boolean
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          approved?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          approved?: boolean
          created_at?: string
        }
      }
      participants: {
        Row: {
          id: string
          name: string
          email: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          created_by?: string
          created_at?: string
        }
      }
      meetings: {
        Row: {
          id: string
          title: string
          created_at: string
          audio_url: string | null
          created_by: string
          transcript: string | null
          summary: string | null
        }
        Insert: {
          id?: string
          title: string
          created_at?: string
          audio_url?: string | null
          created_by: string
          transcript?: string | null
          summary?: string | null
        }
        Update: {
          id?: string
          title?: string
          created_at?: string
          audio_url?: string | null
          created_by?: string
          transcript?: string | null
          summary?: string | null
        }
      }
      meeting_participants: {
        Row: {
          meeting_id: string
          participant_id: string
        }
        Insert: {
          meeting_id: string
          participant_id: string
        }
        Update: {
          meeting_id?: string
          participant_id?: string
        }
      }
      todos: {
        Row: {
          id: string
          meeting_id: string
          assigned_to: string
          description: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          assigned_to: string
          description: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          assigned_to?: string
          description?: string
          status?: string
          created_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          uploaded_by: string
          file_url: string
          extracted_data: Json
          created_at: string
          status: string
        }
        Insert: {
          id?: string
          uploaded_by: string
          file_url: string
          extracted_data?: Json
          created_at?: string
          status?: string
        }
        Update: {
          id?: string
          uploaded_by?: string
          file_url?: string
          extracted_data?: Json
          created_at?: string
          status?: string
        }
      }
    }
  }
}
