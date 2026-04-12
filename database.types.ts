export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      card_delivery_queue: {
        Row: {
          connection_id: string
          created_at: string
          id: string
          last_error: string | null
          learning_card_id: string
          next_retry_at: string | null
          opened_at: string | null
          previous_delivery_id: string | null
          retry_count: number
          scheduled_at: string
          sent_at: string | null
          status: Database["public"]["Enums"]["card_delivery_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          learning_card_id: string
          next_retry_at?: string | null
          opened_at?: string | null
          previous_delivery_id?: string | null
          retry_count?: number
          scheduled_at: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["card_delivery_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          learning_card_id?: string
          next_retry_at?: string | null
          opened_at?: string | null
          previous_delivery_id?: string | null
          retry_count?: number
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["card_delivery_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_delivery_queue_connection_id_user_sns_connection_id_fk"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "user_sns_connection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_delivery_queue_learning_card_id_learning_card_id_fk"
            columns: ["learning_card_id"]
            isOneToOne: false
            referencedRelation: "learning_card"
            referencedColumns: ["id"]
          },
        ]
      }
      card_feedback: {
        Row: {
          card_opened_at: string
          card_presentation_count: number
          created_at: string
          device_info: Json | null
          feedback_score: number
          feedback_submitted_at: string
          id: string
          is_review: boolean
          learning_card_id: string
          learning_content_id: string
          learning_product_id: string
          previous_feedback_score: number | null
          push_channel: Database["public"]["Enums"]["push_channel"]
          time_spent_seconds: number | null
          user_id: string
        }
        Insert: {
          card_opened_at: string
          card_presentation_count?: number
          created_at?: string
          device_info?: Json | null
          feedback_score: number
          feedback_submitted_at: string
          id?: string
          is_review?: boolean
          learning_card_id: string
          learning_content_id: string
          learning_product_id: string
          previous_feedback_score?: number | null
          push_channel: Database["public"]["Enums"]["push_channel"]
          time_spent_seconds?: number | null
          user_id: string
        }
        Update: {
          card_opened_at?: string
          card_presentation_count?: number
          created_at?: string
          device_info?: Json | null
          feedback_score?: number
          feedback_submitted_at?: string
          id?: string
          is_review?: boolean
          learning_card_id?: string
          learning_content_id?: string
          learning_product_id?: string
          previous_feedback_score?: number | null
          push_channel?: Database["public"]["Enums"]["push_channel"]
          time_spent_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_feedback_learning_card_id_learning_card_id_fk"
            columns: ["learning_card_id"]
            isOneToOne: false
            referencedRelation: "learning_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_feedback_learning_content_id_learning_content_id_fk"
            columns: ["learning_content_id"]
            isOneToOne: false
            referencedRelation: "learning_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_feedback_learning_product_id_learning_product_id_fk"
            columns: ["learning_product_id"]
            isOneToOne: false
            referencedRelation: "learning_product"
            referencedColumns: ["id"]
          },
        ]
      }
      card_schedule: {
        Row: {
          created_at: string
          delivery_status: Database["public"]["Enums"]["delivery_status"]
          error_message: string | null
          id: string
          learning_card_id: string
          learning_content_id: string
          learning_product_id: string
          previous_schedule_id: string | null
          scheduled_at: string
          sent_at: string | null
          updated_at: string
          user_id: string
          user_sns_connection_id: string
        }
        Insert: {
          created_at?: string
          delivery_status?: Database["public"]["Enums"]["delivery_status"]
          error_message?: string | null
          id?: string
          learning_card_id: string
          learning_content_id: string
          learning_product_id: string
          previous_schedule_id?: string | null
          scheduled_at: string
          sent_at?: string | null
          updated_at?: string
          user_id: string
          user_sns_connection_id: string
        }
        Update: {
          created_at?: string
          delivery_status?: Database["public"]["Enums"]["delivery_status"]
          error_message?: string | null
          id?: string
          learning_card_id?: string
          learning_content_id?: string
          learning_product_id?: string
          previous_schedule_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          updated_at?: string
          user_id?: string
          user_sns_connection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_schedule_learning_card_id_learning_card_id_fk"
            columns: ["learning_card_id"]
            isOneToOne: false
            referencedRelation: "learning_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_schedule_learning_content_id_learning_content_id_fk"
            columns: ["learning_content_id"]
            isOneToOne: false
            referencedRelation: "learning_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_schedule_learning_product_id_learning_product_id_fk"
            columns: ["learning_product_id"]
            isOneToOne: false
            referencedRelation: "learning_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_schedule_previous_schedule_id_card_schedule_id_fk"
            columns: ["previous_schedule_id"]
            isOneToOne: false
            referencedRelation: "card_schedule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_schedule_user_sns_connection_id_user_sns_connection_id_fk"
            columns: ["user_sns_connection_id"]
            isOneToOne: false
            referencedRelation: "user_sns_connection"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_card: {
        Row: {
          card_data: Json
          card_scope: Database["public"]["Enums"]["card_scope"]
          card_type: Database["public"]["Enums"]["card_type"]
          created_at: string
          display_order: number
          error_message: string | null
          id: string
          is_active: boolean
          is_valid: boolean
          learning_content_id: string
          updated_at: string
        }
        Insert: {
          card_data: Json
          card_scope?: Database["public"]["Enums"]["card_scope"]
          card_type: Database["public"]["Enums"]["card_type"]
          created_at?: string
          display_order?: number
          error_message?: string | null
          id?: string
          is_active?: boolean
          is_valid?: boolean
          learning_content_id: string
          updated_at?: string
        }
        Update: {
          card_data?: Json
          card_scope?: Database["public"]["Enums"]["card_scope"]
          card_type?: Database["public"]["Enums"]["card_type"]
          created_at?: string
          display_order?: number
          error_message?: string | null
          id?: string
          is_active?: boolean
          is_valid?: boolean
          learning_content_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_card_learning_content_id_learning_content_id_fk"
            columns: ["learning_content_id"]
            isOneToOne: false
            referencedRelation: "learning_content"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_content: {
        Row: {
          content_name: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          learning_product_id: string
          updated_at: string
        }
        Insert: {
          content_name: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          learning_product_id: string
          updated_at?: string
        }
        Update: {
          content_name?: string
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          learning_product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_content_learning_product_id_learning_product_id_fk"
            columns: ["learning_product_id"]
            isOneToOne: false
            referencedRelation: "learning_product"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_content_progress: {
        Row: {
          created_at: string
          current_card_index: number
          easiness: number
          interval: number
          iteration: number
          last_review_at: string | null
          learning_content_id: string
          next_review_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_card_index?: number
          easiness?: number
          interval?: number
          iteration?: number
          last_review_at?: string | null
          learning_content_id: string
          next_review_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_card_index?: number
          easiness?: number
          interval?: number
          iteration?: number
          last_review_at?: string | null
          learning_content_id?: string
          next_review_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_content_progress_learning_content_id_learning_content_"
            columns: ["learning_content_id"]
            isOneToOne: false
            referencedRelation: "learning_content"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_product: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      lite_card_deliveries: {
        Row: {
          card_id: string
          created_at: string
          delivery_id: string
          last_error: string | null
          learning_product_id: string
          next_retry_at: string | null
          opened_at: string | null
          previous_delivery_id: string | null
          retry_count: number
          scheduled_at: string
          sent_at: string | null
          sns_id: string
          sns_type: string
          status: Database["public"]["Enums"]["lite_card_delivery_status"]
          updated_at: string
        }
        Insert: {
          card_id: string
          created_at?: string
          delivery_id?: string
          last_error?: string | null
          learning_product_id: string
          next_retry_at?: string | null
          opened_at?: string | null
          previous_delivery_id?: string | null
          retry_count?: number
          scheduled_at: string
          sent_at?: string | null
          sns_id: string
          sns_type: string
          status?: Database["public"]["Enums"]["lite_card_delivery_status"]
          updated_at?: string
        }
        Update: {
          card_id?: string
          created_at?: string
          delivery_id?: string
          last_error?: string | null
          learning_product_id?: string
          next_retry_at?: string | null
          opened_at?: string | null
          previous_delivery_id?: string | null
          retry_count?: number
          scheduled_at?: string
          sent_at?: string | null
          sns_id?: string
          sns_type?: string
          status?: Database["public"]["Enums"]["lite_card_delivery_status"]
          updated_at?: string
        }
        Relationships: []
      }
      lite_content_progress: {
        Row: {
          completed_cards_count: number
          created_at: string
          current_content_id: string | null
          last_card_id: string | null
          last_feedback_score: number | null
          learning_product_id: string
          progress_id: number
          sns_id: string
          sns_type: Database["public"]["Enums"]["sns_type"]
          total_cards_count: number
          updated_at: string
        }
        Insert: {
          completed_cards_count?: number
          created_at?: string
          current_content_id?: string | null
          last_card_id?: string | null
          last_feedback_score?: number | null
          learning_product_id: string
          progress_id?: never
          sns_id: string
          sns_type: Database["public"]["Enums"]["sns_type"]
          total_cards_count?: number
          updated_at?: string
        }
        Update: {
          completed_cards_count?: number
          created_at?: string
          current_content_id?: string | null
          last_card_id?: string | null
          last_feedback_score?: number | null
          learning_product_id?: string
          progress_id?: never
          sns_id?: string
          sns_type?: Database["public"]["Enums"]["sns_type"]
          total_cards_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lite_content_progress_sns_type_sns_id_lite_profiles_sns_type_sn"
            columns: ["sns_type", "sns_id"]
            isOneToOne: false
            referencedRelation: "lite_profiles"
            referencedColumns: ["sns_type", "sns_id"]
          },
        ]
      }
      lite_profiles: {
        Row: {
          created_at: string
          sns_id: string
          sns_type: Database["public"]["Enums"]["sns_type"]
          subscription_status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          sns_id: string
          sns_type: Database["public"]["Enums"]["sns_type"]
          subscription_status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          sns_id?: string
          sns_type?: Database["public"]["Enums"]["sns_type"]
          subscription_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      nv2_cards: {
        Row: {
          card_data: Json
          card_type: Database["public"]["Enums"]["nv2_card_type"]
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          stage_id: string
          updated_at: string
        }
        Insert: {
          card_data: Json
          card_type: Database["public"]["Enums"]["nv2_card_type"]
          created_at?: string
          display_order: number
          id?: string
          is_active?: boolean
          stage_id: string
          updated_at?: string
        }
        Update: {
          card_data?: Json
          card_type?: Database["public"]["Enums"]["nv2_card_type"]
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nv2_cards_stage_id_nv2_stages_id_fk"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "nv2_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      nv2_chat_turns: {
        Row: {
          auth_user_id: string
          content: string
          created_at: string
          id: string
          message_type: Database["public"]["Enums"]["nv2_chat_message_type"]
          role: Database["public"]["Enums"]["nv2_chat_role"]
          session_id: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          content: string
          created_at?: string
          id?: string
          message_type?: Database["public"]["Enums"]["nv2_chat_message_type"]
          role: Database["public"]["Enums"]["nv2_chat_role"]
          session_id?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          content?: string
          created_at?: string
          id?: string
          message_type?: Database["public"]["Enums"]["nv2_chat_message_type"]
          role?: Database["public"]["Enums"]["nv2_chat_role"]
          session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nv2_chat_turns_session_id_nv2_sessions_session_id_fk"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "nv2_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
      nv2_learning_products: {
        Row: {
          category: Database["public"]["Enums"]["nv2_product_category"]
          created_at: string
          description: string | null
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          meta: Json | null
          name: string
          slug: string
          total_stages: number
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["nv2_product_category"]
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          meta?: Json | null
          name: string
          slug: string
          total_stages?: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["nv2_product_category"]
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          meta?: Json | null
          name?: string
          slug?: string
          total_stages?: number
          updated_at?: string
        }
        Relationships: []
      }
      nv2_product_session_stages: {
        Row: {
          created_at: string
          display_order: number
          id: number
          product_session_id: string
          stage_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order: number
          id?: number
          product_session_id: string
          stage_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: number
          product_session_id?: string
          stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nv2_product_session_stages_product_session_id_nv2_product_sessi"
            columns: ["product_session_id"]
            isOneToOne: false
            referencedRelation: "nv2_product_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nv2_product_session_stages_stage_id_nv2_stages_id_fk"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "nv2_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      nv2_product_sessions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          product_id: string
          session_number: number
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          product_id: string
          session_number: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          product_id?: string
          session_number?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nv2_product_sessions_product_id_nv2_learning_products_id_fk"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "nv2_learning_products"
            referencedColumns: ["id"]
          },
        ]
      }
      nv2_profiles: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          daily_goal_new: number
          daily_goal_review: number
          display_name: string | null
          is_active: boolean
          send_hour: number
          sns_id: string
          sns_type: Database["public"]["Enums"]["nv2_sns_type"]
          timezone: string
          today_new_count: number
          today_review_count: number
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          daily_goal_new?: number
          daily_goal_review?: number
          display_name?: string | null
          is_active?: boolean
          send_hour?: number
          sns_id: string
          sns_type: Database["public"]["Enums"]["nv2_sns_type"]
          timezone?: string
          today_new_count?: number
          today_review_count?: number
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          daily_goal_new?: number
          daily_goal_review?: number
          display_name?: string | null
          is_active?: boolean
          send_hour?: number
          sns_id?: string
          sns_type?: Database["public"]["Enums"]["nv2_sns_type"]
          timezone?: string
          today_new_count?: number
          today_review_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      nv2_quiz_results: {
        Row: {
          completed_at: string | null
          covered_stage_ids: string[]
          created_at: string
          matched_pairs_count: number
          quiz_result_id: number
          quiz_type: Database["public"]["Enums"]["nv2_quiz_type"]
          result_snapshot: Json | null
          sns_id: string
          sns_type: string
          started_at: string
          trigger_at_count: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          covered_stage_ids: string[]
          created_at?: string
          matched_pairs_count?: number
          quiz_result_id?: number
          quiz_type: Database["public"]["Enums"]["nv2_quiz_type"]
          result_snapshot?: Json | null
          sns_id: string
          sns_type: string
          started_at?: string
          trigger_at_count: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          covered_stage_ids?: string[]
          created_at?: string
          matched_pairs_count?: number
          quiz_result_id?: number
          quiz_type?: Database["public"]["Enums"]["nv2_quiz_type"]
          result_snapshot?: Json | null
          sns_id?: string
          sns_type?: string
          started_at?: string
          trigger_at_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      nv2_schedules: {
        Row: {
          created_at: string
          delivery_url: string
          error_message: string | null
          max_retries: number
          message_body: string | null
          opened_at: string | null
          parent_schedule_id: number | null
          retry_count: number
          review_round: number | null
          schedule_id: number
          schedule_type: Database["public"]["Enums"]["nv2_schedule_type"]
          scheduled_at: string
          sent_at: string | null
          sns_id: string
          sns_type: string
          stage_id: string | null
          status: Database["public"]["Enums"]["nv2_schedule_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_url: string
          error_message?: string | null
          max_retries?: number
          message_body?: string | null
          opened_at?: string | null
          parent_schedule_id?: number | null
          retry_count?: number
          review_round?: number | null
          schedule_id?: number
          schedule_type: Database["public"]["Enums"]["nv2_schedule_type"]
          scheduled_at: string
          sent_at?: string | null
          sns_id: string
          sns_type: string
          stage_id?: string | null
          status?: Database["public"]["Enums"]["nv2_schedule_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_url?: string
          error_message?: string | null
          max_retries?: number
          message_body?: string | null
          opened_at?: string | null
          parent_schedule_id?: number | null
          retry_count?: number
          review_round?: number | null
          schedule_id?: number
          schedule_type?: Database["public"]["Enums"]["nv2_schedule_type"]
          scheduled_at?: string
          sent_at?: string | null
          sns_id?: string
          sns_type?: string
          stage_id?: string | null
          status?: Database["public"]["Enums"]["nv2_schedule_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nv2_schedules_parent_schedule_id_nv2_schedules_schedule_id_fk"
            columns: ["parent_schedule_id"]
            isOneToOne: false
            referencedRelation: "nv2_schedules"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "nv2_schedules_stage_id_nv2_stages_id_fk"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "nv2_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      nv2_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          dm_sent_at: string | null
          product_session_id: string
          review_round: number | null
          session_id: string
          session_kind: Database["public"]["Enums"]["nv2_session_kind"]
          sns_id: string
          sns_type: string
          started_at: string | null
          status: Database["public"]["Enums"]["nv2_session_status"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          dm_sent_at?: string | null
          product_session_id: string
          review_round?: number | null
          session_id?: string
          session_kind?: Database["public"]["Enums"]["nv2_session_kind"]
          sns_id: string
          sns_type: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["nv2_session_status"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          dm_sent_at?: string | null
          product_session_id?: string
          review_round?: number | null
          session_id?: string
          session_kind?: Database["public"]["Enums"]["nv2_session_kind"]
          sns_id?: string
          sns_type?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["nv2_session_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nv2_sessions_product_session_id_nv2_product_sessions_id_fk"
            columns: ["product_session_id"]
            isOneToOne: false
            referencedRelation: "nv2_product_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      nv2_stage_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          last_review_completed_at: string | null
          next_review_at: string | null
          progress_id: number
          retry_count: number
          review_round: number | null
          review_status: Database["public"]["Enums"]["nv2_review_status"]
          sns_id: string
          sns_type: string
          stage_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          last_review_completed_at?: string | null
          next_review_at?: string | null
          progress_id?: number
          retry_count?: number
          review_round?: number | null
          review_status?: Database["public"]["Enums"]["nv2_review_status"]
          sns_id: string
          sns_type: string
          stage_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          last_review_completed_at?: string | null
          next_review_at?: string | null
          progress_id?: number
          retry_count?: number
          review_round?: number | null
          review_status?: Database["public"]["Enums"]["nv2_review_status"]
          sns_id?: string
          sns_type?: string
          stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nv2_stage_progress_stage_id_nv2_stages_id_fk"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "nv2_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      nv2_stages: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          learning_product_id: string
          stage_number: number
          stage_type: Database["public"]["Enums"]["nv2_stage_type"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          learning_product_id: string
          stage_number: number
          stage_type?: Database["public"]["Enums"]["nv2_stage_type"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          learning_product_id?: string
          stage_number?: number
          stage_type?: Database["public"]["Enums"]["nv2_stage_type"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      nv2_subscriptions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          link_access: Database["public"]["Enums"]["nv2_link_access_type"]
          product_id: string
          sns_id: string
          sns_type: string
          started_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          link_access?: Database["public"]["Enums"]["nv2_link_access_type"]
          product_id: string
          sns_id: string
          sns_type: string
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          link_access?: Database["public"]["Enums"]["nv2_link_access_type"]
          product_id?: string
          sns_id?: string
          sns_type?: string
          started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nv2_subscriptions_product_id_nv2_learning_products_id_fk"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "nv2_learning_products"
            referencedColumns: ["id"]
          },
        ]
      }
      nv2_turn_balance: {
        Row: {
          auth_user_id: string
          charged_turns: number
          created_at: string
          id: string
          subscription_reset_at: string | null
          subscription_turns: number
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          charged_turns?: number
          created_at?: string
          id?: string
          subscription_reset_at?: string | null
          subscription_turns?: number
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          charged_turns?: number
          created_at?: string
          id?: string
          subscription_reset_at?: string | null
          subscription_turns?: number
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          approved_at: string
          created_at: string
          metadata: Json
          order_id: string
          order_name: string
          payment_id: number
          payment_key: string
          raw_data: Json
          receipt_url: string
          requested_at: string
          status: string
          total_amount: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          approved_at: string
          created_at?: string
          metadata: Json
          order_id: string
          order_name: string
          payment_id?: never
          payment_key: string
          raw_data: Json
          receipt_url: string
          requested_at: string
          status: string
          total_amount: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          approved_at?: string
          created_at?: string
          metadata?: Json
          order_id?: string
          order_name?: string
          payment_id?: never
          payment_key?: string
          raw_data?: Json
          receipt_url?: string
          requested_at?: string
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          marketing_consent: boolean
          name: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          marketing_consent?: boolean
          name: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          marketing_consent?: boolean
          name?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_learning_content_progress: {
        Row: {
          created_at: string
          id: string
          last_feedback_score: number | null
          last_studied_at: string | null
          learning_content_id: string
          learning_product_id: string
          study_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_feedback_score?: number | null
          last_studied_at?: string | null
          learning_content_id: string
          learning_product_id: string
          study_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_feedback_score?: number | null
          last_studied_at?: string | null
          learning_content_id?: string
          learning_product_id?: string
          study_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_learning_content_progress_learning_content_id_learning_con"
            columns: ["learning_content_id"]
            isOneToOne: false
            referencedRelation: "learning_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_learning_content_progress_learning_product_id_learning_pro"
            columns: ["learning_product_id"]
            isOneToOne: false
            referencedRelation: "learning_product"
            referencedColumns: ["id"]
          },
        ]
      }
      user_product_subscription: {
        Row: {
          created_at: string
          daily_goal: number
          dispatch_delay_seconds: number
          id: string
          is_active: boolean
          last_card_sent_at: string | null
          learning_product_id: string
          memory_percentage: number
          preferred_push_time: string | null
          push_enabled: boolean
          subscribed_at: string
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          unsubscribed_at: string | null
          updated_at: string
          user_id: string
          user_sns_connection_id: string
        }
        Insert: {
          created_at?: string
          daily_goal?: number
          dispatch_delay_seconds?: number
          id?: string
          is_active?: boolean
          last_card_sent_at?: string | null
          learning_product_id: string
          memory_percentage?: number
          preferred_push_time?: string | null
          push_enabled?: boolean
          subscribed_at?: string
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          unsubscribed_at?: string | null
          updated_at?: string
          user_id: string
          user_sns_connection_id: string
        }
        Update: {
          created_at?: string
          daily_goal?: number
          dispatch_delay_seconds?: number
          id?: string
          is_active?: boolean
          last_card_sent_at?: string | null
          learning_product_id?: string
          memory_percentage?: number
          preferred_push_time?: string | null
          push_enabled?: boolean
          subscribed_at?: string
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          unsubscribed_at?: string | null
          updated_at?: string
          user_id?: string
          user_sns_connection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_product_subscription_learning_product_id_learning_product_"
            columns: ["learning_product_id"]
            isOneToOne: false
            referencedRelation: "learning_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_product_subscription_user_sns_connection_id_user_sns_conne"
            columns: ["user_sns_connection_id"]
            isOneToOne: false
            referencedRelation: "user_sns_connection"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sns_connection: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_primary: boolean
          push_enabled: boolean
          sns_identifier: string
          sns_type: Database["public"]["Enums"]["sns_type"]
          token_expires_at: string | null
          updated_at: string
          user_id: string
          verification_token: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          push_enabled?: boolean
          sns_identifier: string
          sns_type: Database["public"]["Enums"]["sns_type"]
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
          verification_token?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          push_enabled?: boolean
          sns_identifier?: string
          sns_type?: Database["public"]["Enums"]["sns_type"]
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
          verification_token?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      card_delivery_status:
        | "pending"
        | "sent"
        | "retry_required"
        | "failed"
        | "cancelled"
        | "opened"
        | "feedback_received"
      card_scope: "shared" | "personalized"
      card_type:
        | "basic_meaning"
        | "pronunciation"
        | "etymology"
        | "cloze"
        | "contrast"
        | "cultural_context"
        | "example"
        | "derivatives"
        | "idiom"
        | "pos_specific"
      content_type: "word" | "sentence" | "formula"
      delivery_status:
        | "pending"
        | "sent"
        | "failed"
        | "opened"
        | "feedback_received"
      lite_card_delivery_status:
        | "pending"
        | "sent"
        | "retry_required"
        | "failed"
        | "cancelled"
        | "opened"
        | "feedback_received"
      nv2_card_type:
        | "title"
        | "description"
        | "image"
        | "etymology"
        | "example"
        | "option"
      nv2_chat_message_type:
        | "text"
        | "card"
        | "quiz"
        | "writing_prompt"
        | "dictation"
        | "feedback"
      nv2_chat_role: "leni" | "user"
      nv2_link_access_type: "public" | "members_only"
      nv2_product_category:
        | "language"
        | "medical"
        | "exam"
        | "business"
        | "general"
      nv2_quiz_type: "quiz_5" | "quiz_10"
      nv2_review_status:
        | "none"
        | "r1_pending"
        | "r2_pending"
        | "r3_pending"
        | "r4_pending"
        | "mastered"
      nv2_schedule_status: "pending" | "sent" | "failed" | "opened"
      nv2_schedule_type: "new" | "review" | "cheer" | "welcome"
      nv2_session_kind: "new" | "review"
      nv2_session_status: "pending" | "in_progress" | "completed"
      nv2_sns_type: "discord" | "kakao" | "telegram" | "email"
      nv2_stage_type:
        | "welcome"
        | "learning"
        | "quiz_5"
        | "quiz_10"
        | "quiz_current_session"
        | "quiz_current_and_prev_session"
        | "quiz_daily"
        | "quiz_final"
        | "congratulations"
        | "sentence_practice"
        | "dictation"
        | "writing"
      push_channel: "discord" | "kakao" | "email" | "telegram"
      sns_type: "discord" | "kakao" | "email" | "telegram"
      subscription_tier: "basic" | "premium" | "vip"
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
    Enums: {
      card_delivery_status: [
        "pending",
        "sent",
        "retry_required",
        "failed",
        "cancelled",
        "opened",
        "feedback_received",
      ],
      card_scope: ["shared", "personalized"],
      card_type: [
        "basic_meaning",
        "pronunciation",
        "etymology",
        "cloze",
        "contrast",
        "cultural_context",
        "example",
        "derivatives",
        "idiom",
        "pos_specific",
      ],
      content_type: ["word", "sentence", "formula"],
      delivery_status: [
        "pending",
        "sent",
        "failed",
        "opened",
        "feedback_received",
      ],
      lite_card_delivery_status: [
        "pending",
        "sent",
        "retry_required",
        "failed",
        "cancelled",
        "opened",
        "feedback_received",
      ],
      nv2_card_type: [
        "title",
        "description",
        "image",
        "etymology",
        "example",
        "option",
      ],
      nv2_chat_message_type: [
        "text",
        "card",
        "quiz",
        "writing_prompt",
        "dictation",
        "feedback",
      ],
      nv2_chat_role: ["leni", "user"],
      nv2_link_access_type: ["public", "members_only"],
      nv2_product_category: [
        "language",
        "medical",
        "exam",
        "business",
        "general",
      ],
      nv2_quiz_type: ["quiz_5", "quiz_10"],
      nv2_review_status: [
        "none",
        "r1_pending",
        "r2_pending",
        "r3_pending",
        "r4_pending",
        "mastered",
      ],
      nv2_schedule_status: ["pending", "sent", "failed", "opened"],
      nv2_schedule_type: ["new", "review", "cheer", "welcome"],
      nv2_session_kind: ["new", "review"],
      nv2_session_status: ["pending", "in_progress", "completed"],
      nv2_sns_type: ["discord", "kakao", "telegram", "email"],
      nv2_stage_type: [
        "welcome",
        "learning",
        "quiz_5",
        "quiz_10",
        "quiz_current_session",
        "quiz_current_and_prev_session",
        "quiz_daily",
        "quiz_final",
        "congratulations",
        "sentence_practice",
        "dictation",
        "writing",
      ],
      push_channel: ["discord", "kakao", "email", "telegram"],
      sns_type: ["discord", "kakao", "email", "telegram"],
      subscription_tier: ["basic", "premium", "vip"],
    },
  },
} as const
