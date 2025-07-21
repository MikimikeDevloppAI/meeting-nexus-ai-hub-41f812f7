export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      document_embeddings: {
        Row: {
          chunk_index: number
          chunk_text: string
          created_at: string | null
          document_id: string | null
          embedding: string | null
          id: string
          meeting_id: string | null
          metadata: Json | null
          type: string
        }
        Insert: {
          chunk_index: number
          chunk_text: string
          created_at?: string | null
          document_id?: string | null
          embedding?: string | null
          id?: string
          meeting_id?: string | null
          metadata?: Json | null
          type: string
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          created_at?: string | null
          document_id?: string | null
          embedding?: string | null
          id?: string
          meeting_id?: string | null
          metadata?: Json | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_embeddings_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_embeddings_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content: string | null
          created_at: string | null
          created_by: string | null
          id: string
          metadata: Json | null
          title: string
          type: string
          updated_at: string | null
          uploaded_document_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          metadata?: Json | null
          title: string
          type: string
          updated_at?: string | null
          uploaded_document_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          metadata?: Json | null
          title?: string
          type?: string
          updated_at?: string | null
          uploaded_document_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_uploaded_document_id_fkey"
            columns: ["uploaded_document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          compte: string | null
          content_type: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          customer_address: string | null
          customer_company_registration: string | null
          customer_name: string | null
          customer_vat_number: string | null
          due_date: string | null
          error_message: string | null
          exchange_rate: number | null
          file_path: string | null
          file_size: number | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          invoice_type: string | null
          line_items: Json | null
          mindee_raw_response: Json | null
          original_amount_chf: number | null
          original_filename: string | null
          payment_date: string | null
          payment_details: string | null
          processed_at: string | null
          purchase_category: string | null
          purchase_subcategory: string | null
          status: string | null
          supplier_address: string | null
          supplier_company_registration: string | null
          supplier_email: string | null
          supplier_iban: string | null
          supplier_name: string | null
          supplier_phone_number: string | null
          supplier_vat_number: string | null
          supplier_website: string | null
          total_amount: number | null
          total_net: number | null
          total_tax: number | null
          updated_at: string | null
        }
        Insert: {
          compte?: string | null
          content_type?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_address?: string | null
          customer_company_registration?: string | null
          customer_name?: string | null
          customer_vat_number?: string | null
          due_date?: string | null
          error_message?: string | null
          exchange_rate?: number | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_type?: string | null
          line_items?: Json | null
          mindee_raw_response?: Json | null
          original_amount_chf?: number | null
          original_filename?: string | null
          payment_date?: string | null
          payment_details?: string | null
          processed_at?: string | null
          purchase_category?: string | null
          purchase_subcategory?: string | null
          status?: string | null
          supplier_address?: string | null
          supplier_company_registration?: string | null
          supplier_email?: string | null
          supplier_iban?: string | null
          supplier_name?: string | null
          supplier_phone_number?: string | null
          supplier_vat_number?: string | null
          supplier_website?: string | null
          total_amount?: number | null
          total_net?: number | null
          total_tax?: number | null
          updated_at?: string | null
        }
        Update: {
          compte?: string | null
          content_type?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_address?: string | null
          customer_company_registration?: string | null
          customer_name?: string | null
          customer_vat_number?: string | null
          due_date?: string | null
          error_message?: string | null
          exchange_rate?: number | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_type?: string | null
          line_items?: Json | null
          mindee_raw_response?: Json | null
          original_amount_chf?: number | null
          original_filename?: string | null
          payment_date?: string | null
          payment_details?: string | null
          processed_at?: string | null
          purchase_category?: string | null
          purchase_subcategory?: string | null
          status?: string | null
          supplier_address?: string | null
          supplier_company_registration?: string | null
          supplier_email?: string | null
          supplier_iban?: string | null
          supplier_name?: string | null
          supplier_phone_number?: string | null
          supplier_vat_number?: string | null
          supplier_website?: string | null
          total_amount?: number | null
          total_net?: number | null
          total_tax?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      letter_templates: {
        Row: {
          created_at: string
          file_url: string
          filename: string
          id: string
          original_pdf_url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          file_url: string
          filename: string
          id?: string
          original_pdf_url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          file_url?: string
          filename?: string
          id?: string
          original_pdf_url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      meeting_preparation_custom_points: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          point_text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          point_text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          point_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_preparation_custom_points_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_preparation_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note_text: string
          todo_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note_text: string
          todo_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note_text?: string
          todo_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_preparation_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_preparation_notes_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "todos"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_users: {
        Row: {
          meeting_id: string
          user_id: string
        }
        Insert: {
          meeting_id: string
          user_id: string
        }
        Update: {
          meeting_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_users_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          audio_url: string | null
          created_at: string
          created_by: string
          id: string
          raw_transcript: string | null
          summary: string | null
          title: string
          transcript: string | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          created_by: string
          id?: string
          raw_transcript?: string | null
          summary?: string | null
          title: string
          transcript?: string | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          created_by?: string
          id?: string
          raw_transcript?: string | null
          summary?: string | null
          title?: string
          transcript?: string | null
        }
        Relationships: []
      }
      overtime_hours: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          date: string
          description: string | null
          hours: number
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          date: string
          description?: string | null
          hours: number
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          date?: string
          description?: string | null
          hours?: number
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_overtime_hours_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          path: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id: string
          name: string
          path: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          path?: string
        }
        Relationships: []
      }
      task_deep_search_followups: {
        Row: {
          answer: string
          created_at: string
          created_by: string | null
          deep_search_id: string
          id: string
          question: string
        }
        Insert: {
          answer: string
          created_at?: string
          created_by?: string | null
          deep_search_id: string
          id?: string
          question: string
        }
        Update: {
          answer?: string
          created_at?: string
          created_by?: string | null
          deep_search_id?: string
          id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_deep_search_followups_deep_search_id_fkey"
            columns: ["deep_search_id"]
            isOneToOne: false
            referencedRelation: "task_deep_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      task_deep_searches: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          search_query: string
          search_result: string
          sources: Json | null
          todo_id: string
          user_context: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          search_query: string
          search_result: string
          sources?: Json | null
          todo_id: string
          user_context: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          search_query?: string
          search_result?: string
          sources?: Json | null
          todo_id?: string
          user_context?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_deep_searches_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "todos"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_ai_recommendations: {
        Row: {
          created_at: string | null
          email_draft: string | null
          id: string
          recommendation_text: string
          todo_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email_draft?: string | null
          id?: string
          recommendation_text: string
          todo_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email_draft?: string | null
          id?: string
          recommendation_text?: string
          todo_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "todo_ai_recommendations_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "todos"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          created_by: string | null
          extracted_text: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          todo_id: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          extracted_text?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          todo_id: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          extracted_text?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          todo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_attachments_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "todos"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          todo_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          todo_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          todo_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_comments_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "todos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_meetings: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          todo_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          todo_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          todo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_meetings_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_meetings_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "todos"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_subtasks: {
        Row: {
          completed: boolean
          created_at: string
          created_by: string | null
          description: string
          id: string
          todo_id: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          todo_id: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          todo_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_subtasks_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "todos"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_users: {
        Row: {
          created_at: string
          id: string
          todo_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          todo_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          todo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_users_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "todos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      todos: {
        Row: {
          ai_recommendation_generated: boolean | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          priority: string | null
          status: string
        }
        Insert: {
          ai_recommendation_generated?: boolean | null
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string
        }
        Update: {
          ai_recommendation_generated?: boolean | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string
        }
        Relationships: []
      }
      uploaded_documents: {
        Row: {
          ai_generated_name: string | null
          ai_summary: string | null
          content_type: string | null
          created_at: string
          created_by: string | null
          extracted_text: string | null
          file_path: string
          file_size: number | null
          google_drive_link: string | null
          id: string
          metadata: Json | null
          original_name: string
          processed: boolean | null
          taxonomy: Json | null
        }
        Insert: {
          ai_generated_name?: string | null
          ai_summary?: string | null
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          extracted_text?: string | null
          file_path: string
          file_size?: number | null
          google_drive_link?: string | null
          id?: string
          metadata?: Json | null
          original_name: string
          processed?: boolean | null
          taxonomy?: Json | null
        }
        Update: {
          ai_generated_name?: string | null
          ai_summary?: string | null
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          extracted_text?: string | null
          file_path?: string
          file_size?: number | null
          google_drive_link?: string | null
          id?: string
          metadata?: Json | null
          original_name?: string
          processed?: boolean | null
          taxonomy?: Json | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string | null
          granted: boolean | null
          id: string
          page_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted?: boolean | null
          id?: string
          page_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted?: boolean | null
          id?: string
          page_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          approved: boolean
          created_at: string
          email: string
          id: string
          name: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          email: string
          id: string
          name: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          email?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      vacation_quotas: {
        Row: {
          created_at: string
          id: string
          quota_days: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          quota_days?: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          quota_days?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      vacations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          days_count: number
          description: string | null
          end_date: string
          id: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
          vacation_type: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days_count: number
          description?: string | null
          end_date: string
          id?: string
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
          vacation_type?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days_count?: number
          description?: string | null
          end_date?: string
          id?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
          vacation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_vacations_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      get_all_overtime_hours: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          user_id: string
          date: string
          hours: number
          description: string
          status: string
          approved_by: string
          approved_at: string
          created_at: string
          updated_at: string
          users: Json
        }[]
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      search_document_embeddings: {
        Args: {
          query_embedding: string
          filter_document_type?: string
          match_threshold?: number
          match_count?: number
          filter_document_id?: string
        }
        Returns: {
          id: string
          document_id: string
          meeting_id: string
          chunk_text: string
          chunk_index: number
          document_type: string
          metadata: Json
          similarity: number
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      store_document_with_embeddings: {
        Args: {
          p_title: string
          p_type: string
          p_content: string
          p_chunks: string[]
          p_embeddings: string[]
          p_metadata?: Json
          p_created_by?: string
          p_meeting_id?: string
          p_uploaded_document_id?: string
        }
        Returns: string
      }
      user_has_permission: {
        Args: { user_id_param: string; page_id_param: string }
        Returns: boolean
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
