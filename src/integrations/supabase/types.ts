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
      accounts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      budget_group_snapshots: {
        Row: {
          created_at: string
          groups: Json
          id: string
          month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          groups?: Json
          id?: string
          month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          groups?: Json
          id?: string
          month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      budget_groups: {
        Row: {
          amount: number
          category_ids: string[]
          created_at: string
          id: string
          kind: string
          name: string
          period: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category_ids?: string[]
          created_at?: string
          id?: string
          kind?: string
          name: string
          period?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_ids?: string[]
          created_at?: string
          id?: string
          kind?: string
          name?: string
          period?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          id: string
          is_active: boolean
          period: string
          scope: string
          starts_on: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          period?: string
          scope?: string
          starts_on?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          period?: string
          scope?: string
          starts_on?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          behaviour: string | null
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          slug: string | null
          sort_order: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          behaviour?: string | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          slug?: string | null
          sort_order?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          behaviour?: string | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string | null
          sort_order?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      imports: {
        Row: {
          committed_at: string | null
          created_at: string
          duplicate_rows: number | null
          filename: string | null
          id: string
          imported_rows: number | null
          invalid_rows: number | null
          new_rows: number | null
          preview_token: string | null
          status: string | null
          total_rows: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          committed_at?: string | null
          created_at?: string
          duplicate_rows?: number | null
          filename?: string | null
          id?: string
          imported_rows?: number | null
          invalid_rows?: number | null
          new_rows?: number | null
          preview_token?: string | null
          status?: string | null
          total_rows?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          committed_at?: string | null
          created_at?: string
          duplicate_rows?: number | null
          filename?: string | null
          id?: string
          imported_rows?: number | null
          invalid_rows?: number | null
          new_rows?: number | null
          preview_token?: string | null
          status?: string | null
          total_rows?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      merchant_rules: {
        Row: {
          behaviour: string | null
          category_id: string | null
          created_at: string
          id: string
          is_active: boolean
          pattern: string
          updated_at: string
          user_id: string
        }
        Insert: {
          behaviour?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          pattern: string
          updated_at?: string
          user_id: string
        }
        Update: {
          behaviour?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          pattern?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          currency: string
          defaults_seeded_at: string | null
          defaults_source_user_id: string | null
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          defaults_seeded_at?: string | null
          defaults_source_user_id?: string | null
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          defaults_seeded_at?: string | null
          defaults_source_user_id?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          body: string | null
          category_id: string | null
          created_at: string
          dismissed: boolean
          id: string
          score_delta: number | null
          title: string
          tone: string | null
          updated_at: string
          user_id: string
          valid_for: string | null
        }
        Insert: {
          body?: string | null
          category_id?: string | null
          created_at?: string
          dismissed?: boolean
          id?: string
          score_delta?: number | null
          title: string
          tone?: string | null
          updated_at?: string
          user_id: string
          valid_for?: string | null
        }
        Update: {
          body?: string | null
          category_id?: string | null
          created_at?: string
          dismissed?: boolean
          id?: string
          score_delta?: number | null
          title?: string
          tone?: string | null
          updated_at?: string
          user_id?: string
          valid_for?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          amount: number | null
          category_id: string | null
          created_at: string
          detail: string | null
          due_on: string | null
          id: string
          recurrence: string | null
          snoozed_until: string | null
          state: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          category_id?: string | null
          created_at?: string
          detail?: string | null
          due_on?: string | null
          id?: string
          recurrence?: string | null
          snoozed_until?: string | null
          state?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          category_id?: string | null
          created_at?: string
          detail?: string | null
          due_on?: string | null
          id?: string
          recurrence?: string | null
          snoozed_until?: string | null
          state?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          behaviour: string | null
          category_id: string | null
          created_at: string
          description: string
          direction: string
          external_hash: string | null
          id: string
          import_id: string | null
          is_transfer: boolean | null
          merchant: string | null
          needs_review: boolean
          notes: string | null
          occurred_on: string
          source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          behaviour?: string | null
          category_id?: string | null
          created_at?: string
          description: string
          direction: string
          external_hash?: string | null
          id?: string
          import_id?: string | null
          is_transfer?: boolean | null
          merchant?: string | null
          needs_review?: boolean
          notes?: string | null
          occurred_on: string
          source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          behaviour?: string | null
          category_id?: string | null
          created_at?: string
          description?: string
          direction?: string
          external_hash?: string | null
          id?: string
          import_id?: string | null
          is_transfer?: boolean | null
          merchant?: string | null
          needs_review?: boolean
          notes?: string | null
          occurred_on?: string
          source?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reviews: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          score: number | null
          state: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          score?: number | null
          state?: string
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          score?: number | null
          state?: string
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      seed_user_default_setup: {
        Args: { _user_id: string }
        Returns: undefined
      }
      slugify_default_label: { Args: { _value: string }; Returns: string }
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
