import { z } from 'zod';
import { RESERVATION_SOURCES, RESERVATION_STATUSES, SERVICE_TYPES } from './constants';

export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha esperado: YYYY-MM-DD');

export const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato de hora esperado: HH:MM');

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const restaurantCreateSchema = z.object({
  name: z.string().min(1),
  phone: z.string().nullish(),
  timezone: z.string().default('Europe/Madrid'),
  default_language: z.string().default('es'),
  calendar_id: z.string().nullish(),
  notification_email: z.string().email().nullish().or(z.literal('').transform(() => null)),
  notification_phone: z.string().nullish(),
  is_ai_enabled: z.boolean().default(true),
  max_party_size_global: z.number().int().min(1).max(500).default(12),
  elevenlabs_agent_id: z.string().nullish(),
});
export const restaurantUpdateSchema = restaurantCreateSchema.partial();

export const openingHoursItemSchema = z
  .object({
    day_of_week: z.number().int().min(0).max(6),
    open_time: timeString,
    close_time: timeString,
    service_type: z.enum(SERVICE_TYPES).default('general'),
  })
  .refine((v) => v.open_time < v.close_time, {
    message: 'open_time debe ser anterior a close_time',
  });
export const openingHoursPutSchema = z.array(openingHoursItemSchema);

export const availabilityRuleItemSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  service_type: z.enum(SERVICE_TYPES),
  slot_time: timeString,
  max_covers: z.number().int().min(0).max(1000),
  max_party_size_auto_confirm: z.number().int().min(1).max(500).default(8),
  reservation_duration_minutes: z.number().int().min(15).max(600).default(90),
});
export const availabilityRulesPutSchema = z.array(availabilityRuleItemSchema);

export const blockedSlotCreateSchema = z
  .object({
    date: dateString,
    start_time: timeString.nullish(),
    end_time: timeString.nullish(),
    reason: z.string().nullish(),
  })
  .refine((v) => (v.start_time == null) === (v.end_time == null), {
    message: 'start_time y end_time deben indicarse juntos (o ninguno para bloquear el día completo)',
  });

export const availabilityCheckSchema = z.object({
  restaurant_id: z.string().min(1),
  date: dateString,
  time: timeString,
  party_size: z.coerce.number().int().min(1).max(500),
});

export const reservationCreateSchema = z.object({
  restaurant_id: z.string().min(1),
  customer_name: z.string().min(1),
  customer_phone: z.string().min(3),
  party_size: z.coerce.number().int().min(1).max(500),
  date: dateString,
  time: timeString,
  notes: z.string().nullish(),
  source: z.enum(RESERVATION_SOURCES).default('admin'),
  force: z.boolean().default(false),
});

export const reservationUpdateSchema = z.object({
  customer_name: z.string().min(1).optional(),
  customer_phone: z.string().min(3).optional(),
  party_size: z.coerce.number().int().min(1).max(500).optional(),
  date: dateString.optional(),
  time: timeString.optional(),
  notes: z.string().nullish(),
  status: z.enum(RESERVATION_STATUSES).optional(),
});

export const reservationListQuerySchema = z.object({
  restaurant_id: z.string().optional(),
  date: dateString.optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  status: z.enum(RESERVATION_STATUSES).optional(),
});

export const callLogCreateSchema = z.object({
  restaurant_id: z.string().min(1),
  provider_call_id: z.string().nullish(),
  caller_phone: z.string().nullish(),
  transcript: z.string().nullish(),
  extracted_intent: z.string().nullish(),
  outcome: z.string().nullish(),
  reservation_id: z.string().nullish(),
});

export const calendarConnectSchema = z.object({
  restaurant_id: z.string().min(1),
  calendar_id: z.string().min(1),
});

export const calendarSyncRequestSchema = z.object({
  restaurant_id: z.string().optional(),
});
