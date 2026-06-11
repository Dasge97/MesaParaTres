import type {
  CalendarSyncStatus,
  ReservationSource,
  ReservationStatus,
  ServiceType,
} from '@mesaparatres/shared';

export interface Restaurant {
  id: string;
  name: string;
  phone: string | null;
  timezone: string;
  default_language: string;
  calendar_id: string | null;
  notification_email: string | null;
  notification_phone: string | null;
  is_ai_enabled: boolean;
  max_party_size_global: number;
  elevenlabs_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reservation {
  id: string;
  restaurant_id: string;
  customer_name: string;
  customer_phone: string;
  party_size: number;
  date: string;
  time: string;
  status: ReservationStatus;
  notes: string | null;
  source: ReservationSource;
  needs_review_reason: string | null;
  idempotency_key: string | null;
  calendar_event_id: string | null;
  calendar_sync_status: CalendarSyncStatus;
  created_at: string;
  updated_at: string;
}

export interface OpeningHoursItem {
  id?: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  service_type: ServiceType;
}

export interface AvailabilityRuleItem {
  id?: string;
  day_of_week: number;
  service_type: ServiceType;
  slot_time: string;
  max_covers: number;
  max_party_size_auto_confirm: number;
  reservation_duration_minutes: number;
}

export interface BlockedSlot {
  id: string;
  restaurant_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

export interface CallLog {
  id: string;
  restaurant_id: string;
  provider_call_id: string | null;
  caller_phone: string | null;
  transcript: string | null;
  extracted_intent: string | null;
  outcome: string | null;
  tool_calls: { tool: string; input: unknown; output: unknown; at: string }[];
  reservation: {
    id: string;
    customer_name: string;
    date: string;
    time: string;
    status: ReservationStatus;
  } | null;
  created_at: string;
}

export interface AvailabilityResult {
  available: boolean;
  slot_time: string | null;
  requires_confirmation: boolean;
  reason: string | null;
  suggested_times: string[];
}

export interface CalendarEvent {
  id: string;
  type: 'reservation' | 'blocked_slot';
  title: string;
  start: string;
  end: string;
  status: ReservationStatus | 'blocked';
  date: string;
  time?: string;
  customer_name?: string;
  customer_phone?: string;
  party_size?: number;
  notes?: string | null;
  source?: ReservationSource;
  needs_review_reason?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  reason?: string | null;
}
