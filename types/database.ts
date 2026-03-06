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
      admin_users: {
        Row: {
          added_at: string | null
          org_id: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          added_at?: string | null
          org_id?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          added_at?: string | null
          org_id?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      app_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: string | null
          client_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          new_data: Json | null
          old_data: Json | null
          org_id: string | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_by?: string | null
          client_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          new_data?: Json | null
          old_data?: Json | null
          org_id?: string | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_by?: string | null
          client_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          new_data?: Json | null
          old_data?: Json | null
          org_id?: string | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          message: string | null
          page_url: string | null
          phone: string | null
          referrer: string | null
          service_interest: string | null
          submission_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          message?: string | null
          page_url?: string | null
          phone?: string | null
          referrer?: string | null
          service_interest?: string | null
          submission_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          message?: string | null
          page_url?: string | null
          phone?: string | null
          referrer?: string | null
          service_interest?: string | null
          submission_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      contract_milestones: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          id: string
          request_id: string | null
          title: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          request_id?: string | null
          title: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          request_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_milestones_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_opportunities: {
        Row: {
          agency: string | null
          created_at: string | null
          deadline: string | null
          estimated_value: number | null
          id: string
          naics: string | null
          notes: string | null
          proposal_path: string | null
          stage: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          agency?: string | null
          created_at?: string | null
          deadline?: string | null
          estimated_value?: number | null
          id?: string
          naics?: string | null
          notes?: string | null
          proposal_path?: string | null
          stage?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          agency?: string | null
          created_at?: string | null
          deadline?: string | null
          estimated_value?: number | null
          id?: string
          naics?: string | null
          notes?: string | null
          proposal_path?: string | null
          stage?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      contract_updates: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          request_id: string | null
          update_text: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          request_id?: string | null
          update_text: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          request_id?: string | null
          update_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_updates_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          admin_status: string | null
          awarded_at: string | null
          awarded_by: string | null
          client_id: string | null
          contract_number: string
          created_at: string | null
          description: string | null
          final_amount: number | null
          gov_type: string | null
          id: string
          last_updated: string
          org_id: string | null
          owner_id: string | null
          period_end: string | null
          period_of_performance: string | null
          period_start: string | null
          progress_percentage: number | null
          service_request_id: string | null
          source_request_id: string | null
          source_type: string
          status: string | null
          title: string | null
          tracking_id: string
          updated_at: string | null
        }
        Insert: {
          admin_status?: string | null
          awarded_at?: string | null
          awarded_by?: string | null
          client_id?: string | null
          contract_number: string
          created_at?: string | null
          description?: string | null
          final_amount?: number | null
          gov_type?: string | null
          id?: string
          last_updated?: string
          org_id?: string | null
          owner_id?: string | null
          period_end?: string | null
          period_of_performance?: string | null
          period_start?: string | null
          progress_percentage?: number | null
          service_request_id?: string | null
          source_request_id?: string | null
          source_type: string
          status?: string | null
          title?: string | null
          tracking_id: string
          updated_at?: string | null
        }
        Update: {
          admin_status?: string | null
          awarded_at?: string | null
          awarded_by?: string | null
          client_id?: string | null
          contract_number?: string
          created_at?: string | null
          description?: string | null
          final_amount?: number | null
          gov_type?: string | null
          id?: string
          last_updated?: string
          org_id?: string | null
          owner_id?: string | null
          period_end?: string | null
          period_of_performance?: string | null
          period_start?: string | null
          progress_percentage?: number | null
          service_request_id?: string | null
          source_request_id?: string | null
          source_type?: string
          status?: string | null
          title?: string | null
          tracking_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_source_request_id_fkey"
            columns: ["source_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          arv: number | null
          created_at: string | null
          id: string
          property_name: string | null
          purchase_price: number | null
          rehab_cost: number | null
          user_id: string | null
        }
        Insert: {
          arv?: number | null
          created_at?: string | null
          id?: string
          property_name?: string | null
          purchase_price?: number | null
          rehab_cost?: number | null
          user_id?: string | null
        }
        Update: {
          arv?: number | null
          created_at?: string | null
          id?: string
          property_name?: string | null
          purchase_price?: number | null
          rehab_cost?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      gov_submissions: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          lead_type: string | null
          naics_code: string | null
          organization_name: string | null
          page_url: string | null
          phone: string | null
          preferred_contact_time: string | null
          project_scope: string | null
          referrer: string | null
          request_type: string | null
          role_other: string | null
          role_type: string | null
          status: string | null
          submission_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lead_type?: string | null
          naics_code?: string | null
          organization_name?: string | null
          page_url?: string | null
          phone?: string | null
          preferred_contact_time?: string | null
          project_scope?: string | null
          referrer?: string | null
          request_type?: string | null
          role_other?: string | null
          role_type?: string | null
          status?: string | null
          submission_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lead_type?: string | null
          naics_code?: string | null
          organization_name?: string | null
          page_url?: string | null
          phone?: string | null
          preferred_contact_time?: string | null
          project_scope?: string | null
          referrer?: string | null
          request_type?: string | null
          role_other?: string | null
          role_type?: string | null
          status?: string | null
          submission_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_by: string
          org_id: string
          revoked_at: string | null
          role: string
          token: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_by: string
          org_id: string
          revoked_at?: string | null
          role?: string
          token?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string
          org_id?: string
          revoked_at?: string | null
          role?: string
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          agency_type: string | null
          allow_self_registration: boolean | null
          city: string | null
          country: string | null
          created_at: string | null
          created_by: string
          email: string | null
          gov_domain: string | null
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          normalized_name: string | null
          phone: string | null
          postal_code: string | null
          require_admin_approval: boolean | null
          state: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          agency_type?: string | null
          allow_self_registration?: boolean | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by: string
          email?: string | null
          gov_domain?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          normalized_name?: string | null
          phone?: string | null
          postal_code?: string | null
          require_admin_approval?: boolean | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          agency_type?: string | null
          allow_self_registration?: boolean | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string
          email?: string | null
          gov_domain?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          normalized_name?: string | null
          phone?: string | null
          postal_code?: string | null
          require_admin_approval?: boolean | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      orgs: {
        Row: {
          agency_type: string
          created_at: string
          created_by: string
          gov_domain: string
          id: string
          name: string
          verification_status: string
        }
        Insert: {
          agency_type: string
          created_at?: string
          created_by: string
          gov_domain: string
          id?: string
          name: string
          verification_status?: string
        }
        Update: {
          agency_type?: string
          created_at?: string
          created_by?: string
          gov_domain?: string
          id?: string
          name?: string
          verification_status?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          created_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          company: string | null
          country: string | null
          country_code: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          org_id: string | null
          phone: string | null
          postal_code: string | null
          role: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          last_name?: string | null
          org_id?: string | null
          phone?: string | null
          postal_code?: string | null
          role?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          org_id?: string | null
          phone?: string | null
          postal_code?: string | null
          role?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      realestate_submissions: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          lead_type: string | null
          page_url: string | null
          phone: string | null
          preferred_contact_time: string | null
          project_scope: string | null
          referrer: string | null
          role_other: string | null
          role_type: string | null
          status: string | null
          submission_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lead_type?: string | null
          page_url?: string | null
          phone?: string | null
          preferred_contact_time?: string | null
          project_scope?: string | null
          referrer?: string | null
          role_other?: string | null
          role_type?: string | null
          status?: string | null
          submission_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lead_type?: string | null
          page_url?: string | null
          phone?: string | null
          preferred_contact_time?: string | null
          project_scope?: string | null
          referrer?: string | null
          role_other?: string | null
          role_type?: string | null
          status?: string | null
          submission_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          checksum: string | null
          client_id: string | null
          contract_count: number | null
          created_at: string | null
          generated_by: string | null
          id: string
          locked_at: string | null
          org_id: string | null
          report_type: string
          snapshot: Json
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          checksum?: string | null
          client_id?: string | null
          contract_count?: number | null
          created_at?: string | null
          generated_by?: string | null
          id?: string
          locked_at?: string | null
          org_id?: string | null
          report_type: string
          snapshot: Json
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          checksum?: string | null
          client_id?: string | null
          contract_count?: number | null
          created_at?: string | null
          generated_by?: string | null
          id?: string
          locked_at?: string | null
          org_id?: string | null
          report_type?: string
          snapshot?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_request_activity: {
        Row: {
          actor_email: string | null
          created_at: string
          id: string
          note: string | null
          request_id: string
          stage: string
        }
        Insert: {
          actor_email?: string | null
          created_at?: string
          id?: string
          note?: string | null
          request_id: string
          stage: string
        }
        Update: {
          actor_email?: string | null
          created_at?: string
          id?: string
          note?: string | null
          request_id?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_request_activity_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          admin_status: string | null
          awarded: boolean | null
          client_id: string | null
          created_at: string
          description: string | null
          form_data: Json
          gov_type: string
          id: string
          org_id: string | null
          requester_email: string | null
          status: string
          submitted_by: string
          title: string | null
          tracking_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_status?: string | null
          awarded?: boolean | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          form_data?: Json
          gov_type: string
          id?: string
          org_id?: string | null
          requester_email?: string | null
          status?: string
          submitted_by: string
          title?: string | null
          tracking_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_status?: string | null
          awarded?: boolean | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          form_data?: Json
          gov_type?: string
          id?: string
          org_id?: string | null
          requester_email?: string | null
          status?: string
          submitted_by?: string
          title?: string | null
          tracking_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
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
      current_org_id: { Args: never; Returns: string }
      current_role: { Args: never; Returns: string }
      generate_tracking_id: { Args: { prefix?: string }; Returns: string }
      is_platform_admin: { Args: never; Returns: boolean }
      is_service_role: { Args: never; Returns: boolean }
      my_org_id: { Args: never; Returns: string }
      my_profile_context: {
        Args: never
        Returns: {
          org_id: string
          role: string
        }[]
      }
      my_role: { Args: never; Returns: string }
      report_checksum_sha256: { Args: { payload: Json }; Returns: string }
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
