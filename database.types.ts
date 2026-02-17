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
      push_channel: ["discord", "kakao", "email", "telegram"],
      sns_type: ["discord", "kakao", "email", "telegram"],
      subscription_tier: ["basic", "premium", "vip"],
    },
  },
} as const
