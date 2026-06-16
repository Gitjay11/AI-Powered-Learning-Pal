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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          created_at: string
          event: string
          id: string
          props: Json
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          event: string
          id?: string
          props?: Json
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          event?: string
          id?: string
          props?: Json
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          lesson_id: string | null
          role: string
          student_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          role: string
          student_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          role?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      flags: {
        Row: {
          concept: string
          created_at: string
          id: string
          lesson_id: string | null
          reason: string
          resolution: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          student_id: string
        }
        Insert: {
          concept: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          reason: string
          resolution?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          student_id: string
        }
        Update: {
          concept?: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          reason?: string
          resolution?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flags_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_logs: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          related_flag_id: string | null
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          related_flag_id?: string | null
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          related_flag_id?: string | null
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_logs_related_flag_id_fkey"
            columns: ["related_flag_id"]
            isOneToOne: false
            referencedRelation: "flags"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          concept_tags: string[]
          content: string
          created_at: string
          id: string
          order_index: number
          title: string
          track_id: string
        }
        Insert: {
          concept_tags?: string[]
          content: string
          created_at?: string
          id?: string
          order_index: number
          title: string
          track_id: string
        }
        Update: {
          concept_tags?: string[]
          content?: string
          created_at?: string
          id?: string
          order_index?: number
          title?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_active_at: string | null
          selected_track_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          last_active_at?: string | null
          selected_track_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_active_at?: string | null
          selected_track_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_selected_track_id_fkey"
            columns: ["selected_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_history: {
        Row: {
          action: string
          context: Json
          followed_at: string | null
          id: string
          reason: string | null
          served_at: string
          source: string
          student_id: string
        }
        Insert: {
          action: string
          context?: Json
          followed_at?: string | null
          id?: string
          reason?: string | null
          served_at?: string
          source?: string
          student_id: string
        }
        Update: {
          action?: string
          context?: Json
          followed_at?: string | null
          id?: string
          reason?: string | null
          served_at?: string
          source?: string
          student_id?: string
        }
        Relationships: []
      }
      risk_scores: {
        Row: {
          computed_at: string
          created_at: string
          id: string
          level: string
          reasons: Json
          score: number
          signals: Json
          student_id: string
          updated_at: string
        }
        Insert: {
          computed_at?: string
          created_at?: string
          id?: string
          level?: string
          reasons?: Json
          score?: number
          signals?: Json
          student_id: string
          updated_at?: string
        }
        Update: {
          computed_at?: string
          created_at?: string
          id?: string
          level?: string
          reasons?: Json
          score?: number
          signals?: Json
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_progress: {
        Row: {
          attempts: number
          id: string
          last_attempted_at: string
          lesson_id: string
          score: number
          status: string
          student_id: string
        }
        Insert: {
          attempts?: number
          id?: string
          last_attempted_at?: string
          lesson_id: string
          score?: number
          status?: string
          student_id: string
        }
        Update: {
          attempts?: number
          id?: string
          last_attempted_at?: string
          lesson_id?: string
          score?: number
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          student_id: string
          teacher_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: []
      }
      topic_mastery: {
        Row: {
          attempts: number
          concept: string
          correct: number
          created_at: string
          id: string
          last_seen_at: string
          mastery_score: number
          student_id: string
          track_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          concept: string
          correct?: number
          created_at?: string
          id?: string
          last_seen_at?: string
          mastery_score?: number
          student_id: string
          track_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          concept?: string
          correct?: number
          created_at?: string
          id?: string
          last_seen_at?: string
          mastery_score?: number
          student_id?: string
          track_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_mastery_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          slug: string
          title: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          slug: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          slug?: string
          title?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "teacher"
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
      app_role: ["student", "teacher"],
    },
  },
} as const
