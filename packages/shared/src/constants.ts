export const RESERVATION_STATUSES = [
  'pending',
  'confirmed',
  'cancelled',
  'needs_review',
  'failed',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const SERVICE_TYPES = ['lunch', 'dinner', 'general'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const RESERVATION_SOURCES = ['phone_ai', 'admin', 'manual'] as const;
export type ReservationSource = (typeof RESERVATION_SOURCES)[number];

export const CALENDAR_SYNC_STATUSES = ['pending', 'synced', 'failed', 'disabled'] as const;
export type CalendarSyncStatus = (typeof CALENDAR_SYNC_STATUSES)[number];

// day_of_week: 0 = domingo … 6 = sábado (convención JS Date.getDay())
export const DAY_NAMES_ES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

export const SERVICE_TYPE_LABELS_ES: Record<ServiceType, string> = {
  lunch: 'Comida',
  dinner: 'Cena',
  general: 'General',
};

export const RESERVATION_STATUS_LABELS_ES: Record<ReservationStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  needs_review: 'Por revisar',
  failed: 'Fallida',
};

export type AvailabilityReason =
  | 'closed'
  | 'outside_opening_hours'
  | 'blocked'
  | 'no_slot'
  | 'full'
  | 'party_too_large'
  | 'past_date'
  | 'invalid_party_size'
  | 'ai_disabled';
