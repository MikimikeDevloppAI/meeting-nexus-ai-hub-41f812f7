
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
          raw_transcript: string | null
        }
        Insert: {
          id?: string
          title: string
          created_at?: string
          audio_url?: string | null
          created_by: string
          transcript?: string | null
          summary?: string | null
          raw_transcript?: string | null
        }
        Update: {
          id?: string
          title?: string
          created_at?: string
          audio_url?: string | null
          created_by?: string
          transcript?: string | null
          summary?: string | null
          raw_transcript?: string | null
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
          due_date: string | null
          ai_recommendation_generated: boolean | null
        }
        Insert: {
          id?: string
          meeting_id: string
          assigned_to: string
          description: string
          status?: string
          created_at?: string
          due_date?: string | null
          ai_recommendation_generated?: boolean | null
        }
        Update: {
          id?: string
          meeting_id?: string
          assigned_to?: string
          description?: string
          status?: string
          created_at?: string
          due_date?: string | null
          ai_recommendation_generated?: boolean | null
        }
      }
      meeting_preparation_notes: {
        Row: {
          id: string
          todo_id: string | null
          note_text: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          todo_id?: string | null
          note_text: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          todo_id?: string | null
          note_text?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      meeting_preparation_custom_points: {
        Row: {
          id: string
          point_text: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          point_text: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          point_text?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          original_filename: string
          file_path: string
          file_size: number | null
          content_type: string | null
          status: string
          processed_at: string | null
          error_message: string | null
          compte: string | null
          purchase_category: string | null
          purchase_subcategory: string | null
          invoice_number: string | null
          invoice_date: string | null
          due_date: string | null
          total_net: number | null
          total_amount: number | null
          total_tax: number | null
          currency: string | null
          supplier_name: string | null
          supplier_address: string | null
          supplier_company_registration: string | null
          supplier_vat_number: string | null
          supplier_website: string | null
          supplier_email: string | null
          supplier_phone_number: string | null
          supplier_iban: string | null
          customer_name: string | null
          customer_address: string | null
          customer_company_registration: string | null
          customer_vat_number: string | null
          payment_details: string | null
          line_items: Json | null
          mindee_raw_response: Json | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          original_filename: string
          file_path: string
          file_size?: number | null
          content_type?: string | null
          status?: string
          processed_at?: string | null
          error_message?: string | null
          compte?: string | null
          purchase_category?: string | null
          purchase_subcategory?: string | null
          invoice_number?: string | null
          invoice_date?: string | null
          due_date?: string | null
          total_net?: number | null
          total_amount?: number | null
          total_tax?: number | null
          currency?: string | null
          supplier_name?: string | null
          supplier_address?: string | null
          supplier_company_registration?: string | null
          supplier_vat_number?: string | null
          supplier_website?: string | null
          supplier_email?: string | null
          supplier_phone_number?: string | null
          supplier_iban?: string | null
          customer_name?: string | null
          customer_address?: string | null
          customer_company_registration?: string | null
          customer_vat_number?: string | null
          payment_details?: string | null
          line_items?: Json | null
          mindee_raw_response?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          original_filename?: string
          file_path?: string
          file_size?: number | null
          content_type?: string | null
          status?: string
          processed_at?: string | null
          error_message?: string | null
          compte?: string | null
          purchase_category?: string | null
          purchase_subcategory?: string | null
          invoice_number?: string | null
          invoice_date?: string | null
          due_date?: string | null
          total_net?: number | null
          total_amount?: number | null
          total_tax?: number | null
          currency?: string | null
          supplier_name?: string | null
          supplier_address?: string | null
          supplier_company_registration?: string | null
          supplier_vat_number?: string | null
          supplier_website?: string | null
          supplier_email?: string | null
          supplier_phone_number?: string | null
          supplier_iban?: string | null
          customer_name?: string | null
          customer_address?: string | null
          customer_company_registration?: string | null
          customer_vat_number?: string | null
          payment_details?: string | null
          line_items?: Json | null
          mindee_raw_response?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      // NOUVEAU: Ajout de la colonne uploaded_document_id
      documents: {
        Row: {
          id: string
          title: string
          type: string
          content: string | null
          metadata: Json | null
          created_by: string | null
          created_at: string
          updated_at: string
          uploaded_document_id: string | null
        }
        Insert: {
          id?: string
          title: string
          type: string
          content?: string | null
          metadata?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          uploaded_document_id?: string | null
        }
        Update: {
          id?: string
          title?: string
          type?: string
          content?: string | null
          metadata?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          uploaded_document_id?: string | null
        }
      }
      uploaded_documents: {
        Row: {
          id: string
          original_name: string
          file_path: string
          file_size: number | null
          content_type: string | null
          extracted_text: string | null
          ai_generated_name: string | null
          ai_summary: string | null
          taxonomy: Json | null
          processed: boolean | null
          metadata: Json | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          original_name: string
          file_path: string
          file_size?: number | null
          content_type?: string | null
          extracted_text?: string | null
          ai_generated_name?: string | null
          ai_summary?: string | null
          taxonomy?: Json | null
          processed?: boolean | null
          metadata?: Json | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          original_name?: string
          file_path?: string
          file_size?: number | null
          content_type?: string | null
          extracted_text?: string | null
          ai_generated_name?: string | null
          ai_summary?: string | null
          taxonomy?: Json | null
          processed?: boolean | null
          metadata?: Json | null
          created_by?: string | null
          created_at?: string
        }
      }
    }
  }
}
