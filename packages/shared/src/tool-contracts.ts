import { z } from 'zod';
import { dateString, timeString } from './schemas';
import type { AvailabilityReason, ReservationStatus } from './constants';

/**
 * Contratos de las tools que el agente de ElevenLabs puede invocar.
 * Los inputs usan z.coerce donde el LLM podría enviar números como strings.
 * Todos los outputs incluyen message_for_customer: el agente lo lee tal cual,
 * nunca inventa el resultado de una operación.
 */

export const checkAvailabilityToolInput = z.object({
  restaurant_id: z.string().min(1),
  date: dateString,
  time: timeString,
  party_size: z.coerce.number().int().min(1).max(500),
  call_id: z.string().nullish(),
  caller_phone: z.string().nullish(),
});
export type CheckAvailabilityToolInput = z.infer<typeof checkAvailabilityToolInput>;

export interface CheckAvailabilityToolOutput {
  available: boolean;
  suggested_times: string[];
  requires_confirmation: boolean;
  reason: AvailabilityReason | null;
  message_for_customer: string;
}

export const createReservationToolInput = z.object({
  restaurant_id: z.string().min(1),
  customer_name: z.string().min(1),
  customer_phone: z.string().min(3),
  date: dateString,
  time: timeString,
  party_size: z.coerce.number().int().min(1).max(500),
  notes: z.string().nullish(),
  call_id: z.string().nullish(),
  idempotency_key: z.string().nullish(),
});
export type CreateReservationToolInput = z.infer<typeof createReservationToolInput>;

export interface CreateReservationToolOutput {
  success: boolean;
  reservation_id: string | null;
  status: ReservationStatus | null;
  suggested_times?: string[];
  message_for_customer: string;
}

export const cancelReservationToolInput = z.object({
  restaurant_id: z.string().min(1),
  customer_phone: z.string().min(3),
  date: dateString.nullish(),
  time: timeString.nullish(),
  customer_name: z.string().nullish(),
  call_id: z.string().nullish(),
});
export type CancelReservationToolInput = z.infer<typeof cancelReservationToolInput>;

export interface CancelReservationToolOutput {
  success: boolean;
  status: ReservationStatus | null;
  message_for_customer: string;
}

export const requestHumanReviewToolInput = z.object({
  restaurant_id: z.string().min(1),
  caller_phone: z.string().nullish(),
  reason: z.string().min(1),
  transcript_summary: z.string().nullish(),
  extracted_data: z.record(z.string(), z.unknown()).nullish(),
  call_id: z.string().nullish(),
});
export type RequestHumanReviewToolInput = z.infer<typeof requestHumanReviewToolInput>;

export interface RequestHumanReviewToolOutput {
  success: boolean;
  message_for_customer: string;
}
