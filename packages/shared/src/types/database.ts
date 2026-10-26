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
                    "active": boolean,"address": string | null,"city": string | null,"created_at": string,"id": string,"latitude": number | null,"location": unknown,"longitude": number | null,"name": string,"organization_id": string,"phone_e164": string | null,"sort_order": number,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"address"?: string | null,"city"?: string | null,"created_at"?: string,"id"?: string,"latitude"?: never,"location"?: unknown,"longitude"?: never,"name": string,"organization_id": string,"phone_e164"?: string | null,"sort_order"?: number,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"address"?: string | null,"city"?: string | null,"created_at"?: string,"id"?: string,"latitude"?: never,"location"?: unknown,"longitude"?: never,"name"?: string,"organization_id"?: string,"phone_e164"?: string | null,"sort_order"?: number,"timezone"?: string,"updated_at"?: string
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
                },"client_ops": {
                  Row: {
                    "client_op_id": string,"created_at": string,"op": string,"result": Json | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_op_id": string,"created_at"?: string,"op": string,"result"?: Json | null,"user_id": string
                  }
                  Update: {
                    "client_op_id"?: string,"created_at"?: string,"op"?: string,"result"?: Json | null,"user_id"?: string
                  }
                  Relationships: [
                    
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
                },"daily_sequences": {
                  Row: {
                    "last_number": number,"service_day": string,"service_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "last_number"?: number,"service_day": string,"service_id": string
                  }
                  Update: {
                    "last_number"?: number,"service_day"?: string,"service_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_sequences_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
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
                },"service_time_stats": {
                  Row: {
                    "counter_id": string | null,"ewma_seconds": number,"organization_id": string,"samples": number,"service_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "counter_id"?: string | null,"ewma_seconds": number,"organization_id": string,"samples"?: number,"service_id": string,"updated_at"?: string
                  }
                  Update: {
                    "counter_id"?: string | null,"ewma_seconds"?: number,"organization_id"?: string,"samples"?: number,"service_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_time_stats_counter_id_fkey"
      columns: ["counter_id"]
isOneToOne: false
      referencedRelation: "counters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_time_stats_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    }
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
                },"ticket_events": {
                  Row: {
                    "actor_user_id": string | null,"branch_id": string,"counter_id": string | null,"created_at": string,"id": number,"organization_id": string,"payload": NonNullable<Json>,"ticket_id": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_user_id"?: string | null,"branch_id": string,"counter_id"?: string | null,"created_at"?: string,"id"?: never,"organization_id": string,"payload"?: NonNullable<Json>,"ticket_id": string,"type": string
                  }
                  Update: {
                    "actor_user_id"?: string | null,"branch_id"?: string,"counter_id"?: string | null,"created_at"?: string,"id"?: never,"organization_id"?: string,"payload"?: NonNullable<Json>,"ticket_id"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ticket_events_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"tickets": {
                  Row: {
                    "branch_id": string,"called_at": string | null,"counter_id": string | null,"created_at": string,"created_by": string | null,"customer_user_id": string | null,"delay_count": number,"display_code": string,"finished_at": string | null,"id": string,"is_remote": boolean,"number": number,"organization_id": string,"preferred_counter_id": string | null,"presence_confirmed_at": string | null,"priority_level": number,"priority_reason": Database["public"]['Enums']["priority_reason"] | null,"public_token": string | null,"rated_at": string | null,"rating": number | null,"rating_comment": string | null,"recall_count": number,"recalled_at": string | null,"service_day": string,"service_id": string,"serving_started_at": string | null,"sort_key": number,"source": Database["public"]['Enums']["ticket_source"],"status": Database["public"]['Enums']["ticket_status"],"transferred_from_id": string | null,"updated_at": string,"finish_ticket_internal": {
              "branch_id": string,
"called_at": string | null,
"counter_id": string | null,
"created_at": string,
"created_by": string | null,
"customer_user_id": string | null,
"delay_count": number,
"display_code": string,
"finished_at": string | null,
"id": string,
"is_remote": boolean,
"number": number,
"organization_id": string,
"preferred_counter_id": string | null,
"presence_confirmed_at": string | null,
"priority_level": number,
"priority_reason": Database["public"]['Enums']["priority_reason"] | null,
"public_token": string | null,
"rated_at": string | null,
"rating": number | null,
"rating_comment": string | null,
"recall_count": number,
"recalled_at": string | null,
"service_day": string,
"service_id": string,
"serving_started_at": string | null,
"sort_key": number,
"source": Database["public"]['Enums']["ticket_source"],
"status": Database["public"]['Enums']["ticket_status"],
"transferred_from_id": string | null,
"updated_at": string
            } | null,"staff_ticket_json": Json | null
                  }
                  ComputedFields: "finish_ticket_internal" | "staff_ticket_json"
                  Insert: {
                    "branch_id": string,"called_at"?: string | null,"counter_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_user_id"?: string | null,"delay_count"?: number,"display_code": string,"finished_at"?: string | null,"id"?: string,"is_remote"?: boolean,"number": number,"organization_id": string,"preferred_counter_id"?: string | null,"presence_confirmed_at"?: string | null,"priority_level"?: number,"priority_reason"?: Database["public"]['Enums']["priority_reason"] | null,"public_token"?: string | null,"rated_at"?: string | null,"rating"?: number | null,"rating_comment"?: string | null,"recall_count"?: number,"recalled_at"?: string | null,"service_day": string,"service_id": string,"serving_started_at"?: string | null,"sort_key": number,"source": Database["public"]['Enums']["ticket_source"],"status"?: Database["public"]['Enums']["ticket_status"],"transferred_from_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "branch_id"?: string,"called_at"?: string | null,"counter_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_user_id"?: string | null,"delay_count"?: number,"display_code"?: string,"finished_at"?: string | null,"id"?: string,"is_remote"?: boolean,"number"?: number,"organization_id"?: string,"preferred_counter_id"?: string | null,"presence_confirmed_at"?: string | null,"priority_level"?: number,"priority_reason"?: Database["public"]['Enums']["priority_reason"] | null,"public_token"?: string | null,"rated_at"?: string | null,"rating"?: number | null,"rating_comment"?: string | null,"recall_count"?: number,"recalled_at"?: string | null,"service_day"?: string,"service_id"?: string,"serving_started_at"?: string | null,"sort_key"?: number,"source"?: Database["public"]['Enums']["ticket_source"],"status"?: Database["public"]['Enums']["ticket_status"],"transferred_from_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tickets_organization_id_branch_id_fkey"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "tickets_organization_id_counter_id_fkey"
      columns: ["organization_id","counter_id"]
isOneToOne: false
      referencedRelation: "counters"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "tickets_organization_id_preferred_counter_id_fkey"
      columns: ["organization_id","preferred_counter_id"]
isOneToOne: false
      referencedRelation: "counters"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "tickets_organization_id_service_id_fkey"
      columns: ["organization_id","service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "tickets_transferred_from_id_fkey"
      columns: ["transferred_from_id"]
isOneToOne: false
      referencedRelation: "tickets"
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
"admit_ticket":
{ Args: { "p_client_op_id"?: string,"p_ticket": string }; Returns: Json
                           },
"assert_branch_staff":
{ Args: { "p_branch": string }; Returns: string
                           },
"assert_can_issue":
{ Args: { "p_check_hours": boolean,"p_priority_reason": Database["public"]['Enums']["priority_reason"],"p_service": string }; Returns: {
              "active": boolean,
"allow_priority": boolean,
"allow_remote": boolean,
"branch_id": string,
"color": string,
"created_at": string,
"default_service_seconds": number,
"description": string | null,
"id": string,
"max_daily_tickets": number | null,
"name": string,
"name_en": string | null,
"organization_id": string,
"prefix": string,
"sort_order": number,
"specialty_id": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "services"
        isOneToOne: true
        isSetofReturn: false
      } },
"audit":
{ Args: { "p_action": string,"p_diff"?: Json,"p_entity_id": string,"p_entity_type": string,"p_ip_hash"?: string,"p_org": string }; Returns: undefined
                           },
"branch_board":
{ Args: { "p_branch": string }; Returns: Json
                           },
"branch_is_open":
{ Args: { "p_at"?: string,"p_branch": string }; Returns: boolean
                           },
"branch_service_day":
{ Args: { "p_branch": string }; Returns: string
                           },
"broadcast":
{ Args: { "p_event": string,"p_payload": Json,"p_private": boolean,"p_topic": string }; Returns: undefined
                           },
"broadcast_branch":
{ Args: { "p_branch": string }; Returns: undefined
                           },
"call_next":
{ Args: { "p_client_op_id"?: string,"p_counter": string,"p_finish_current"?: boolean }; Returns: Json
                           },
"can_access_branch":
{ Args: { "p_branch": string,"p_org": string,"p_roles"?: (Database["public"]['Enums']["member_role"])[] }; Returns: boolean
                           },
"can_access_branch_topic":
{ Args: { "p_topic": string }; Returns: boolean
                           },
"can_manage_branch":
{ Args: { "p_branch": string,"p_org": string }; Returns: boolean
                           },
"can_manage_member":
{ Args: { "p_branch": string,"p_org": string,"p_role": Database["public"]['Enums']["member_role"] }; Returns: boolean
                           },
"cancel_my_ticket":
{ Args: { "p_token": string }; Returns: Json
                           },
"cancel_ticket":
{ Args: { "p_client_op_id"?: string,"p_ticket": string }; Returns: Json
                           },
"check_rate_limit":
{ Args: { "p_key": string,"p_max": number,"p_window": string }; Returns: boolean
                           },
"client_op_replay":
{ Args: { "p_op": string }; Returns: Json
                           },
"client_op_save":
{ Args: { "p_name": string,"p_op": string,"p_result": Json }; Returns: undefined
                           },
"close_counter":
{ Args: { "p_counter": string }; Returns: Json
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
"effective_duration_seconds":
{ Args: { "p_default": number,"p_ewma": number,"p_samples": number }; Returns: number
                           },
"estimate_wait_seconds":
{ Args: { "p_ahead": number,"p_busy": (number)[],"p_durations": (number)[] }; Returns: number
                           },
"expire_stale_tickets":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"finish_ticket":
{ Args: { "p_client_op_id"?: string,"p_ticket": string }; Returns: Json
                           },
"finish_ticket_internal":
{ Args: { "p_ticket": Omit<Database["public"]['Tables']["tickets"]['Row'], Database["public"]['Tables']["tickets"]['ComputedFields']> }; Returns: {
              "branch_id": string,
"called_at": string | null,
"counter_id": string | null,
"created_at": string,
"created_by": string | null,
"customer_user_id": string | null,
"delay_count": number,
"display_code": string,
"finished_at": string | null,
"id": string,
"is_remote": boolean,
"number": number,
"organization_id": string,
"preferred_counter_id": string | null,
"presence_confirmed_at": string | null,
"priority_level": number,
"priority_reason": Database["public"]['Enums']["priority_reason"] | null,
"public_token": string | null,
"rated_at": string | null,
"rating": number | null,
"rating_comment": string | null,
"recall_count": number,
"recalled_at": string | null,
"service_day": string,
"service_id": string,
"serving_started_at": string | null,
"sort_key": number,
"source": Database["public"]['Enums']["ticket_source"],
"status": Database["public"]['Enums']["ticket_status"],
"transferred_from_id": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "tickets"
        to: "tickets"
        isOneToOne: true
        isSetofReturn: false
      } },
"get_branch_board":
{ Args: { "p_branch": string }; Returns: Json
                           },
"get_invitation":
{ Args: { "p_token": string }; Returns: {
              "email_hint": string,"expires_at": string,"organization_name": string,"role": Database["public"]['Enums']["member_role"],"state": string
            }[]
                           },
"get_ticket":
{ Args: { "p_token": string }; Returns: Json
                           },
"has_org_role":
{ Args: { "p_org": string,"p_roles"?: (Database["public"]['Enums']["member_role"])[] }; Returns: boolean
                           },
"insert_ticket":
{ Args: { "p_created_by": string,"p_customer": string,"p_priority_reason": Database["public"]['Enums']["priority_reason"],"p_public_token"?: string,"p_service": string,"p_sort_key"?: number,"p_source": Database["public"]['Enums']["ticket_source"],"p_transferred_from"?: string }; Returns: {
              "branch_id": string,
"called_at": string | null,
"counter_id": string | null,
"created_at": string,
"created_by": string | null,
"customer_user_id": string | null,
"delay_count": number,
"display_code": string,
"finished_at": string | null,
"id": string,
"is_remote": boolean,
"number": number,
"organization_id": string,
"preferred_counter_id": string | null,
"presence_confirmed_at": string | null,
"priority_level": number,
"priority_reason": Database["public"]['Enums']["priority_reason"] | null,
"public_token": string | null,
"rated_at": string | null,
"rating": number | null,
"rating_comment": string | null,
"recall_count": number,
"recalled_at": string | null,
"service_day": string,
"service_id": string,
"serving_started_at": string | null,
"sort_key": number,
"source": Database["public"]['Enums']["ticket_source"],
"status": Database["public"]['Enums']["ticket_status"],
"transferred_from_id": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "tickets"
        isOneToOne: true
        isSetofReturn: false
      } },
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
"lock_staff_ticket":
{ Args: { "p_allowed": (Database["public"]['Enums']["ticket_status"])[],"p_ticket": string }; Returns: {
              "branch_id": string,
"called_at": string | null,
"counter_id": string | null,
"created_at": string,
"created_by": string | null,
"customer_user_id": string | null,
"delay_count": number,
"display_code": string,
"finished_at": string | null,
"id": string,
"is_remote": boolean,
"number": number,
"organization_id": string,
"preferred_counter_id": string | null,
"presence_confirmed_at": string | null,
"priority_level": number,
"priority_reason": Database["public"]['Enums']["priority_reason"] | null,
"public_token": string | null,
"rated_at": string | null,
"rating": number | null,
"rating_comment": string | null,
"recall_count": number,
"recalled_at": string | null,
"service_day": string,
"service_id": string,
"serving_started_at": string | null,
"sort_key": number,
"source": Database["public"]['Enums']["ticket_source"],
"status": Database["public"]['Enums']["ticket_status"],
"transferred_from_id": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "tickets"
        isOneToOne: true
        isSetofReturn: false
      } },
"log_ticket_event":
{ Args: { "p_payload"?: Json,"p_ticket": Omit<Database["public"]['Tables']["tickets"]['Row'], Database["public"]['Tables']["tickets"]['ComputedFields']>,"p_type": string }; Returns: undefined
                           },
"mark_no_show":
{ Args: { "p_client_op_id"?: string,"p_ticket": string }; Returns: Json
                           },
"move_back_ticket":
{ Args: { "p_places": number,"p_ticket": string }; Returns: Json
                           },
"next_ticket_number":
{ Args: { "p_day": string,"p_service": string }; Returns: number
                           },
"open_counter":
{ Args: { "p_counter": string }; Returns: Json
                           },
"pause_counter":
{ Args: { "p_counter": string }; Returns: Json
                           },
"purge_inactive_anonymous_users":
{ Args: { "p_inactive_for"?: string }; Returns: number
                           },
"purge_personal_data":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"purge_rate_limits":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"random_string":
{ Args: { "p_alphabet": string,"p_length": number }; Returns: string
                           },
"rate_ticket":
{ Args: { "p_comment"?: string,"p_rating": number,"p_token": string }; Returns: Json
                           },
"recall_ticket":
{ Args: { "p_client_op_id"?: string,"p_ticket": string }; Returns: Json
                           },
"reception_create_ticket":
{ Args: { "p_client_op_id"?: string,"p_priority_reason"?: Database["public"]['Enums']["priority_reason"],"p_service": string }; Returns: Json
                           },
"record_service_duration":
{ Args: { "p_counter": string,"p_org": string,"p_seconds": number,"p_service": string }; Returns: undefined
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
"resolve_entry":
{ Args: { "p_code": string }; Returns: Json
                           },
"service_counter_loads":
{ Args: { "p_service": string }; Returns: {
              "busy_remaining_seconds": number,"counter_id": string,"duration_seconds": number
            }[]
                           },
"set_branch_location":
{ Args: { "p_branch": string,"p_lat": number,"p_lng": number }; Returns: undefined
                           },
"set_counter_status":
{ Args: { "p_counter": string,"p_status": Database["public"]['Enums']["counter_status"] }; Returns: Json
                           },
"set_ticket_priority":
{ Args: { "p_reason": Database["public"]['Enums']["priority_reason"],"p_ticket": string }; Returns: Json
                           },
"shares_org_with":
{ Args: { "p_user": string }; Returns: boolean
                           },
"staff_ticket_command":
{ Args: { "p_client_op_id"?: string,"p_command": string,"p_ticket": string }; Returns: Json
                           },
"staff_ticket_json":
{ Args: { "p_ticket": Omit<Database["public"]['Tables']["tickets"]['Row'], Database["public"]['Tables']["tickets"]['ComputedFields']> }; Returns: Json
                           },
"take_ticket":
{ Args: { "p_customer": string,"p_entry_code": string,"p_priority_reason": Database["public"]['Enums']["priority_reason"],"p_service": string,"p_source": Database["public"]['Enums']["ticket_source"] }; Returns: Json
                           },
"throttle_ticket_request":
{ Args: { "p_customer": string,"p_ip_hash": string }; Returns: boolean
                           },
"ticket_display_code":
{ Args: { "p_number": number,"p_prefix": string }; Returns: string
                           },
"ticket_position":
{ Args: { "p_ticket": string }; Returns: number
                           },
"ticket_view":
{ Args: { "p_ticket": string }; Returns: Json
                           },
"ticket_wait_seconds":
{ Args: { "p_ticket": string }; Returns: number
                           },
"transfer_ticket":
{ Args: { "p_client_op_id"?: string,"p_target_service": string,"p_ticket": string }; Returns: Json
                           }
          }
          Enums: {
            "counter_kind": "cabinet"|"guichet"|"caisse"|"laboratoire"|"accueil","counter_status": "closed"|"open"|"paused","member_role": "org_admin"|"branch_manager"|"receptionist"|"agent","org_status": "pending"|"active"|"suspended","org_type": "clinic"|"hospital"|"telecom"|"bank"|"utility"|"administration"|"other","priority_reason": "appointment"|"pregnancy"|"elderly"|"disability"|"other","ticket_source": "qr"|"short_code"|"remote"|"reception","ticket_status": "waiting"|"called"|"serving"|"served"|"no_show"|"cancelled"|"transferred"
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
            "counter_kind": ["cabinet", "guichet", "caisse", "laboratoire", "accueil"],"counter_status": ["closed", "open", "paused"],"member_role": ["org_admin", "branch_manager", "receptionist", "agent"],"org_status": ["pending", "active", "suspended"],"org_type": ["clinic", "hospital", "telecom", "bank", "utility", "administration", "other"],"priority_reason": ["appointment", "pregnancy", "elderly", "disability", "other"],"ticket_source": ["qr", "short_code", "remote", "reception"],"ticket_status": ["waiting", "called", "serving", "served", "no_show", "cancelled", "transferred"]
          }
        }
} as const
