// Généré par `pnpm db:types` (supabase gen types) — ne pas modifier à la main.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor_user_id": string | null,"created_at": string,"diff": NonNullable<Json>,"entity_id": string | null,"entity_type": string,"id": number,"ip_hash": string | null,"organization_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_user_id"?: string | null,"created_at"?: string,"diff"?: NonNullable<Json>,"entity_id"?: string | null,"entity_type": string,"id"?: never,"ip_hash"?: string | null,"organization_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_user_id"?: string | null,"created_at"?: string,"diff"?: NonNullable<Json>,"entity_id"?: string | null,"entity_type"?: string,"id"?: never,"ip_hash"?: string | null,"organization_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"branch_closures": {
                  Row: {
                    "branch_id": string,"date": string,"id": string,"organization_id": string,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"date": string,"id"?: string,"organization_id": string,"reason"?: string | null
                  }
                  Update: {
                    "branch_id"?: string,"date"?: string,"id"?: string,"organization_id"?: string,"reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "branch_closures_organization_id_branch_id_fkey"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"branch_settings": {
                  Row: {
                    "almost_turn_threshold": number,"branch_id": string,"max_active_tickets_per_customer": number,"organization_id": string,"priorities_enabled": boolean,"rating_enabled": boolean,"remote_confirm_threshold": number,"remote_max_delays": number,"remote_max_distance_km": number | null,"remote_penalty_places": number,"remote_tickets_enabled": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "almost_turn_threshold"?: number,"branch_id": string,"max_active_tickets_per_customer"?: number,"organization_id": string,"priorities_enabled"?: boolean,"rating_enabled"?: boolean,"remote_confirm_threshold"?: number,"remote_max_delays"?: number,"remote_max_distance_km"?: number | null,"remote_penalty_places"?: number,"remote_tickets_enabled"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "almost_turn_threshold"?: number,"branch_id"?: string,"max_active_tickets_per_customer"?: number,"organization_id"?: string,"priorities_enabled"?: boolean,"rating_enabled"?: boolean,"remote_confirm_threshold"?: number,"remote_max_delays"?: number,"remote_max_distance_km"?: number | null,"remote_penalty_places"?: number,"remote_tickets_enabled"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "branch_settings_organization_id_branch_id_fkey"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"branches": {
                  Row: {
                    "active": boolean,"address": string | null,"city": string | null,"created_at": string,"id": string,"location": unknown,"name": string,"organization_id": string,"phone_e164": string | null,"sort_order": number,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"address"?: string | null,"city"?: string | null,"created_at"?: string,"id"?: string,"location"?: unknown,"name": string,"organization_id": string,"phone_e164"?: string | null,"sort_order"?: number,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"address"?: string | null,"city"?: string | null,"created_at"?: string,"id"?: string,"location"?: unknown,"name"?: string,"organization_id"?: string,"phone_e164"?: string | null,"sort_order"?: number,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "branches_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"counter_services": {
                  Row: {
                    "counter_id": string,"organization_id": string,"service_id": string,"weight": number
                  }
                  ComputedFields: never
                  Insert: {
                    "counter_id": string,"organization_id": string,"service_id": string,"weight"?: number
                  }
                  Update: {
                    "counter_id"?: string,"organization_id"?: string,"service_id"?: string,"weight"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "counter_services_organization_id_counter_id_fkey"
      columns: ["organization_id","counter_id"]
isOneToOne: false
      referencedRelation: "counters"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "counter_services_organization_id_service_id_fkey"
      columns: ["organization_id","service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"counters": {
                  Row: {
                    "active": boolean,"branch_id": string,"created_at": string,"current_agent_id": string | null,"default_practitioner_id": string | null,"id": string,"kind": Database["public"]['Enums']["counter_kind"],"label": string | null,"number": number,"organization_id": string,"sort_order": number,"status": Database["public"]['Enums']["counter_status"],"status_changed_at": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"branch_id": string,"created_at"?: string,"current_agent_id"?: string | null,"default_practitioner_id"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["counter_kind"],"label"?: string | null,"number": number,"organization_id": string,"sort_order"?: number,"status"?: Database["public"]['Enums']["counter_status"],"status_changed_at"?: string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"branch_id"?: string,"created_at"?: string,"current_agent_id"?: string | null,"default_practitioner_id"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["counter_kind"],"label"?: string | null,"number"?: number,"organization_id"?: string,"sort_order"?: number,"status"?: Database["public"]['Enums']["counter_status"],"status_changed_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "counters_organization_id_branch_id_fkey"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "counters_organization_id_default_practitioner_id_fkey"
      columns: ["organization_id","default_practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioners"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"branch_id": string | null,"created_at": string,"email": string | null,"expires_at": string,"id": string,"invited_by": string | null,"organization_id": string,"phone_e164": string | null,"role": Database["public"]['Enums']["member_role"],"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"branch_id"?: string | null,"created_at"?: string,"email"?: string | null,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"organization_id": string,"phone_e164"?: string | null,"role": Database["public"]['Enums']["member_role"],"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"branch_id"?: string | null,"created_at"?: string,"email"?: string | null,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"organization_id"?: string,"phone_e164"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_branch_fk"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "invitations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "active": boolean,"branch_id": string | null,"created_at": string,"id": string,"invited_by": string | null,"organization_id": string,"role": Database["public"]['Enums']["member_role"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"branch_id"?: string | null,"created_at"?: string,"id"?: string,"invited_by"?: string | null,"organization_id": string,"role": Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"branch_id"?: string | null,"created_at"?: string,"id"?: string,"invited_by"?: string | null,"organization_id"?: string,"role"?: Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_branch_fk"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "memberships_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"opening_hours": {
                  Row: {
                    "branch_id": string,"closes_at": string,"id": string,"opens_at": string,"organization_id": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"closes_at": string,"id"?: string,"opens_at": string,"organization_id": string,"weekday": number
                  }
                  Update: {
                    "branch_id"?: string,"closes_at"?: string,"id"?: string,"opens_at"?: string,"organization_id"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "opening_hours_organization_id_branch_id_fkey"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "country": string,"created_at": string,"created_by": string | null,"currency": string,"data_retention_days": number,"default_locale": string,"id": string,"logo_path": string | null,"name": string,"slug": string,"status": Database["public"]['Enums']["org_status"],"suspended_reason": string | null,"type": Database["public"]['Enums']["org_type"],"updated_at": string,"validated_at": string | null,"validated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "country"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"data_retention_days"?: number,"default_locale"?: string,"id"?: string,"logo_path"?: string | null,"name": string,"slug": string,"status"?: Database["public"]['Enums']["org_status"],"suspended_reason"?: string | null,"type": Database["public"]['Enums']["org_type"],"updated_at"?: string,"validated_at"?: string | null,"validated_by"?: string | null
                  }
                  Update: {
                    "country"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"data_retention_days"?: number,"default_locale"?: string,"id"?: string,"logo_path"?: string | null,"name"?: string,"slug"?: string,"status"?: Database["public"]['Enums']["org_status"],"suspended_reason"?: string | null,"type"?: Database["public"]['Enums']["org_type"],"updated_at"?: string,"validated_at"?: string | null,"validated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"platform_admins": {
                  Row: {
                    "granted_at": string,"granted_by": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"granted_by"?: string | null,"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"granted_by"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"practitioners": {
                  Row: {
                    "active": boolean,"branch_id": string,"created_at": string,"display_name": string,"id": string,"organization_id": string,"sort_order": number,"specialty_id": string | null,"title": string | null,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"branch_id": string,"created_at"?: string,"display_name": string,"id"?: string,"organization_id": string,"sort_order"?: number,"specialty_id"?: string | null,"title"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"branch_id"?: string,"created_at"?: string,"display_name"?: string,"id"?: string,"organization_id"?: string,"sort_order"?: number,"specialty_id"?: string | null,"title"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "practitioners_organization_id_branch_id_fkey"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "practitioners_organization_id_specialty_id_fkey"
      columns: ["organization_id","specialty_id"]
isOneToOne: false
      referencedRelation: "specialties"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"full_name": string | null,"id": string,"locale": string,"phone_e164": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"full_name"?: string | null,"id": string,"locale"?: string,"phone_e164"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"full_name"?: string | null,"id"?: string,"locale"?: string,"phone_e164"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"qr_codes": {
                  Row: {
                    "active": boolean,"branch_id": string,"created_at": string,"created_by": string | null,"id": string,"organization_id": string,"revoked_at": string | null,"service_id": string | null,"short_code": string,"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"branch_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"organization_id": string,"revoked_at"?: string | null,"service_id"?: string | null,"short_code": string,"token": string
                  }
                  Update: {
                    "active"?: boolean,"branch_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"organization_id"?: string,"revoked_at"?: string | null,"service_id"?: string | null,"short_code"?: string,"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "qr_codes_organization_id_branch_id_fkey"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "qr_codes_organization_id_service_id_fkey"
      columns: ["organization_id","service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"rate_limits": {
                  Row: {
                    "count": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"key": string,"window_start": string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"services": {
                  Row: {
                    "active": boolean,"allow_priority": boolean,"allow_remote": boolean,"branch_id": string,"color": string,"created_at": string,"default_service_seconds": number,"description": string | null,"id": string,"max_daily_tickets": number | null,"name": string,"name_en": string | null,"organization_id": string,"prefix": string,"sort_order": number,"specialty_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"allow_priority"?: boolean,"allow_remote"?: boolean,"branch_id": string,"color"?: string,"created_at"?: string,"default_service_seconds": number,"description"?: string | null,"id"?: string,"max_daily_tickets"?: number | null,"name": string,"name_en"?: string | null,"organization_id": string,"prefix": string,"sort_order"?: number,"specialty_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"allow_priority"?: boolean,"allow_remote"?: boolean,"branch_id"?: string,"color"?: string,"created_at"?: string,"default_service_seconds"?: number,"description"?: string | null,"id"?: string,"max_daily_tickets"?: number | null,"name"?: string,"name_en"?: string | null,"organization_id"?: string,"prefix"?: string,"sort_order"?: number,"specialty_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "services_organization_id_branch_id_fkey"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "services_organization_id_specialty_id_fkey"
      columns: ["organization_id","specialty_id"]
isOneToOne: false
      referencedRelation: "specialties"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"specialties": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"name": string,"name_en": string | null,"organization_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"name": string,"name_en"?: string | null,"organization_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"name"?: string,"name_en"?: string | null,"organization_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "specialties_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"audit":
{ Args: { "p_action": string,"p_diff"?: Json,"p_entity_id": string,"p_entity_type": string,"p_ip_hash"?: string,"p_org": string }; Returns: undefined
                           },
"can_access_branch":
{ Args: { "p_branch": string,"p_org": string,"p_roles"?: (Database["public"]['Enums']["member_role"])[] }; Returns: boolean
                           },
"can_manage_branch":
{ Args: { "p_branch": string,"p_org": string }; Returns: boolean
                           },
"can_manage_member":
{ Args: { "p_branch": string,"p_org": string,"p_role": Database["public"]['Enums']["member_role"] }; Returns: boolean
                           },
"check_rate_limit":
{ Args: { "p_key": string,"p_max": number,"p_window": string }; Returns: boolean
                           },
"create_branch":
{ Args: { "p_address"?: string,"p_city"?: string,"p_lat"?: number,"p_lng"?: number,"p_name": string,"p_org": string,"p_phone_e164"?: string }; Returns: string
                           },
"create_invitation":
{ Args: { "p_branch"?: string,"p_email"?: string,"p_org": string,"p_phone_e164"?: string,"p_role": Database["public"]['Enums']["member_role"] }; Returns: string
                           },
"create_organization":
{ Args: { "p_data_retention_days"?: number,"p_default_locale"?: string,"p_name": string,"p_slug": string,"p_type": Database["public"]['Enums']["org_type"] }; Returns: string
                           },
"get_invitation":
{ Args: { "p_token": string }; Returns: {
              "email_hint": string,"expires_at": string,"organization_name": string,"role": Database["public"]['Enums']["member_role"],"state": string
            }[]
                           },
"has_org_role":
{ Args: { "p_org": string,"p_roles"?: (Database["public"]['Enums']["member_role"])[] }; Returns: boolean
                           },
"is_anonymous":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_platform_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_privileged_context":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"issue_qr_code":
{ Args: { "p_branch": string,"p_service"?: string }; Returns: {
              "active": boolean,
"branch_id": string,
"created_at": string,
"created_by": string | null,
"id": string,
"organization_id": string,
"revoked_at": string | null,
"service_id": string | null,
"short_code": string,
"token": string
            }
                          SetofOptions: {
        from: "*"
        to: "qr_codes"
        isOneToOne: true
        isSetofReturn: false
      } },
"jsonb_row_diff":
{ Args: { "p_new": Json,"p_old": Json }; Returns: Json
                           },
"list_org_members":
{ Args: { "p_org": string }; Returns: {
              "active": boolean,"branch_id": string,"created_at": string,"email": string,"full_name": string,"membership_id": string,"role": Database["public"]['Enums']["member_role"],"user_id": string
            }[]
                           },
"purge_inactive_anonymous_users":
{ Args: { "p_inactive_for"?: string }; Returns: number
                           },
"purge_rate_limits":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"random_string":
{ Args: { "p_alphabet": string,"p_length": number }; Returns: string
                           },
"regenerate_qr_code":
{ Args: { "p_branch": string,"p_service"?: string }; Returns: {
              "active": boolean,
"branch_id": string,
"created_at": string,
"created_by": string | null,
"id": string,
"organization_id": string,
"revoked_at": string | null,
"service_id": string | null,
"short_code": string,
"token": string
            }
                          SetofOptions: {
        from: "*"
        to: "qr_codes"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_branch_location":
{ Args: { "p_branch": string,"p_lat": number,"p_lng": number }; Returns: undefined
                           },
"shares_org_with":
{ Args: { "p_user": string }; Returns: boolean
                           }
          }
          Enums: {
            "counter_kind": "cabinet"|"guichet"|"caisse"|"laboratoire"|"accueil","counter_status": "closed"|"open"|"paused","member_role": "org_admin"|"branch_manager"|"receptionist"|"agent","org_status": "pending"|"active"|"suspended","org_type": "clinic"|"hospital"|"telecom"|"bank"|"utility"|"administration"|"other"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "counter_kind": ["cabinet", "guichet", "caisse", "laboratoire", "accueil"],"counter_status": ["closed", "open", "paused"],"member_role": ["org_admin", "branch_manager", "receptionist", "agent"],"org_status": ["pending", "active", "suspended"],"org_type": ["clinic", "hospital", "telecom", "bank", "utility", "administration", "other"]
          }
        }
} as const
