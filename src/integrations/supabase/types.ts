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
      alert_settings: {
        Row: {
          created_at: string | null
          danger_value: number | null
          id: string
          metric_key: string
          org_id: string
          updated_at: string | null
          warn_value: number | null
        }
        Insert: {
          created_at?: string | null
          danger_value?: number | null
          id?: string
          metric_key: string
          org_id: string
          updated_at?: string | null
          warn_value?: number | null
        }
        Update: {
          created_at?: string | null
          danger_value?: number | null
          id?: string
          metric_key?: string
          org_id?: string
          updated_at?: string | null
          warn_value?: number | null
        }
        Relationships: []
      }
      client_monthly_hours: {
        Row: {
          client_id: string
          client_name: string
          created_at: string | null
          hours: number | null
          id: string
          org_id: string
          year_month: string
        }
        Insert: {
          client_id: string
          client_name: string
          created_at?: string | null
          hours?: number | null
          id?: string
          org_id: string
          year_month: string
        }
        Update: {
          client_id?: string
          client_name?: string
          created_at?: string | null
          hours?: number | null
          id?: string
          org_id?: string
          year_month?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string | null
          custom_no: string | null
          id: number
          name: string | null
          name_disp: string | null
          org_id: string
          status: string | null
          status_name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_no?: string | null
          id: number
          name?: string | null
          name_disp?: string | null
          org_id: string
          status?: string | null
          status_name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_no?: string | null
          id?: number
          name?: string | null
          name_disp?: string | null
          org_id?: string
          status?: string | null
          status_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
        ]
      }
      finance_monthly: {
        Row: {
          accounts_payable: number | null
          accounts_receivable: number | null
          borrowings: number | null
          cash_and_deposits: number | null
          created_at: string | null
          expense_amount: number | null
          id: string
          income_amount: number | null
          interest_expense: number | null
          net_assets: number | null
          org_id: string
          total_assets: number | null
          total_liabilities: number | null
          updated_at: string | null
          year_month: string
        }
        Insert: {
          accounts_payable?: number | null
          accounts_receivable?: number | null
          borrowings?: number | null
          cash_and_deposits?: number | null
          created_at?: string | null
          expense_amount?: number | null
          id?: string
          income_amount?: number | null
          interest_expense?: number | null
          net_assets?: number | null
          org_id: string
          total_assets?: number | null
          total_liabilities?: number | null
          updated_at?: string | null
          year_month: string
        }
        Update: {
          accounts_payable?: number | null
          accounts_receivable?: number | null
          borrowings?: number | null
          cash_and_deposits?: number | null
          created_at?: string | null
          expense_amount?: number | null
          id?: string
          income_amount?: number | null
          interest_expense?: number | null
          net_assets?: number | null
          org_id?: string
          total_assets?: number | null
          total_liabilities?: number | null
          updated_at?: string | null
          year_month?: string
        }
        Relationships: []
      }
      freee_monthly_pl: {
        Row: {
          cost_of_sales: number | null
          created_at: string | null
          gross_profit: number | null
          gross_profit_rate: number | null
          id: string
          operating_profit: number | null
          org_id: string
          revenue: number | null
          sga_details: Json | null
          sga_total: number | null
          updated_at: string | null
          year_month: string
        }
        Insert: {
          cost_of_sales?: number | null
          created_at?: string | null
          gross_profit?: number | null
          gross_profit_rate?: number | null
          id?: string
          operating_profit?: number | null
          org_id: string
          revenue?: number | null
          sga_details?: Json | null
          sga_total?: number | null
          updated_at?: string | null
          year_month: string
        }
        Update: {
          cost_of_sales?: number | null
          created_at?: string | null
          gross_profit?: number | null
          gross_profit_rate?: number | null
          id?: string
          operating_profit?: number | null
          org_id?: string
          revenue?: number | null
          sga_details?: Json | null
          sga_total?: number | null
          updated_at?: string | null
          year_month?: string
        }
        Relationships: []
      }
      invite_links: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string
          id: string
          org_id: string
          role: string
          status: string | null
          token: string
          used_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at: string
          id?: string
          org_id?: string
          role?: string
          status?: string | null
          token: string
          used_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          id?: string
          org_id?: string
          role?: string
          status?: string | null
          token?: string
          used_by?: string | null
        }
        Relationships: []
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
      member_classifications: {
        Row: {
          created_at: string | null
          employment_type: string
          end_month: string | null
          id: string
          member_name: string
          org_id: string
          start_month: string | null
        }
        Insert: {
          created_at?: string | null
          employment_type: string
          end_month?: string | null
          id?: string
          member_name: string
          org_id?: string
          start_month?: string | null
        }
        Update: {
          created_at?: string | null
          employment_type?: string
          end_month?: string | null
          id?: string
          member_name?: string
          org_id?: string
          start_month?: string | null
        }
        Relationships: []
      }
      member_client_monthly_hours: {
        Row: {
          client_id: string | null
          client_name: string
          created_at: string | null
          hours: number
          id: string
          member_name: string
          org_id: string
          year_month: string
        }
        Insert: {
          client_id?: string | null
          client_name: string
          created_at?: string | null
          hours?: number
          id?: string
          member_name: string
          org_id: string
          year_month: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          created_at?: string | null
          hours?: number
          id?: string
          member_name?: string
          org_id?: string
          year_month?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          created_at: string
          hourly_rate: number | null
          id: string
          member_type: string
          name: string
          org_id: string
          role: string
          status: string
        }
        Insert: {
          created_at?: string
          hourly_rate?: number | null
          id?: string
          member_type?: string
          name: string
          org_id: string
          role: string
          status?: string
        }
        Update: {
          created_at?: string
          hourly_rate?: number | null
          id?: string
          member_type?: string
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
          cost_total: number | null
          created_at: string
          gross_profit: number
          gross_profit_rate: number | null
          id: string
          org_id: string
          revenue: number
          year_month: string
        }
        Insert: {
          client_id?: string | null
          cost?: number
          cost_total?: number | null
          created_at?: string
          gross_profit?: number
          gross_profit_rate?: number | null
          id?: string
          org_id: string
          revenue?: number
          year_month: string
        }
        Update: {
          client_id?: string | null
          cost?: number
          cost_total?: number | null
          created_at?: string
          gross_profit?: number
          gross_profit_rate?: number | null
          id?: string
          org_id?: string
          revenue?: number
          year_month?: string
        }
        Relationships: [
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
      plan_settings: {
        Row: {
          annual_client_target: number | null
          annual_project_target: number | null
          annual_revenue_target: number | null
          cost_rate: number | null
          created_at: string | null
          distribution_mode: string | null
          fiscal_year: string
          gp_per_hour_target: number | null
          gp_per_project_hour_target: number | null
          gross_profit_rate: number | null
          id: string
          it_rate: number | null
          marketing_rate: number | null
          monthly_revenue_distribution: Json | null
          office_rate: number | null
          on_time_delivery_target: number | null
          operating_profit_rate: number | null
          org_id: string
          other_rate: number | null
          personnel_cost_rate: number | null
          professional_rate: number | null
          recruitment_rate: number | null
          revision_rate_target: number | null
          staffing_plan: Json | null
          updated_at: string | null
        }
        Insert: {
          annual_client_target?: number | null
          annual_project_target?: number | null
          annual_revenue_target?: number | null
          cost_rate?: number | null
          created_at?: string | null
          distribution_mode?: string | null
          fiscal_year: string
          gp_per_hour_target?: number | null
          gp_per_project_hour_target?: number | null
          gross_profit_rate?: number | null
          id?: string
          it_rate?: number | null
          marketing_rate?: number | null
          monthly_revenue_distribution?: Json | null
          office_rate?: number | null
          on_time_delivery_target?: number | null
          operating_profit_rate?: number | null
          org_id: string
          other_rate?: number | null
          personnel_cost_rate?: number | null
          professional_rate?: number | null
          recruitment_rate?: number | null
          revision_rate_target?: number | null
          staffing_plan?: Json | null
          updated_at?: string | null
        }
        Update: {
          annual_client_target?: number | null
          annual_project_target?: number | null
          annual_revenue_target?: number | null
          cost_rate?: number | null
          created_at?: string | null
          distribution_mode?: string | null
          fiscal_year?: string
          gp_per_hour_target?: number | null
          gp_per_project_hour_target?: number | null
          gross_profit_rate?: number | null
          id?: string
          it_rate?: number | null
          marketing_rate?: number | null
          monthly_revenue_distribution?: Json | null
          office_rate?: number | null
          on_time_delivery_target?: number | null
          operating_profit_rate?: number | null
          org_id?: string
          other_rate?: number | null
          personnel_cost_rate?: number | null
          professional_rate?: number | null
          recruitment_rate?: number | null
          revision_rate_target?: number | null
          staffing_plan?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          invited_at: string | null
          org_id: string | null
          role: string
          status: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          invited_at?: string | null
          org_id?: string | null
          role?: string
          status?: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          invited_at?: string | null
          org_id?: string | null
          role?: string
          status?: string
        }
        Relationships: []
      }
      project_pl: {
        Row: {
          client_id: number | null
          client_name: string | null
          cost_expenditure: number | null
          cost_project: number | null
          cost_total: number | null
          created_at: string | null
          gross_profit: number | null
          gross_profit_rate: number | null
          id: string
          org_id: string
          project_id: number
          project_name: string | null
          project_no: number | null
          report_date: string | null
          revenue: number | null
          updated_at: string | null
          year_month: string
        }
        Insert: {
          client_id?: number | null
          client_name?: string | null
          cost_expenditure?: number | null
          cost_project?: number | null
          cost_total?: number | null
          created_at?: string | null
          gross_profit?: number | null
          gross_profit_rate?: number | null
          id?: string
          org_id?: string
          project_id: number
          project_name?: string | null
          project_no?: number | null
          report_date?: string | null
          revenue?: number | null
          updated_at?: string | null
          year_month: string
        }
        Update: {
          client_id?: number | null
          client_name?: string | null
          cost_expenditure?: number | null
          cost_project?: number | null
          cost_total?: number | null
          created_at?: string | null
          gross_profit?: number | null
          gross_profit_rate?: number | null
          id?: string
          org_id?: string
          project_id?: number
          project_name?: string | null
          project_no?: number | null
          report_date?: string | null
          revenue?: number | null
          updated_at?: string | null
          year_month?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_id: number | null
          created_at: string | null
          id: number
          name: string | null
          org_id: string
          project_no: string | null
          status: string | null
          type: string | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          client_id?: number | null
          created_at?: string | null
          id: number
          name?: string | null
          org_id: string
          project_no?: string | null
          status?: string | null
          type?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          client_id?: number | null
          created_at?: string | null
          id?: number
          name?: string | null
          org_id?: string
          project_no?: string | null
          status?: string | null
          type?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quality_monthly: {
        Row: {
          client_id: string | null
          client_name: string | null
          created_at: string | null
          id: string
          on_time_deliveries: number | null
          org_id: string
          revision_count: number | null
          total_deliveries: number | null
          year_month: string
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          id?: string
          on_time_deliveries?: number | null
          org_id: string
          revision_count?: number | null
          total_deliveries?: number | null
          year_month: string
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          id?: string
          on_time_deliveries?: number | null
          org_id?: string
          revision_count?: number | null
          total_deliveries?: number | null
          year_month?: string
        }
        Relationships: []
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
      get_user_role: { Args: { _user_id: string }; Returns: string }
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
