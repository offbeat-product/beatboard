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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_chat_logs: {
        Row: {
          created_at: string
          id: string
          message: string
          org_id: string
          response: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          org_id: string
          response?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          org_id?: string
          response?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_reports: {
        Row: {
          content_json: Json | null
          created_at: string
          generated_at: string
          id: string
          org_id: string
          report_type: string
        }
        Insert: {
          content_json?: Json | null
          created_at?: string
          generated_at?: string
          id?: string
          org_id: string
          report_type: string
        }
        Update: {
          content_json?: Json | null
          created_at?: string
          generated_at?: string
          id?: string
          org_id?: string
          report_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          contract_start: string | null
          created_at: string
          id: string
          monthly_fee: number
          name: string
          org_id: string
          plan_type: string
          status: string
        }
        Insert: {
          contract_start?: string | null
          created_at?: string
          id?: string
          monthly_fee?: number
          name: string
          org_id: string
          plan_type: string
          status?: string
        }
        Update: {
          contract_start?: string | null
          created_at?: string
          id?: string
          monthly_fee?: number
          name?: string
          org_id?: string
          plan_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_worklogs: {
        Row: {
          created_at: string
          date: string
          hours: number
          id: string
          member_id: string | null
          org_id: string
          project_id: string | null
        }
        Insert: {
          created_at?: string
          date: string
          hours?: number
          id?: string
          member_id?: string | null
          org_id: string
          project_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          hours?: number
          id?: string
          member_id?: string | null
          org_id?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_worklogs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_worklogs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_worklogs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_snapshots: {
        Row: {
          actual_value: number
          created_at: string
          id: string
          metric_name: string
          org_id: string
          snapshot_date: string
        }
        Insert: {
          actual_value: number
          created_at?: string
          id?: string
          metric_name: string
          org_id: string
          snapshot_date: string
        }
        Update: {
          actual_value?: number
          created_at?: string
          id?: string
          metric_name?: string
          org_id?: string
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string
          hourly_rate: number | null
          id: string
          name: string
          org_id: string
          role: string
          status: string
        }
        Insert: {
          created_at?: string
          hourly_rate?: number | null
          id?: string
          name: string
          org_id: string
          role: string
          status?: string
        }
        Update: {
          created_at?: string
          hourly_rate?: number | null
          id?: string
          name?: string
          org_id?: string
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_sales: {
        Row: {
          client_id: string | null
          cost: number
          created_at: string
          gross_profit: number
          id: string
          org_id: string
          revenue: number
          year_month: string
        }
        Insert: {
          client_id?: string | null
          cost?: number
          created_at?: string
          gross_profit?: number
          id?: string
          org_id: string
          revenue?: number
          year_month: string
        }
        Update: {
          client_id?: string | null
          cost?: number
          created_at?: string
          gross_profit?: number
          id?: string
          org_id?: string
          revenue?: number
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_sales_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          settings_json: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          settings_json?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          settings_json?: Json | null
        }
        Relationships: []
      }
      pl_records: {
        Row: {
          account_name: string
          amount: number
          created_at: string
          id: string
          org_id: string
          year_month: string
        }
        Insert: {
          account_name: string
          amount?: number
          created_at?: string
          id?: string
          org_id: string
          year_month: string
        }
        Update: {
          account_name?: string
          amount?: number
          created_at?: string
          id?: string
          org_id?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "pl_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          name: string
          org_id: string
          status: string
          type: string
          unit_price: number | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          name: string
          org_id: string
          status?: string
          type: string
          unit_price?: number | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          status?: string
          type?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_records: {
        Row: {
          created_at: string
          first_pass_rate: number
          id: string
          org_id: string
          project_id: string | null
          revision_count: number
          year_month: string
        }
        Insert: {
          created_at?: string
          first_pass_rate?: number
          id?: string
          org_id: string
          project_id?: string | null
          revision_count?: number
          year_month: string
        }
        Update: {
          created_at?: string
          first_pass_rate?: number
          id?: string
          org_id?: string
          project_id?: string | null
          revision_count?: number
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      targets: {
        Row: {
          created_at: string
          id: string
          metric_name: string
          org_id: string
          target_value: number
          year_month: string
        }
        Insert: {
          created_at?: string
          id?: string
          metric_name: string
          org_id: string
          target_value: number
          year_month: string
        }
        Update: {
          created_at?: string
          id?: string
          metric_name?: string
          org_id?: string
          target_value?: number
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "targets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
