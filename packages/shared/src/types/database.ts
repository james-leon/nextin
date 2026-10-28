// Généré par `pnpm db:types` (supabase gen types) — ne pas modifier à la main.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "account_messages": {
                  Row: {
                    "attempt": number,"channel": string,"created_at": string,"dedupe_key": string,"error": string | null,"id": string,"kind": string,"locale": string,"next_attempt_at": string,"organization_id": string | null,"payload": NonNullable<Json>,"sent_at": string | null,"status": string,"to_email": string | null,"to_phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt"?: number,"channel": string,"created_at"?: string,"dedupe_key": string,"error"?: string | null,"id"?: string,"kind": string,"locale"?: string,"next_attempt_at"?: string,"organization_id"?: string | null,"payload"?: NonNullable<Json>,"sent_at"?: string | null,"status"?: string,"to_email"?: string | null,"to_phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "attempt"?: number,"channel"?: string,"created_at"?: string,"dedupe_key"?: string,"error"?: string | null,"id"?: string,"kind"?: string,"locale"?: string,"next_attempt_at"?: string,"organization_id"?: string | null,"payload"?: NonNullable<Json>,"sent_at"?: string | null,"status"?: string,"to_email"?: string | null,"to_phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_messages_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"announcement_settings": {
                  Row: {
                    "branch_id": string,"chime_enabled": boolean,"languages": (string)[],"organization_id": string,"quiet_hours": NonNullable<Json>,"repeat_count": number,"updated_at": string,"volume": number
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"chime_enabled"?: boolean,"languages"?: (string)[],"organization_id": string,"quiet_hours"?: NonNullable<Json>,"repeat_count"?: number,"updated_at"?: string,"volume"?: number
                  }
                  Update: {
                    "branch_id"?: string,"chime_enabled"?: boolean,"languages"?: (string)[],"organization_id"?: string,"quiet_hours"?: NonNullable<Json>,"repeat_count"?: number,"updated_at"?: string,"volume"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcement_settings_organization_id_branch_id_fkey"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"appointment_requests": {
                  Row: {
                    "appointment_id": string | null,"branch_id": string,"code_attempts": number,"code_expires_at": string | null,"code_hash": string | null,"codes_sent": number,"created_at": string,"customer_label": string | null,"customer_user_id": string | null,"decline_reason": string | null,"handled_at": string | null,"handled_by": string | null,"id": string,"locale": string,"organization_id": string,"phone_e164": string | null,"practitioner_id": string | null,"preferred_day": string | null,"preferred_period": string | null,"preferred_starts_at": string | null,"public_token": string,"service_id": string,"status": Database["public"]['Enums']["appointment_request_status"],"updated_at": string,"verified_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id"?: string | null,"branch_id": string,"code_attempts"?: number,"code_expires_at"?: string | null,"code_hash"?: string | null,"codes_sent"?: number,"created_at"?: string,"customer_label"?: string | null,"customer_user_id"?: string | null,"decline_reason"?: string | null,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"locale"?: string,"organization_id": string,"phone_e164"?: string | null,"practitioner_id"?: string | null,"preferred_day"?: string | null,"preferred_period"?: string | null,"preferred_starts_at"?: string | null,"public_token": string,"service_id": string,"status"?: Database["public"]['Enums']["appointment_request_status"],"updated_at"?: string,"verified_at"?: string | null
                  }
                  Update: {
                    "appointment_id"?: string | null,"branch_id"?: string,"code_attempts"?: number,"code_expires_at"?: string | null,"code_hash"?: string | null,"codes_sent"?: number,"created_at"?: string,"customer_label"?: string | null,"customer_user_id"?: string | null,"decline_reason"?: string | null,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"locale"?: string,"organization_id"?: string,"phone_e164"?: string | null,"practitioner_id"?: string | null,"preferred_day"?: string | null,"preferred_period"?: string | null,"preferred_starts_at"?: string | null,"public_token"?: string,"service_id"?: string,"status"?: Database["public"]['Enums']["appointment_request_status"],"updated_at"?: string,"verified_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointment_requests_organization_id_appointment_id_fkey"
      columns: ["organization_id","appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "appointment_requests_organization_id_branch_id_fkey"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "appointment_requests_organization_id_practitioner_id_fkey"
      columns: ["organization_id","practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioners"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "appointment_requests_organization_id_service_id_fkey"
      columns: ["organization_id","service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"appointments": {
                  Row: {
                    "booked_by": string | null,"branch_id": string,"cancel_reason": string | null,"checked_in_at": string | null,"created_at": string,"customer_label": string | null,"ends_at": string,"id": string,"locale": string,"organization_id": string,"phone_e164": string | null,"practitioner_id": string,"rescheduled_from_id": string | null,"service_id": string,"starts_at": string,"status": Database["public"]['Enums']["appointment_status"],"ticket_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booked_by"?: string | null,"branch_id": string,"cancel_reason"?: string | null,"checked_in_at"?: string | null,"created_at"?: string,"customer_label"?: string | null,"ends_at": string,"id"?: string,"locale"?: string,"organization_id": string,"phone_e164"?: string | null,"practitioner_id": string,"rescheduled_from_id"?: string | null,"service_id": string,"starts_at": string,"status"?: Database["public"]['Enums']["appointment_status"],"ticket_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "booked_by"?: string | null,"branch_id"?: string,"cancel_reason"?: string | null,"checked_in_at"?: string | null,"created_at"?: string,"customer_label"?: string | null,"ends_at"?: string,"id"?: string,"locale"?: string,"organization_id"?: string,"phone_e164"?: string | null,"practitioner_id"?: string,"rescheduled_from_id"?: string | null,"service_id"?: string,"starts_at"?: string,"status"?: Database["public"]['Enums']["appointment_status"],"ticket_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointments_organization_id_branch_id_fkey"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "appointments_organization_id_practitioner_id_fkey"
      columns: ["organization_id","practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioners"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "appointments_organization_id_service_id_fkey"
      columns: ["organization_id","service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "appointments_organization_id_ticket_id_fkey"
      columns: ["organization_id","ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "appointments_rescheduled_from_id_fkey"
      columns: ["rescheduled_from_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
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
                },"billing_reminders": {
                  Row: {
                    "channel": string,"id": number,"kind": string,"offset_days": number,"sent_at": string,"subscription_id": string,"target_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": string,"id"?: never,"kind": string,"offset_days": number,"sent_at"?: string,"subscription_id": string,"target_date": string
                  }
                  Update: {
                    "channel"?: string,"id"?: never,"kind"?: string,"offset_days"?: number,"sent_at"?: string,"subscription_id"?: string,"target_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "billing_reminders_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "subscriptions"
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
                    "almost_turn_threshold": number,"appointment_early_minutes": number,"appointment_late_grace_minutes": number,"appointment_mode": string,"appointment_no_show_minutes": number,"appointment_request_days": number,"appointment_request_max_pending": number,"appointment_requests_enabled": boolean,"appointment_walkin_ratio": number,"branch_id": string,"max_active_tickets_per_customer": number,"organization_id": string,"priorities_enabled": boolean,"public_listing_enabled": boolean,"rating_enabled": boolean,"remote_confirm_threshold": number,"remote_leave_margin_minutes": number,"remote_max_delays": number,"remote_max_distance_km": number | null,"remote_penalty_places": number,"remote_tickets_enabled": boolean,"remote_travel_kmh": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "almost_turn_threshold"?: number,"appointment_early_minutes"?: number,"appointment_late_grace_minutes"?: number,"appointment_mode"?: string,"appointment_no_show_minutes"?: number,"appointment_request_days"?: number,"appointment_request_max_pending"?: number,"appointment_requests_enabled"?: boolean,"appointment_walkin_ratio"?: number,"branch_id": string,"max_active_tickets_per_customer"?: number,"organization_id": string,"priorities_enabled"?: boolean,"public_listing_enabled"?: boolean,"rating_enabled"?: boolean,"remote_confirm_threshold"?: number,"remote_leave_margin_minutes"?: number,"remote_max_delays"?: number,"remote_max_distance_km"?: number | null,"remote_penalty_places"?: number,"remote_tickets_enabled"?: boolean,"remote_travel_kmh"?: number,"updated_at"?: string
                  }
                  Update: {
                    "almost_turn_threshold"?: number,"appointment_early_minutes"?: number,"appointment_late_grace_minutes"?: number,"appointment_mode"?: string,"appointment_no_show_minutes"?: number,"appointment_request_days"?: number,"appointment_request_max_pending"?: number,"appointment_requests_enabled"?: boolean,"appointment_walkin_ratio"?: number,"branch_id"?: string,"max_active_tickets_per_customer"?: number,"organization_id"?: string,"priorities_enabled"?: boolean,"public_listing_enabled"?: boolean,"rating_enabled"?: boolean,"remote_confirm_threshold"?: number,"remote_leave_margin_minutes"?: number,"remote_max_delays"?: number,"remote_max_distance_km"?: number | null,"remote_penalty_places"?: number,"remote_tickets_enabled"?: boolean,"remote_travel_kmh"?: number,"updated_at"?: string
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
                },"counter_pauses": {
                  Row: {
                    "branch_id": string,"counter_id": string,"ended_at": string | null,"id": string,"organization_id": string,"session_id": string | null,"started_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"counter_id": string,"ended_at"?: string | null,"id"?: string,"organization_id": string,"session_id"?: string | null,"started_at"?: string
                  }
                  Update: {
                    "branch_id"?: string,"counter_id"?: string,"ended_at"?: string | null,"id"?: string,"organization_id"?: string,"session_id"?: string | null,"started_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "counter_pauses_organization_id_branch_id_fkey"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "counter_pauses_organization_id_counter_id_fkey"
      columns: ["organization_id","counter_id"]
isOneToOne: false
      referencedRelation: "counters"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "counter_pauses_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "counter_sessions"
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
                },"counter_sessions": {
                  Row: {
                    "agent_id": string | null,"branch_id": string,"counter_id": string,"ended_at": string | null,"id": string,"organization_id": string,"started_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agent_id"?: string | null,"branch_id": string,"counter_id": string,"ended_at"?: string | null,"id"?: string,"organization_id": string,"started_at"?: string
                  }
                  Update: {
                    "agent_id"?: string | null,"branch_id"?: string,"counter_id"?: string,"ended_at"?: string | null,"id"?: string,"organization_id"?: string,"started_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "counter_sessions_organization_id_branch_id_fkey"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "counter_sessions_organization_id_counter_id_fkey"
      columns: ["organization_id","counter_id"]
isOneToOne: false
      referencedRelation: "counters"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"counters": {
                  Row: {
                    "active": boolean,"branch_id": string,"created_at": string,"current_agent_id": string | null,"default_practitioner_id": string | null,"fairness_day": string | null,"fairness_walkins": number | null,"id": string,"kind": Database["public"]['Enums']["counter_kind"],"label": string | null,"number": number,"organization_id": string,"sort_order": number,"status": Database["public"]['Enums']["counter_status"],"status_changed_at": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"branch_id": string,"created_at"?: string,"current_agent_id"?: string | null,"default_practitioner_id"?: string | null,"fairness_day"?: string | null,"fairness_walkins"?: number | null,"id"?: string,"kind": Database["public"]['Enums']["counter_kind"],"label"?: string | null,"number": number,"organization_id": string,"sort_order"?: number,"status"?: Database["public"]['Enums']["counter_status"],"status_changed_at"?: string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"branch_id"?: string,"created_at"?: string,"current_agent_id"?: string | null,"default_practitioner_id"?: string | null,"fairness_day"?: string | null,"fairness_walkins"?: number | null,"id"?: string,"kind"?: Database["public"]['Enums']["counter_kind"],"label"?: string | null,"number"?: number,"organization_id"?: string,"sort_order"?: number,"status"?: Database["public"]['Enums']["counter_status"],"status_changed_at"?: string,"updated_at"?: string
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
                },"daily_branch_stats": {
                  Row: {
                    "appointment": number,"branch_id": string,"cancelled": number,"day": string,"hourly": (number)[],"issued": number,"max_wait_seconds": number,"no_show": number,"organization_id": string,"rating_count": number,"rating_sum": number,"remote": number,"served": number,"service_count": number,"service_id": string,"service_seconds_sum": number,"transferred": number,"updated_at": string,"wait_count": number,"wait_seconds_sum": number
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment"?: number,"branch_id": string,"cancelled"?: number,"day": string,"hourly"?: (number)[],"issued"?: number,"max_wait_seconds"?: number,"no_show"?: number,"organization_id": string,"rating_count"?: number,"rating_sum"?: number,"remote"?: number,"served"?: number,"service_count"?: number,"service_id": string,"service_seconds_sum"?: number,"transferred"?: number,"updated_at"?: string,"wait_count"?: number,"wait_seconds_sum"?: number
                  }
                  Update: {
                    "appointment"?: number,"branch_id"?: string,"cancelled"?: number,"day"?: string,"hourly"?: (number)[],"issued"?: number,"max_wait_seconds"?: number,"no_show"?: number,"organization_id"?: string,"rating_count"?: number,"rating_sum"?: number,"remote"?: number,"served"?: number,"service_count"?: number,"service_id"?: string,"service_seconds_sum"?: number,"transferred"?: number,"updated_at"?: string,"wait_count"?: number,"wait_seconds_sum"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_branch_stats_organization_id_branch_id_fkey"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "daily_branch_stats_organization_id_service_id_fkey"
      columns: ["organization_id","service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"daily_counter_stats": {
                  Row: {
                    "branch_id": string,"called": number,"counter_id": string,"day": string,"no_show": number,"open_seconds": number,"organization_id": string,"pause_seconds": number,"practitioner_id": string | null,"rating_count": number,"rating_sum": number,"served": number,"service_count": number,"service_seconds_sum": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"called"?: number,"counter_id": string,"day": string,"no_show"?: number,"open_seconds"?: number,"organization_id": string,"pause_seconds"?: number,"practitioner_id"?: string | null,"rating_count"?: number,"rating_sum"?: number,"served"?: number,"service_count"?: number,"service_seconds_sum"?: number,"updated_at"?: string
                  }
                  Update: {
                    "branch_id"?: string,"called"?: number,"counter_id"?: string,"day"?: string,"no_show"?: number,"open_seconds"?: number,"organization_id"?: string,"pause_seconds"?: number,"practitioner_id"?: string | null,"rating_count"?: number,"rating_sum"?: number,"served"?: number,"service_count"?: number,"service_seconds_sum"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_counter_stats_organization_id_branch_id_fkey"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "daily_counter_stats_organization_id_counter_id_fkey"
      columns: ["organization_id","counter_id"]
isOneToOne: false
      referencedRelation: "counters"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "daily_counter_stats_organization_id_practitioner_id_fkey"
      columns: ["organization_id","practitioner_id"]
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
                },"discounts": {
                  Row: {
                    "code": string | null,"created_at": string,"created_by": string | null,"expires_at": string | null,"id": string,"kind": string,"organization_id": string | null,"reason": string | null,"remaining_invoices": number,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code"?: string | null,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"kind": string,"organization_id"?: string | null,"reason"?: string | null,"remaining_invoices"?: number,"value": number
                  }
                  Update: {
                    "code"?: string | null,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"kind"?: string,"organization_id"?: string | null,"reason"?: string | null,"remaining_invoices"?: number,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "discounts_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"display_services": {
                  Row: {
                    "display_id": string,"organization_id": string,"service_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "display_id": string,"organization_id": string,"service_id": string
                  }
                  Update: {
                    "display_id"?: string,"organization_id"?: string,"service_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "display_services_organization_id_display_id_fkey"
      columns: ["organization_id","display_id"]
isOneToOne: false
      referencedRelation: "displays"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "display_services_organization_id_service_id_fkey"
      columns: ["organization_id","service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"displays": {
                  Row: {
                    "app_version": string | null,"branch_id": string | null,"created_at": string,"device_token_hash": string | null,"id": string,"last_seen_at": string | null,"name": string | null,"organization_id": string | null,"paired_at": string | null,"paired_by": string | null,"pairing_code": string | null,"pairing_expires_at": string | null,"poll_secret_hash": string | null,"revoked_at": string | null,"show_ads": boolean,"status": Database["public"]['Enums']["display_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "app_version"?: string | null,"branch_id"?: string | null,"created_at"?: string,"device_token_hash"?: string | null,"id"?: string,"last_seen_at"?: string | null,"name"?: string | null,"organization_id"?: string | null,"paired_at"?: string | null,"paired_by"?: string | null,"pairing_code"?: string | null,"pairing_expires_at"?: string | null,"poll_secret_hash"?: string | null,"revoked_at"?: string | null,"show_ads"?: boolean,"status"?: Database["public"]['Enums']["display_status"],"updated_at"?: string
                  }
                  Update: {
                    "app_version"?: string | null,"branch_id"?: string | null,"created_at"?: string,"device_token_hash"?: string | null,"id"?: string,"last_seen_at"?: string | null,"name"?: string | null,"organization_id"?: string | null,"paired_at"?: string | null,"paired_by"?: string | null,"pairing_code"?: string | null,"pairing_expires_at"?: string | null,"poll_secret_hash"?: string | null,"revoked_at"?: string | null,"show_ads"?: boolean,"status"?: Database["public"]['Enums']["display_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "displays_organization_id_branch_id_fkey"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
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
                },"invoice_sequences": {
                  Row: {
                    "last_number": number,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "last_number"?: number,"year": number
                  }
                  Update: {
                    "last_number"?: number,"year"?: number
                  }
                  Relationships: [
                    
                  ]
                },"invoices": {
                  Row: {
                    "billing_period": Database["public"]['Enums']["billing_period"],"buyer_snapshot": NonNullable<Json>,"discount_xaf": number,"due_at": string,"id": string,"issued_at": string,"kind": string,"lines": NonNullable<Json>,"number": string,"organization_id": string | null,"paid_at": string | null,"paid_channel": Database["public"]['Enums']["payment_channel"] | null,"period_end": string,"period_start": string,"plan_id": string | null,"seller_snapshot": NonNullable<Json>,"status": Database["public"]['Enums']["invoice_status"],"subscription_id": string | null,"subtotal_xaf": number,"tax_xaf": number,"total_xaf": number,"vat_rate": number
                  }
                  ComputedFields: never
                  Insert: {
                    "billing_period": Database["public"]['Enums']["billing_period"],"buyer_snapshot": NonNullable<Json>,"discount_xaf"?: number,"due_at": string,"id"?: string,"issued_at"?: string,"kind": string,"lines": NonNullable<Json>,"number": string,"organization_id"?: string | null,"paid_at"?: string | null,"paid_channel"?: Database["public"]['Enums']["payment_channel"] | null,"period_end": string,"period_start": string,"plan_id"?: string | null,"seller_snapshot": NonNullable<Json>,"status"?: Database["public"]['Enums']["invoice_status"],"subscription_id"?: string | null,"subtotal_xaf": number,"tax_xaf"?: number,"total_xaf": number,"vat_rate"?: number
                  }
                  Update: {
                    "billing_period"?: Database["public"]['Enums']["billing_period"],"buyer_snapshot"?: NonNullable<Json>,"discount_xaf"?: number,"due_at"?: string,"id"?: string,"issued_at"?: string,"kind"?: string,"lines"?: NonNullable<Json>,"number"?: string,"organization_id"?: string | null,"paid_at"?: string | null,"paid_channel"?: Database["public"]['Enums']["payment_channel"] | null,"period_end"?: string,"period_start"?: string,"plan_id"?: string | null,"seller_snapshot"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["invoice_status"],"subscription_id"?: string | null,"subtotal_xaf"?: number,"tax_xaf"?: number,"total_xaf"?: number,"vat_rate"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "subscriptions"
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
                },"messaging_usage": {
                  Row: {
                    "alerted_at": string | null,"month": string,"organization_id": string,"sms_sent": number,"whatsapp_sent": number
                  }
                  ComputedFields: never
                  Insert: {
                    "alerted_at"?: string | null,"month": string,"organization_id": string,"sms_sent"?: number,"whatsapp_sent"?: number
                  }
                  Update: {
                    "alerted_at"?: string | null,"month"?: string,"organization_id"?: string,"sms_sent"?: number,"whatsapp_sent"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "messaging_usage_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_contacts": {
                  Row: {
                    "appointment_id": string | null,"appointment_request_id": string | null,"branch_id": string,"channel": string,"consent_at": string,"consent_by": string | null,"consent_source": string,"created_at": string,"id": string,"locale": string,"opted_out_at": string | null,"organization_id": string,"phone_e164": string | null,"push_subscription": Json | null,"ticket_id": string | null,"wa_id": string | null,"window_expires_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id"?: string | null,"appointment_request_id"?: string | null,"branch_id": string,"channel": string,"consent_at": string,"consent_by"?: string | null,"consent_source": string,"created_at"?: string,"id"?: string,"locale"?: string,"opted_out_at"?: string | null,"organization_id": string,"phone_e164"?: string | null,"push_subscription"?: Json | null,"ticket_id"?: string | null,"wa_id"?: string | null,"window_expires_at"?: string | null
                  }
                  Update: {
                    "appointment_id"?: string | null,"appointment_request_id"?: string | null,"branch_id"?: string,"channel"?: string,"consent_at"?: string,"consent_by"?: string | null,"consent_source"?: string,"created_at"?: string,"id"?: string,"locale"?: string,"opted_out_at"?: string | null,"organization_id"?: string,"phone_e164"?: string | null,"push_subscription"?: Json | null,"ticket_id"?: string | null,"wa_id"?: string | null,"window_expires_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_contacts_appointment_fkey"
      columns: ["organization_id","appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "notification_contacts_organization_id_branch_id_fkey"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "notification_contacts_organization_id_ticket_id_fkey"
      columns: ["organization_id","ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "notification_contacts_request_fkey"
      columns: ["organization_id","appointment_request_id"]
isOneToOne: false
      referencedRelation: "appointment_requests"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"notification_jobs": {
                  Row: {
                    "appointment_id": string | null,"appointment_request_id": string | null,"attempt": number,"branch_id": string,"channel": Database["public"]['Enums']["notif_channel"],"contact_id": string | null,"created_at": string,"dedupe_key": string,"delivered_at": string | null,"error": string | null,"event": Database["public"]['Enums']["notif_event"],"fallback_of": string | null,"guard": boolean,"id": string,"next_attempt_at": string,"organization_id": string,"payload": NonNullable<Json>,"provider_message_id": string | null,"sent_at": string | null,"status": Database["public"]['Enums']["job_status"],"template_name": string | null,"ticket_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id"?: string | null,"appointment_request_id"?: string | null,"attempt"?: number,"branch_id": string,"channel": Database["public"]['Enums']["notif_channel"],"contact_id"?: string | null,"created_at"?: string,"dedupe_key": string,"delivered_at"?: string | null,"error"?: string | null,"event": Database["public"]['Enums']["notif_event"],"fallback_of"?: string | null,"guard"?: boolean,"id"?: string,"next_attempt_at"?: string,"organization_id": string,"payload"?: NonNullable<Json>,"provider_message_id"?: string | null,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["job_status"],"template_name"?: string | null,"ticket_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "appointment_id"?: string | null,"appointment_request_id"?: string | null,"attempt"?: number,"branch_id"?: string,"channel"?: Database["public"]['Enums']["notif_channel"],"contact_id"?: string | null,"created_at"?: string,"dedupe_key"?: string,"delivered_at"?: string | null,"error"?: string | null,"event"?: Database["public"]['Enums']["notif_event"],"fallback_of"?: string | null,"guard"?: boolean,"id"?: string,"next_attempt_at"?: string,"organization_id"?: string,"payload"?: NonNullable<Json>,"provider_message_id"?: string | null,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["job_status"],"template_name"?: string | null,"ticket_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_jobs_appointment_fkey"
      columns: ["organization_id","appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "notification_jobs_contact_id_fkey"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "notification_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_jobs_fallback_of_fkey"
      columns: ["fallback_of"]
isOneToOne: false
      referencedRelation: "notification_jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_jobs_organization_id_branch_id_fkey"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "notification_jobs_organization_id_ticket_id_fkey"
      columns: ["organization_id","ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "notification_jobs_request_fkey"
      columns: ["organization_id","appointment_request_id"]
isOneToOne: false
      referencedRelation: "appointment_requests"
      referencedColumns: ["organization_id","id"]
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
                    "country": string,"created_at": string,"created_by": string | null,"currency": string,"data_retention_days": number,"default_locale": string,"id": string,"logo_path": string | null,"name": string,"onboarding_step": number,"phone_e164": string | null,"slug": string,"status": Database["public"]['Enums']["org_status"],"suspended_reason": string | null,"type": Database["public"]['Enums']["org_type"],"updated_at": string,"validated_at": string | null,"validated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "country"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"data_retention_days"?: number,"default_locale"?: string,"id"?: string,"logo_path"?: string | null,"name": string,"onboarding_step"?: number,"phone_e164"?: string | null,"slug": string,"status"?: Database["public"]['Enums']["org_status"],"suspended_reason"?: string | null,"type": Database["public"]['Enums']["org_type"],"updated_at"?: string,"validated_at"?: string | null,"validated_by"?: string | null
                  }
                  Update: {
                    "country"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"data_retention_days"?: number,"default_locale"?: string,"id"?: string,"logo_path"?: string | null,"name"?: string,"onboarding_step"?: number,"phone_e164"?: string | null,"slug"?: string,"status"?: Database["public"]['Enums']["org_status"],"suspended_reason"?: string | null,"type"?: Database["public"]['Enums']["org_type"],"updated_at"?: string,"validated_at"?: string | null,"validated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"pay_links": {
                  Row: {
                    "created_at": string,"expires_at": string,"invoice_id": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_at": string,"invoice_id": string,"token_hash": string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"invoice_id"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pay_links_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_xaf": number,"channel": Database["public"]['Enums']["payment_channel"],"confirmed_at": string | null,"created_at": string,"external_id": string,"failure_reason": string | null,"id": string,"invoice_id": string,"last_checked_at": string | null,"msisdn_masked": string,"provider": Database["public"]['Enums']["payment_provider"],"provider_ref": string | null,"raw": Json | null,"status": Database["public"]['Enums']["payment_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_xaf": number,"channel": Database["public"]['Enums']["payment_channel"],"confirmed_at"?: string | null,"created_at"?: string,"external_id": string,"failure_reason"?: string | null,"id"?: string,"invoice_id": string,"last_checked_at"?: string | null,"msisdn_masked": string,"provider": Database["public"]['Enums']["payment_provider"],"provider_ref"?: string | null,"raw"?: Json | null,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string
                  }
                  Update: {
                    "amount_xaf"?: number,"channel"?: Database["public"]['Enums']["payment_channel"],"confirmed_at"?: string | null,"created_at"?: string,"external_id"?: string,"failure_reason"?: string | null,"id"?: string,"invoice_id"?: string,"last_checked_at"?: string | null,"msisdn_masked"?: string,"provider"?: Database["public"]['Enums']["payment_provider"],"provider_ref"?: string | null,"raw"?: Json | null,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"phone_verifications": {
                  Row: {
                    "attempts": number,"code_hash": string | null,"created_at": string,"expires_at": string,"id": string,"phone_e164": string | null,"phone_hash": string,"used_at": string | null,"user_id": string,"verified_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"code_hash"?: string | null,"created_at"?: string,"expires_at": string,"id"?: string,"phone_e164"?: string | null,"phone_hash": string,"used_at"?: string | null,"user_id": string,"verified_at"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"code_hash"?: string | null,"created_at"?: string,"expires_at"?: string,"id"?: string,"phone_e164"?: string | null,"phone_hash"?: string,"used_at"?: string | null,"user_id"?: string,"verified_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"plans": {
                  Row: {
                    "active": boolean,"annual_free_months": number,"base_price_xaf": number,"code": string,"description": string | null,"description_en": string | null,"extra_branch_price_xaf": number | null,"features": NonNullable<Json>,"id": string,"included_branches": number,"max_counters_per_branch": number | null,"max_displays_per_branch": number | null,"name": string,"name_en": string | null,"sort_order": number,"trial_eligible": boolean,"updated_at": string,"whatsapp_quota_per_branch": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"annual_free_months"?: number,"base_price_xaf": number,"code": string,"description"?: string | null,"description_en"?: string | null,"extra_branch_price_xaf"?: number | null,"features"?: NonNullable<Json>,"id"?: string,"included_branches": number,"max_counters_per_branch"?: number | null,"max_displays_per_branch"?: number | null,"name": string,"name_en"?: string | null,"sort_order"?: number,"trial_eligible"?: boolean,"updated_at"?: string,"whatsapp_quota_per_branch"?: number
                  }
                  Update: {
                    "active"?: boolean,"annual_free_months"?: number,"base_price_xaf"?: number,"code"?: string,"description"?: string | null,"description_en"?: string | null,"extra_branch_price_xaf"?: number | null,"features"?: NonNullable<Json>,"id"?: string,"included_branches"?: number,"max_counters_per_branch"?: number | null,"max_displays_per_branch"?: number | null,"name"?: string,"name_en"?: string | null,"sort_order"?: number,"trial_eligible"?: boolean,"updated_at"?: string,"whatsapp_quota_per_branch"?: number
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
                },"platform_settings": {
                  Row: {
                    "company_address": string,"company_email": string,"company_legal_name": string,"company_niu": string,"company_phone": string,"company_rc": string,"default_closing_time": string,"grace_days": number,"id": boolean,"invoice_footer": string,"invoice_lead_days": number,"quota_alert_percent": number,"read_only_days": number,"retention_after_suspension_days": number,"trial_days": number,"updated_at": string,"updated_by": string | null,"vat_rate": number
                  }
                  ComputedFields: never
                  Insert: {
                    "company_address"?: string,"company_email"?: string,"company_legal_name"?: string,"company_niu"?: string,"company_phone"?: string,"company_rc"?: string,"default_closing_time"?: string,"grace_days"?: number,"id"?: boolean,"invoice_footer"?: string,"invoice_lead_days"?: number,"quota_alert_percent"?: number,"read_only_days"?: number,"retention_after_suspension_days"?: number,"trial_days"?: number,"updated_at"?: string,"updated_by"?: string | null,"vat_rate"?: number
                  }
                  Update: {
                    "company_address"?: string,"company_email"?: string,"company_legal_name"?: string,"company_niu"?: string,"company_phone"?: string,"company_rc"?: string,"default_closing_time"?: string,"grace_days"?: number,"id"?: boolean,"invoice_footer"?: string,"invoice_lead_days"?: number,"quota_alert_percent"?: number,"read_only_days"?: number,"retention_after_suspension_days"?: number,"trial_days"?: number,"updated_at"?: string,"updated_by"?: string | null,"vat_rate"?: number
                  }
                  Relationships: [
                    
                  ]
                },"practitioner_absences": {
                  Row: {
                    "branch_id": string,"created_at": string,"declared_by": string | null,"ended_at": string | null,"id": string,"kind": Database["public"]['Enums']["absence_kind"],"organization_id": string,"practitioner_id": string,"reason": string | null,"starts_at": string,"until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"created_at"?: string,"declared_by"?: string | null,"ended_at"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["absence_kind"],"organization_id": string,"practitioner_id": string,"reason"?: string | null,"starts_at"?: string,"until"?: string | null
                  }
                  Update: {
                    "branch_id"?: string,"created_at"?: string,"declared_by"?: string | null,"ended_at"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["absence_kind"],"organization_id"?: string,"practitioner_id"?: string,"reason"?: string | null,"starts_at"?: string,"until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "practitioner_absences_organization_id_branch_id_fkey"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "practitioner_absences_organization_id_practitioner_id_fkey"
      columns: ["organization_id","practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioners"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"practitioner_leaves": {
                  Row: {
                    "branch_id": string,"created_at": string,"created_by": string | null,"ends_on": string,"id": string,"organization_id": string,"practitioner_id": string,"reason": string | null,"starts_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"created_at"?: string,"created_by"?: string | null,"ends_on": string,"id"?: string,"organization_id": string,"practitioner_id": string,"reason"?: string | null,"starts_on": string
                  }
                  Update: {
                    "branch_id"?: string,"created_at"?: string,"created_by"?: string | null,"ends_on"?: string,"id"?: string,"organization_id"?: string,"practitioner_id"?: string,"reason"?: string | null,"starts_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "practitioner_leaves_organization_id_branch_id_fkey"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "practitioner_leaves_organization_id_practitioner_id_fkey"
      columns: ["organization_id","practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioners"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"practitioner_schedules": {
                  Row: {
                    "branch_id": string,"created_at": string,"ends_at": string,"id": string,"organization_id": string,"practitioner_id": string,"service_id": string,"slot_minutes": number,"starts_at": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"created_at"?: string,"ends_at": string,"id"?: string,"organization_id": string,"practitioner_id": string,"service_id": string,"slot_minutes": number,"starts_at": string,"weekday": number
                  }
                  Update: {
                    "branch_id"?: string,"created_at"?: string,"ends_at"?: string,"id"?: string,"organization_id"?: string,"practitioner_id"?: string,"service_id"?: string,"slot_minutes"?: number,"starts_at"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "practitioner_schedules_organization_id_branch_id_fkey"
      columns: ["organization_id","branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "practitioner_schedules_organization_id_practitioner_id_fkey"
      columns: ["organization_id","practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioners"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "practitioner_schedules_organization_id_service_id_fkey"
      columns: ["organization_id","service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["organization_id","id"]
    }
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
                },"provider_webhook_events": {
                  Row: {
                    "event_id": string,"id": string,"payload": NonNullable<Json>,"processed_at": string | null,"provider": string,"received_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"id"?: string,"payload": NonNullable<Json>,"processed_at"?: string | null,"provider": string,"received_at"?: string
                  }
                  Update: {
                    "event_id"?: string,"id"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"provider"?: string,"received_at"?: string
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
                },"subscription_events": {
                  Row: {
                    "actor_user_id": string | null,"created_at": string,"id": number,"organization_id": string | null,"payload": NonNullable<Json>,"subscription_id": string | null,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_user_id"?: string | null,"created_at"?: string,"id"?: never,"organization_id"?: string | null,"payload"?: NonNullable<Json>,"subscription_id"?: string | null,"type": string
                  }
                  Update: {
                    "actor_user_id"?: string | null,"created_at"?: string,"id"?: never,"organization_id"?: string | null,"payload"?: NonNullable<Json>,"subscription_id"?: string | null,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscription_events_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscription_events_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "subscriptions"
      referencedColumns: ["id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "billing_email": string | null,"billing_period": Database["public"]['Enums']["billing_period"],"billing_phone_e164": string | null,"created_at": string,"current_period_end": string | null,"current_period_start": string | null,"deletion_due_at": string | null,"discount_id": string | null,"grace_ends_at": string | null,"id": string,"locale": string,"next_plan_id": string | null,"organization_id": string,"pending_status": Database["public"]['Enums']["subscription_status"] | null,"pending_status_after": string | null,"plan_id": string,"read_only_since": string | null,"status": Database["public"]['Enums']["subscription_status"],"suspended_since": string | null,"trial_ends_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "billing_email"?: string | null,"billing_period"?: Database["public"]['Enums']["billing_period"],"billing_phone_e164"?: string | null,"created_at"?: string,"current_period_end"?: string | null,"current_period_start"?: string | null,"deletion_due_at"?: string | null,"discount_id"?: string | null,"grace_ends_at"?: string | null,"id"?: string,"locale"?: string,"next_plan_id"?: string | null,"organization_id": string,"pending_status"?: Database["public"]['Enums']["subscription_status"] | null,"pending_status_after"?: string | null,"plan_id": string,"read_only_since"?: string | null,"status": Database["public"]['Enums']["subscription_status"],"suspended_since"?: string | null,"trial_ends_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "billing_email"?: string | null,"billing_period"?: Database["public"]['Enums']["billing_period"],"billing_phone_e164"?: string | null,"created_at"?: string,"current_period_end"?: string | null,"current_period_start"?: string | null,"deletion_due_at"?: string | null,"discount_id"?: string | null,"grace_ends_at"?: string | null,"id"?: string,"locale"?: string,"next_plan_id"?: string | null,"organization_id"?: string,"pending_status"?: Database["public"]['Enums']["subscription_status"] | null,"pending_status_after"?: string | null,"plan_id"?: string,"read_only_since"?: string | null,"status"?: Database["public"]['Enums']["subscription_status"],"suspended_since"?: string | null,"trial_ends_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_discount_id_fkey"
      columns: ["discount_id"]
isOneToOne: false
      referencedRelation: "discounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_next_plan_id_fkey"
      columns: ["next_plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: true
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
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
                    "appointment_id": string | null,"branch_id": string,"called_at": string | null,"counter_id": string | null,"created_at": string,"created_by": string | null,"customer_user_id": string | null,"delay_count": number,"display_code": string,"finished_at": string | null,"id": string,"is_remote": boolean,"number": number,"on_my_way_at": string | null,"organization_id": string,"preferred_counter_id": string | null,"presence_confirmed_at": string | null,"priority_level": number,"priority_reason": Database["public"]['Enums']["priority_reason"] | null,"public_token": string | null,"rated_at": string | null,"rating": number | null,"rating_comment": string | null,"recall_count": number,"recalled_at": string | null,"remote_travel_seconds": number | null,"service_day": string,"service_id": string,"serving_started_at": string | null,"sort_key": number,"source": Database["public"]['Enums']["ticket_source"],"status": Database["public"]['Enums']["ticket_status"],"transferred_from_id": string | null,"updated_at": string,"finish_ticket_internal": {
              "appointment_id": string | null,
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
"on_my_way_at": string | null,
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
"remote_travel_seconds": number | null,
"service_day": string,
"service_id": string,
"serving_started_at": string | null,
"sort_key": number,
"source": Database["public"]['Enums']["ticket_source"],
"status": Database["public"]['Enums']["ticket_status"],
"transferred_from_id": string | null,
"updated_at": string
            } | null,"penalize_remote_ticket": undefined | null,"staff_ticket_json": Json | null
                  }
                  ComputedFields: "finish_ticket_internal" | "penalize_remote_ticket" | "staff_ticket_json"
                  Insert: {
                    "appointment_id"?: string | null,"branch_id": string,"called_at"?: string | null,"counter_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_user_id"?: string | null,"delay_count"?: number,"display_code": string,"finished_at"?: string | null,"id"?: string,"is_remote"?: boolean,"number": number,"on_my_way_at"?: string | null,"organization_id": string,"preferred_counter_id"?: string | null,"presence_confirmed_at"?: string | null,"priority_level"?: number,"priority_reason"?: Database["public"]['Enums']["priority_reason"] | null,"public_token"?: string | null,"rated_at"?: string | null,"rating"?: number | null,"rating_comment"?: string | null,"recall_count"?: number,"recalled_at"?: string | null,"remote_travel_seconds"?: number | null,"service_day": string,"service_id": string,"serving_started_at"?: string | null,"sort_key": number,"source": Database["public"]['Enums']["ticket_source"],"status"?: Database["public"]['Enums']["ticket_status"],"transferred_from_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "appointment_id"?: string | null,"branch_id"?: string,"called_at"?: string | null,"counter_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_user_id"?: string | null,"delay_count"?: number,"display_code"?: string,"finished_at"?: string | null,"id"?: string,"is_remote"?: boolean,"number"?: number,"on_my_way_at"?: string | null,"organization_id"?: string,"preferred_counter_id"?: string | null,"presence_confirmed_at"?: string | null,"priority_level"?: number,"priority_reason"?: Database["public"]['Enums']["priority_reason"] | null,"public_token"?: string | null,"rated_at"?: string | null,"rating"?: number | null,"rating_comment"?: string | null,"recall_count"?: number,"recalled_at"?: string | null,"remote_travel_seconds"?: number | null,"service_day"?: string,"service_id"?: string,"serving_started_at"?: string | null,"sort_key"?: number,"source"?: Database["public"]['Enums']["ticket_source"],"status"?: Database["public"]['Enums']["ticket_status"],"transferred_from_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tickets_appointment_fkey"
      columns: ["organization_id","appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["organization_id","id"]
    },{
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
                },"trial_claims": {
                  Row: {
                    "claimed_at": string,"organization_id": string | null,"phone_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claimed_at"?: string,"organization_id"?: string | null,"phone_hash": string
                  }
                  Update: {
                    "claimed_at"?: string,"organization_id"?: string | null,"phone_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trial_claims_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: true
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"whatsapp_opt_outs": {
                  Row: {
                    "opted_out_at": string,"phone_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "opted_out_at"?: string,"phone_hash": string
                  }
                  Update: {
                    "opted_out_at"?: string,"phone_hash"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_appointment_request":
{ Args: { "p_practitioner": string,"p_request": string,"p_starts_at": string }; Returns: Json
                           },
"accept_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"active_discount":
{ Args: { "p_org": string }; Returns: {
              "code": string | null,
"created_at": string,
"created_by": string | null,
"expires_at": string | null,
"id": string,
"kind": string,
"organization_id": string | null,
"reason": string | null,
"remaining_invoices": number,
"value": number
            }
                          SetofOptions: {
        from: "*"
        to: "discounts"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_apply_discount":
{ Args: { "p_invoices": number,"p_kind": string,"p_org": string,"p_reason": string,"p_value": number }; Returns: string
                           },
"admin_change_plan":
{ Args: { "p_plan": string,"p_reason": string,"p_subscription": string }; Returns: undefined
                           },
"admin_grant_days":
{ Args: { "p_days": number,"p_reason": string,"p_subscription": string }; Returns: Json
                           },
"admin_revenue":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_set_suspension":
{ Args: { "p_org": string,"p_reason": string,"p_suspended": boolean }; Returns: undefined
                           },
"admin_subscription_detail":
{ Args: { "p_subscription": string }; Returns: Json
                           },
"admin_subscriptions":
{ Args: { "p_query"?: string,"p_status"?: string }; Returns: Json
                           },
"admin_update_plan":
{ Args: { "p_fields": Json,"p_plan": string }; Returns: undefined
                           },
"admin_update_settings":
{ Args: { "p_fields": Json }; Returns: undefined
                           },
"admit_ticket":
{ Args: { "p_client_op_id"?: string,"p_ticket": string }; Returns: Json
                           },
"apply_pending_transitions":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"apply_subscription_status":
{ Args: { "p_status": Database["public"]['Enums']["subscription_status"],"p_sub": string }; Returns: undefined
                           },
"appointment_json":
{ Args: { "p_appointment": string }; Returns: Json
                           },
"appointment_notification_view":
{ Args: { "p_appointment": string }; Returns: Json
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
"assert_feature":
{ Args: { "p_feature": string,"p_org": string }; Returns: undefined
                           },
"assert_org_admin":
{ Args: { "p_org": string }; Returns: undefined
                           },
"assert_platform_admin":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"assert_request_allowed":
{ Args: { "p_branch": string,"p_exclude": string,"p_phone": string,"p_slot": string }; Returns: undefined
                           },
"assert_requests_open":
{ Args: { "p_branch": string }; Returns: {
              "almost_turn_threshold": number,
"appointment_early_minutes": number,
"appointment_late_grace_minutes": number,
"appointment_mode": string,
"appointment_no_show_minutes": number,
"appointment_request_days": number,
"appointment_request_max_pending": number,
"appointment_requests_enabled": boolean,
"appointment_walkin_ratio": number,
"branch_id": string,
"max_active_tickets_per_customer": number,
"organization_id": string,
"priorities_enabled": boolean,
"public_listing_enabled": boolean,
"rating_enabled": boolean,
"remote_confirm_threshold": number,
"remote_leave_margin_minutes": number,
"remote_max_delays": number,
"remote_max_distance_km": number | null,
"remote_penalty_places": number,
"remote_tickets_enabled": boolean,
"remote_travel_kmh": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "branch_settings"
        isOneToOne: true
        isSetofReturn: false
      } },
"assert_stats_access":
{ Args: { "p_branch": string,"p_org": string }; Returns: undefined
                           },
"audit":
{ Args: { "p_action": string,"p_diff"?: Json,"p_entity_id": string,"p_entity_type": string,"p_ip_hash"?: string,"p_org": string }; Returns: undefined
                           },
"available_slots":
{ Args: { "p_days"?: number,"p_from": string,"p_practitioner": string }; Returns: Json
                           },
"billable_branches":
{ Args: { "p_org": string }; Returns: number
                           },
"billing_checkout":
{ Args: { "p_org": string,"p_period": Database["public"]['Enums']["billing_period"],"p_plan": string }; Returns: Json
                           },
"billing_daily":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"billing_overview":
{ Args: { "p_org": string }; Returns: Json
                           },
"book_appointment":
{ Args: { "p_consent"?: boolean,"p_customer_label"?: string,"p_locale"?: string,"p_phone_e164"?: string,"p_practitioner": string,"p_rescheduled_from"?: string,"p_starts_at": string }; Returns: Json
                           },
"branch_board":
{ Args: { "p_branch": string }; Returns: Json
                           },
"branch_is_open":
{ Args: { "p_at"?: string,"p_branch": string }; Returns: boolean
                           },
"branch_public":
{ Args: { "p_branch": string }; Returns: Json
                           },
"branch_service_day":
{ Args: { "p_branch": string }; Returns: string
                           },
"branch_summary":
{ Args: { "p_branch": string,"p_distance_m": number }; Returns: Json
                           },
"broadcast":
{ Args: { "p_event": string,"p_payload": Json,"p_private": boolean,"p_topic": string }; Returns: undefined
                           },
"broadcast_branch":
{ Args: { "p_branch": string }; Returns: undefined
                           },
"broadcast_practitioner_tickets":
{ Args: { "p_practitioner": string }; Returns: undefined
                           },
"call_next":
{ Args: { "p_client_op_id"?: string,"p_counter": string,"p_finish_current"?: boolean }; Returns: Json
                           },
"call_ticket":
{ Args: { "p_client_op_id"?: string,"p_counter": string,"p_finish_current"?: boolean,"p_ticket": string }; Returns: Json
                           },
"call_ticket_internal":
{ Args: { "p_counter": string,"p_ticket": Omit<Database["public"]['Tables']["tickets"]['Row'], Database["public"]['Tables']["tickets"]['ComputedFields']> }; Returns: Json
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
"cancel_appointment":
{ Args: { "p_appointment": string,"p_reason"?: string }; Returns: Json
                           },
"cancel_appointment_reminders":
{ Args: { "p_appointment": string }; Returns: undefined
                           },
"cancel_my_appointment_request":
{ Args: { "p_token": string }; Returns: Json
                           },
"cancel_my_ticket":
{ Args: { "p_token": string }; Returns: Json
                           },
"cancel_ticket":
{ Args: { "p_client_op_id"?: string,"p_ticket": string }; Returns: Json
                           },
"check_in_appointment":
{ Args: { "p_appointment": string }; Returns: Json
                           },
"check_rate_limit":
{ Args: { "p_key": string,"p_max": number,"p_window": string }; Returns: boolean
                           },
"claim_account_messages":
{ Args: { "p_limit"?: number }; Returns: {
              "attempt": number,
"channel": string,
"created_at": string,
"dedupe_key": string,
"error": string | null,
"id": string,
"kind": string,
"locale": string,
"next_attempt_at": string,
"organization_id": string | null,
"payload": NonNullable<Json>,
"sent_at": string | null,
"status": string,
"to_email": string | null,
"to_phone": string | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "account_messages"
        isOneToOne: false
        isSetofReturn: true
      } },
"claim_notification_jobs":
{ Args: { "p_limit"?: number }; Returns: Json
                           },
"clear_phone_code":
{ Args: { "p_verification": string }; Returns: undefined
                           },
"clear_request_codes":
{ Args: { "p_request": string }; Returns: undefined
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
"complete_account_message":
{ Args: { "p_error"?: string,"p_message": string,"p_retry_in_seconds"?: number,"p_status": string }; Returns: undefined
                           },
"complete_notification_job":
{ Args: { "p_error"?: string,"p_job": string,"p_payload"?: Json,"p_provider_message_id"?: string,"p_retry_in_seconds"?: number,"p_status": Database["public"]['Enums']["job_status"],"p_template_name"?: string }; Returns: undefined
                           },
"compute_branch_stats":
{ Args: { "p_branch": string,"p_day": string }; Returns: {
              "appointment": number,
"branch_id": string,
"cancelled": number,
"day": string,
"hourly": (number)[],
"issued": number,
"max_wait_seconds": number,
"no_show": number,
"organization_id": string,
"rating_count": number,
"rating_sum": number,
"remote": number,
"served": number,
"service_count": number,
"service_id": string,
"service_seconds_sum": number,
"transferred": number,
"updated_at": string,
"wait_count": number,
"wait_seconds_sum": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "daily_branch_stats"
        isOneToOne: false
        isSetofReturn: true
      } },
"compute_counter_stats":
{ Args: { "p_branch": string,"p_day": string }; Returns: {
              "branch_id": string,
"called": number,
"counter_id": string,
"day": string,
"no_show": number,
"open_seconds": number,
"organization_id": string,
"pause_seconds": number,
"practitioner_id": string | null,
"rating_count": number,
"rating_sum": number,
"served": number,
"service_count": number,
"service_seconds_sum": number,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "daily_counter_stats"
        isOneToOne: false
        isSetofReturn: true
      } },
"configure_notification_dispatch":
{ Args: { "p_secret": string,"p_url": string }; Returns: undefined
                           },
"confirm_payment":
{ Args: { "p_external_id": string,"p_failure"?: string,"p_provider_ref"?: string,"p_raw"?: Json,"p_status": Database["public"]['Enums']["payment_status"] }; Returns: Json
                           },
"confirm_presence":
{ Args: { "p_entry_code": string,"p_token": string }; Returns: Json
                           },
"count_messaging_usage":
{ Args: { "p_channel": Database["public"]['Enums']["notif_channel"],"p_org": string }; Returns: undefined
                           },
"create_appointment_request":
{ Args: { "p_branch": string,"p_customer": string,"p_day": string,"p_label": string,"p_locale": string,"p_period": string,"p_phone_e164": string,"p_practitioner": string,"p_service": string,"p_starts_at": string }; Returns: Json
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
"create_pay_link":
{ Args: { "p_invoice": string }; Returns: string
                           },
"dashboard_stats":
{ Args: { "p_branch": string,"p_compare_from"?: string,"p_compare_to"?: string,"p_from": string,"p_org": string,"p_to": string }; Returns: Json
                           },
"declare_practitioner_absence":
{ Args: { "p_kind": Database["public"]['Enums']["absence_kind"],"p_practitioner": string,"p_reason"?: string,"p_until"?: string }; Returns: Json
                           },
"decline_appointment_request":
{ Args: { "p_reason"?: string,"p_request": string }; Returns: Json
                           },
"disable_push_contact":
{ Args: { "p_contact": string }; Returns: undefined
                           },
"effective_duration_seconds":
{ Args: { "p_default": number,"p_ewma": number,"p_samples": number }; Returns: number
                           },
"end_practitioner_absence":
{ Args: { "p_absence": string }; Returns: Json
                           },
"enqueue_account_message":
{ Args: { "p_dedupe": string,"p_email": string,"p_kind": string,"p_locale": string,"p_org": string,"p_payload": Json,"p_phone": string }; Returns: number
                           },
"enqueue_almost_your_turn":
{ Args: { "p_service": string }; Returns: undefined
                           },
"enqueue_appointment_notification":
{ Args: { "p_appointment": string,"p_at"?: string,"p_dedupe": string,"p_event": Database["public"]['Enums']["notif_event"] }; Returns: number
                           },
"enqueue_remote_notices":
{ Args: { "p_service"?: string }; Returns: number
                           },
"enqueue_ticket_notification":
{ Args: { "p_dedupe": string,"p_event": Database["public"]['Enums']["notif_event"],"p_payload"?: Json,"p_status"?: Database["public"]['Enums']["job_status"],"p_ticket": string }; Returns: number
                           },
"estimate_wait_seconds":
{ Args: { "p_ahead": number,"p_busy": (number)[],"p_durations": (number)[] }; Returns: number
                           },
"expire_stale_tickets":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"fair_pick":
{ Args: { "p_candidates": Json,"p_early": number,"p_mode": string,"p_now": string,"p_ratio": number,"p_since": number }; Returns: string
                           },
"finish_ticket":
{ Args: { "p_client_op_id"?: string,"p_ticket": string }; Returns: Json
                           },
"finish_ticket_internal":
{ Args: { "p_ticket": Omit<Database["public"]['Tables']["tickets"]['Row'], Database["public"]['Tables']["tickets"]['ComputedFields']> }; Returns: {
              "appointment_id": string | null,
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
"on_my_way_at": string | null,
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
"remote_travel_seconds": number | null,
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
"get_appointment_request":
{ Args: { "p_token": string }; Returns: Json
                           },
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
              "appointment_id": string | null,
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
"on_my_way_at": string | null,
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
"remote_travel_seconds": number | null,
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
"invoice_document":
{ Args: { "p_invoice": string }; Returns: Json
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
"issue_invoice":
{ Args: { "p_period"?: Database["public"]['Enums']["billing_period"],"p_plan"?: string,"p_subscription": string }; Returns: {
              "billing_period": Database["public"]['Enums']["billing_period"],
"buyer_snapshot": NonNullable<Json>,
"discount_xaf": number,
"due_at": string,
"id": string,
"issued_at": string,
"kind": string,
"lines": NonNullable<Json>,
"number": string,
"organization_id": string | null,
"paid_at": string | null,
"paid_channel": Database["public"]['Enums']["payment_channel"] | null,
"period_end": string,
"period_start": string,
"plan_id": string | null,
"seller_snapshot": NonNullable<Json>,
"status": Database["public"]['Enums']["invoice_status"],
"subscription_id": string | null,
"subtotal_xaf": number,
"tax_xaf": number,
"total_xaf": number,
"vat_rate": number
            }
                          SetofOptions: {
        from: "*"
        to: "invoices"
        isOneToOne: true
        isSetofReturn: false
      } },
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
"issue_request_code":
{ Args: { "p_request": string }; Returns: undefined
                           },
"jsonb_row_diff":
{ Args: { "p_new": Json,"p_old": Json }; Returns: Json
                           },
"kick_notification_dispatch":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"list_appointment_requests":
{ Args: { "p_branch": string,"p_pending"?: boolean }; Returns: Json
                           },
"list_appointments":
{ Args: { "p_branch": string,"p_from": string,"p_practitioner"?: string,"p_to": string }; Returns: Json
                           },
"list_org_members":
{ Args: { "p_org": string }; Returns: {
              "active": boolean,"branch_id": string,"created_at": string,"email": string,"full_name": string,"membership_id": string,"role": Database["public"]['Enums']["member_role"],"user_id": string
            }[]
                           },
"lock_appointment":
{ Args: { "p_allowed": (Database["public"]['Enums']["appointment_status"])[],"p_appointment": string }; Returns: {
              "booked_by": string | null,
"branch_id": string,
"cancel_reason": string | null,
"checked_in_at": string | null,
"created_at": string,
"customer_label": string | null,
"ends_at": string,
"id": string,
"locale": string,
"organization_id": string,
"phone_e164": string | null,
"practitioner_id": string,
"rescheduled_from_id": string | null,
"service_id": string,
"starts_at": string,
"status": Database["public"]['Enums']["appointment_status"],
"ticket_id": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"lock_counter_for_call":
{ Args: { "p_counter": string,"p_finish_current": boolean }; Returns: {
              "active": boolean,
"branch_id": string,
"created_at": string,
"current_agent_id": string | null,
"default_practitioner_id": string | null,
"fairness_day": string | null,
"fairness_walkins": number | null,
"id": string,
"kind": Database["public"]['Enums']["counter_kind"],
"label": string | null,
"number": number,
"organization_id": string,
"sort_order": number,
"status": Database["public"]['Enums']["counter_status"],
"status_changed_at": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "counters"
        isOneToOne: true
        isSetofReturn: false
      } },
"lock_pending_request":
{ Args: { "p_request": string }; Returns: {
              "appointment_id": string | null,
"branch_id": string,
"code_attempts": number,
"code_expires_at": string | null,
"code_hash": string | null,
"codes_sent": number,
"created_at": string,
"customer_label": string | null,
"customer_user_id": string | null,
"decline_reason": string | null,
"handled_at": string | null,
"handled_by": string | null,
"id": string,
"locale": string,
"organization_id": string,
"phone_e164": string | null,
"practitioner_id": string | null,
"preferred_day": string | null,
"preferred_period": string | null,
"preferred_starts_at": string | null,
"public_token": string,
"service_id": string,
"status": Database["public"]['Enums']["appointment_request_status"],
"updated_at": string,
"verified_at": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "appointment_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"lock_remote_ticket":
{ Args: { "p_token": string }; Returns: {
              "appointment_id": string | null,
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
"on_my_way_at": string | null,
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
"remote_travel_seconds": number | null,
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
"lock_request_by_token":
{ Args: { "p_token": string }; Returns: {
              "appointment_id": string | null,
"branch_id": string,
"code_attempts": number,
"code_expires_at": string | null,
"code_hash": string | null,
"codes_sent": number,
"created_at": string,
"customer_label": string | null,
"customer_user_id": string | null,
"decline_reason": string | null,
"handled_at": string | null,
"handled_by": string | null,
"id": string,
"locale": string,
"organization_id": string,
"phone_e164": string | null,
"practitioner_id": string | null,
"preferred_day": string | null,
"preferred_period": string | null,
"preferred_starts_at": string | null,
"public_token": string,
"service_id": string,
"status": Database["public"]['Enums']["appointment_request_status"],
"updated_at": string,
"verified_at": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "appointment_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"lock_staff_ticket":
{ Args: { "p_allowed": (Database["public"]['Enums']["ticket_status"])[],"p_ticket": string }; Returns: {
              "appointment_id": string | null,
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
"on_my_way_at": string | null,
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
"remote_travel_seconds": number | null,
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
"mark_appointment_no_show":
{ Args: { "p_appointment": string }; Returns: Json
                           },
"mark_no_show":
{ Args: { "p_client_op_id"?: string,"p_ticket": string }; Returns: Json
                           },
"mask_phone":
{ Args: { "p_phone": string }; Returns: string
                           },
"move_back_ticket":
{ Args: { "p_places": number,"p_ticket": string }; Returns: Json
                           },
"nearby_branches":
{ Args: { "p_lat"?: number,"p_limit"?: number,"p_lng"?: number,"p_query"?: string,"p_radius_km"?: number }; Returns: Json
                           },
"next_ticket_number":
{ Args: { "p_day": string,"p_service": string }; Returns: number
                           },
"notification_dispatch_tick":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"open_counter":
{ Args: { "p_counter": string }; Returns: Json
                           },
"org_closing_time":
{ Args: { "p_org": string }; Returns: string
                           },
"org_entitlements":
{ Args: { "p_org": string }; Returns: Json
                           },
"org_has_open_branch":
{ Args: { "p_org": string }; Returns: boolean
                           },
"pair_display":
{ Args: { "p_branch": string,"p_code": string,"p_name": string,"p_service_ids"?: (string)[],"p_show_ads"?: boolean }; Returns: string
                           },
"pause_counter":
{ Args: { "p_counter": string }; Returns: Json
                           },
"pay_invoice_view":
{ Args: { "p_token": string }; Returns: Json
                           },
"payments_to_recheck":
{ Args: { "p_limit"?: number }; Returns: {
              "amount_xaf": number,
"channel": Database["public"]['Enums']["payment_channel"],
"confirmed_at": string | null,
"created_at": string,
"external_id": string,
"failure_reason": string | null,
"id": string,
"invoice_id": string,
"last_checked_at": string | null,
"msisdn_masked": string,
"provider": Database["public"]['Enums']["payment_provider"],
"provider_ref": string | null,
"raw": Json | null,
"status": Database["public"]['Enums']["payment_status"],
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "payments"
        isOneToOne: false
        isSetofReturn: true
      } },
"penalize_remote_ticket":
{ Args: { "p_row": Omit<Database["public"]['Tables']["tickets"]['Row'], Database["public"]['Tables']["tickets"]['ComputedFields']> }; Returns: undefined
                           },
"phone_fingerprint":
{ Args: { "p_phone": string }; Returns: string
                           },
"pick_next_ticket":
{ Args: { "p_counter": string }; Returns: {
              "appointment_id": string | null,
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
"on_my_way_at": string | null,
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
"remote_travel_seconds": number | null,
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
"practitioner_absence_now":
{ Args: { "p_practitioner": string }; Returns: {
              "branch_id": string,
"created_at": string,
"declared_by": string | null,
"ended_at": string | null,
"id": string,
"kind": Database["public"]['Enums']["absence_kind"],
"organization_id": string,
"practitioner_id": string,
"reason": string | null,
"starts_at": string,
"until": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "practitioner_absences"
        isOneToOne: true
        isSetofReturn: false
      } },
"practitioner_counter":
{ Args: { "p_practitioner": string }; Returns: string
                           },
"practitioner_free_slots":
{ Args: { "p_days"?: number,"p_from": string,"p_practitioner": string }; Returns: {
              "ends_at": string,"service_id": string,"starts_at": string
            }[]
                           },
"practitioner_label":
{ Args: { "p_practitioner": string }; Returns: string
                           },
"practitioner_late_until":
{ Args: { "p_practitioner": string }; Returns: string
                           },
"purge_billing_personal_data":
{ Args: Record<PropertyKey, never>; Returns: undefined
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
{ Args: { "p_client_op_id"?: string,"p_consent"?: boolean,"p_locale"?: string,"p_phone_e164"?: string,"p_practitioner"?: string,"p_priority_reason"?: Database["public"]['Enums']["priority_reason"],"p_service": string }; Returns: Json
                           },
"record_service_duration":
{ Args: { "p_counter": string,"p_org": string,"p_seconds": number,"p_service": string }; Returns: undefined
                           },
"record_webhook_event":
{ Args: { "p_event_id": string,"p_payload": Json,"p_provider": string }; Returns: boolean
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
"register_push_contact":
{ Args: { "p_locale"?: string,"p_subscription": Json,"p_token": string }; Returns: Json
                           },
"remote_travel_seconds":
{ Args: { "p_distance_m": number,"p_kmh": number }; Returns: number
                           },
"request_notification_view":
{ Args: { "p_request": string }; Returns: Json
                           },
"request_options":
{ Args: { "p_branch": string }; Returns: Json
                           },
"request_phone_code":
{ Args: { "p_locale"?: string,"p_phone": string,"p_user": string }; Returns: string
                           },
"request_slot_key":
{ Args: { "p_day": string,"p_period": string,"p_starts_at": string }; Returns: string
                           },
"request_staff_json":
{ Args: { "p_request": string }; Returns: Json
                           },
"request_view":
{ Args: { "p_request": string }; Returns: Json
                           },
"reroute_counter":
{ Args: { "p_practitioner": string }; Returns: string
                           },
"reschedule_appointment":
{ Args: { "p_appointment": string,"p_practitioner"?: string,"p_starts_at": string }; Returns: Json
                           },
"resend_request_code":
{ Args: { "p_token": string }; Returns: Json
                           },
"resolve_entry":
{ Args: { "p_code": string }; Returns: Json
                           },
"revoke_display":
{ Args: { "p_display": string }; Returns: undefined
                           },
"rollup_daily_stats":
{ Args: { "p_day"?: string }; Returns: number
                           },
"rollup_daily_stats_range":
{ Args: { "p_from": string,"p_to": string }; Returns: number
                           },
"schedule_appointment_notifications":
{ Args: { "p_appointment": string,"p_first": Database["public"]['Enums']["notif_event"] }; Returns: undefined
                           },
"schedule_sms_fallback":
{ Args: { "p_delay_seconds"?: number,"p_guard"?: boolean,"p_job": string }; Returns: string
                           },
"self_service_signup":
{ Args: { "p_default_locale": string,"p_name": string,"p_slug": string,"p_type": Database["public"]['Enums']["org_type"],"p_verification": string }; Returns: Json
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
"set_onboarding_step":
{ Args: { "p_org": string,"p_step": number }; Returns: undefined
                           },
"set_remote_travel":
{ Args: { "p_minutes": number,"p_token": string }; Returns: Json
                           },
"set_ticket_priority":
{ Args: { "p_reason": Database["public"]['Enums']["priority_reason"],"p_ticket": string }; Returns: Json
                           },
"sha256_hex":
{ Args: { "p_text": string }; Returns: string
                           },
"shares_org_with":
{ Args: { "p_user": string }; Returns: boolean
                           },
"shift_ticket_back":
{ Args: { "p_places": number,"p_row": Omit<Database["public"]['Tables']["tickets"]['Row'], Database["public"]['Tables']["tickets"]['ComputedFields']> }; Returns: {
              "appointment_id": string | null,
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
"on_my_way_at": string | null,
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
"remote_travel_seconds": number | null,
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
"signal_on_my_way":
{ Args: { "p_token": string }; Returns: Json
                           },
"staff_confirm_presence":
{ Args: { "p_ticket": string }; Returns: Json
                           },
"staff_entitlements":
{ Args: { "p_org": string }; Returns: Json
                           },
"staff_ticket_command":
{ Args: { "p_client_op_id"?: string,"p_command": string,"p_ticket": string }; Returns: Json
                           },
"staff_ticket_json":
{ Args: { "p_ticket": Omit<Database["public"]['Tables']["tickets"]['Row'], Database["public"]['Tables']["tickets"]['ComputedFields']> }; Returns: Json
                           },
"start_payment":
{ Args: { "p_channel": Database["public"]['Enums']["payment_channel"],"p_msisdn": string,"p_provider": Database["public"]['Enums']["payment_provider"],"p_token": string }; Returns: Json
                           },
"stats_branch_rows":
{ Args: { "p_branch": string,"p_from": string,"p_org": string,"p_to": string }; Returns: {
              "appointment": number,
"branch_id": string,
"cancelled": number,
"day": string,
"hourly": (number)[],
"issued": number,
"max_wait_seconds": number,
"no_show": number,
"organization_id": string,
"rating_count": number,
"rating_sum": number,
"remote": number,
"served": number,
"service_count": number,
"service_id": string,
"service_seconds_sum": number,
"transferred": number,
"updated_at": string,
"wait_count": number,
"wait_seconds_sum": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "daily_branch_stats"
        isOneToOne: false
        isSetofReturn: true
      } },
"stats_counter_rows":
{ Args: { "p_branch": string,"p_from": string,"p_org": string,"p_to": string }; Returns: {
              "branch_id": string,
"called": number,
"counter_id": string,
"day": string,
"no_show": number,
"open_seconds": number,
"organization_id": string,
"pause_seconds": number,
"practitioner_id": string | null,
"rating_count": number,
"rating_sum": number,
"served": number,
"service_count": number,
"service_seconds_sum": number,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "daily_counter_stats"
        isOneToOne: false
        isSetofReturn: true
      } },
"stats_export":
{ Args: { "p_branch": string,"p_from": string,"p_kind": string,"p_org": string,"p_to": string }; Returns: Json
                           },
"stats_totals":
{ Args: { "p_branch": string,"p_from": string,"p_org": string,"p_to": string }; Returns: Json
                           },
"subscription_price":
{ Args: { "p_base": number,"p_branches": number,"p_discount_kind"?: string,"p_discount_value"?: number,"p_extra": number,"p_free_months": number,"p_included": number,"p_period": Database["public"]['Enums']["billing_period"] }; Returns: Json
                           },
"subscription_target_status":
{ Args: { "p_now": string,"p_s": Omit<Database["public"]['Tables']["subscriptions"]['Row'], Database["public"]['Tables']["subscriptions"]['ComputedFields']>,"p_settings": Omit<Database["public"]['Tables']["platform_settings"]['Row'], Database["public"]['Tables']["platform_settings"]['ComputedFields']> }; Returns: Database["public"]['Enums']["subscription_status"]
                           },
"sweep_appointment_requests":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"sweep_appointments":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"sweep_remote_tickets":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"take_remote_ticket":
{ Args: { "p_customer": string,"p_lat": number,"p_lng": number,"p_priority_reason": Database["public"]['Enums']["priority_reason"],"p_service": string }; Returns: Json
                           },
"take_ticket":
{ Args: { "p_customer": string,"p_entry_code": string,"p_priority_reason": Database["public"]['Enums']["priority_reason"],"p_service": string,"p_source": Database["public"]['Enums']["ticket_source"] }; Returns: Json
                           },
"throttle_appointment_request":
{ Args: { "p_customer": string,"p_ip_hash": string }; Returns: boolean
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
"ticket_practitioner_late_until":
{ Args: { "p_ticket": string }; Returns: string
                           },
"ticket_view":
{ Args: { "p_ticket": string }; Returns: Json
                           },
"ticket_wait_seconds":
{ Args: { "p_ticket": string }; Returns: number
                           },
"transfer_ticket":
{ Args: { "p_client_op_id"?: string,"p_target_service": string,"p_ticket": string }; Returns: Json
                           },
"tv_create_pairing":
{ Args: { "p_ip_hash": string }; Returns: Json
                           },
"tv_poll_pairing":
{ Args: { "p_display": string,"p_poll_secret": string }; Returns: Json
                           },
"tv_session":
{ Args: { "p_app_version"?: string,"p_device_token": string }; Returns: Json
                           },
"update_display":
{ Args: { "p_display": string,"p_name": string,"p_service_ids": (string)[],"p_show_ads": boolean }; Returns: undefined
                           },
"verify_appointment_request":
{ Args: { "p_code": string,"p_token": string }; Returns: Json
                           },
"verify_phone_code":
{ Args: { "p_code": string,"p_verification": string }; Returns: Json
                           },
"walkins_since_appointment":
{ Args: { "p_counter": string,"p_day": string }; Returns: number
                           },
"whatsapp_message_status":
{ Args: { "p_error"?: string,"p_message_id": string,"p_status": string }; Returns: string
                           },
"whatsapp_opt_in":
{ Args: { "p_code": string,"p_locale"?: string,"p_suffix": string,"p_wa_id": string }; Returns: Json
                           },
"whatsapp_quota_exceeded":
{ Args: { "p_org": string }; Returns: boolean
                           },
"whatsapp_set_opt_out":
{ Args: { "p_opted_out": boolean,"p_wa_id": string }; Returns: undefined
                           },
"whatsapp_touch":
{ Args: { "p_wa_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "absence_kind": "absent"|"late","appointment_request_status": "unverified"|"pending"|"accepted"|"modified"|"declined"|"expired"|"cancelled","appointment_status": "confirmed"|"checked_in"|"completed"|"rescheduled"|"cancelled"|"no_show","billing_period": "monthly"|"annual","counter_kind": "cabinet"|"guichet"|"caisse"|"laboratoire"|"accueil","counter_status": "closed"|"open"|"paused","display_status": "pending"|"active"|"revoked","invoice_status": "open"|"paid"|"void","job_status": "pending"|"sending"|"sent"|"delivered"|"read"|"failed"|"skipped"|"cancelled","member_role": "org_admin"|"branch_manager"|"receptionist"|"agent","notif_channel": "whatsapp"|"push"|"sms","notif_event": "ticket_confirmed"|"almost_your_turn"|"your_turn"|"ticket_moved_back"|"practitioner_rerouted"|"practitioner_late"|"appointment_confirmed"|"appointment_reminder_day_before"|"appointment_reminder_2h"|"appointment_rescheduled"|"appointment_cancelled"|"time_to_leave"|"presence_reminder"|"remote_cancelled"|"request_code"|"request_accepted"|"request_modified"|"request_declined","org_status": "pending"|"active"|"suspended","org_type": "clinic"|"hospital"|"telecom"|"bank"|"utility"|"administration"|"other","payment_channel": "mtn_momo"|"orange_money","payment_provider": "fake"|"notchpay"|"fapshi"|"mesomb"|"cinetpay"|"flutterwave","payment_status": "pending"|"succeeded"|"failed"|"expired","priority_reason": "appointment"|"pregnancy"|"elderly"|"disability"|"other","subscription_status": "trialing"|"active"|"past_due"|"read_only"|"suspended","ticket_source": "qr"|"short_code"|"remote"|"reception","ticket_status": "waiting"|"called"|"serving"|"served"|"no_show"|"cancelled"|"transferred"
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
            "absence_kind": ["absent", "late"],"appointment_request_status": ["unverified", "pending", "accepted", "modified", "declined", "expired", "cancelled"],"appointment_status": ["confirmed", "checked_in", "completed", "rescheduled", "cancelled", "no_show"],"billing_period": ["monthly", "annual"],"counter_kind": ["cabinet", "guichet", "caisse", "laboratoire", "accueil"],"counter_status": ["closed", "open", "paused"],"display_status": ["pending", "active", "revoked"],"invoice_status": ["open", "paid", "void"],"job_status": ["pending", "sending", "sent", "delivered", "read", "failed", "skipped", "cancelled"],"member_role": ["org_admin", "branch_manager", "receptionist", "agent"],"notif_channel": ["whatsapp", "push", "sms"],"notif_event": ["ticket_confirmed", "almost_your_turn", "your_turn", "ticket_moved_back", "practitioner_rerouted", "practitioner_late", "appointment_confirmed", "appointment_reminder_day_before", "appointment_reminder_2h", "appointment_rescheduled", "appointment_cancelled", "time_to_leave", "presence_reminder", "remote_cancelled", "request_code", "request_accepted", "request_modified", "request_declined"],"org_status": ["pending", "active", "suspended"],"org_type": ["clinic", "hospital", "telecom", "bank", "utility", "administration", "other"],"payment_channel": ["mtn_momo", "orange_money"],"payment_provider": ["fake", "notchpay", "fapshi", "mesomb", "cinetpay", "flutterwave"],"payment_status": ["pending", "succeeded", "failed", "expired"],"priority_reason": ["appointment", "pregnancy", "elderly", "disability", "other"],"subscription_status": ["trialing", "active", "past_due", "read_only", "suspended"],"ticket_source": ["qr", "short_code", "remote", "reception"],"ticket_status": ["waiting", "called", "serving", "served", "no_show", "cancelled", "transferred"]
          }
        }
} as const
