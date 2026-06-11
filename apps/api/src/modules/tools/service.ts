import type { Restaurant } from '@prisma/client';
import type {
  CancelReservationToolInput,
  CancelReservationToolOutput,
  CheckAvailabilityToolInput,
  CheckAvailabilityToolOutput,
  CreateReservationToolInput,
  CreateReservationToolOutput,
  RequestHumanReviewToolInput,
  RequestHumanReviewToolOutput,
  ReservationStatus,
} from '@mesaparatres/shared';
import { db } from '../../lib/db';
import { ConflictError, NotFoundError, UnprocessableError } from '../../lib/errors';
import { normalizePhone } from '../../lib/phone';
import { todayInTz } from '../../lib/time';
import { computeAvailability } from '../availability/service';
import { recordToolCall } from '../call-logs/service';
import { notifyRestaurant } from '../notifications/notifier';
import {
  cancelReservation,
  createReservation,
  reservationSummary,
} from '../reservations/service';
import {
  aiDisabledMessage,
  availabilityMessage,
  cancellationAmbiguousMessage,
  cancellationMessage,
  cancellationNotFoundMessage,
  handoffMessage,
  reservationCreatedMessage,
  reservationFullMessage,
} from './messages';

/**
 * Adaptadores entre las tools del agente de voz y los servicios de dominio.
 * Traducen resultados a message_for_customer y dejan traza en CallLog.
 * Si mañana cambia el proveedor de voz, solo se reescribe esta capa.
 */

async function getRestaurant(id: string): Promise<Restaurant> {
  const restaurant = await db.restaurant.findUnique({ where: { id } });
  if (!restaurant) throw new NotFoundError('Restaurante');
  return restaurant;
}

export async function toolCheckAvailability(
  input: CheckAvailabilityToolInput,
): Promise<CheckAvailabilityToolOutput> {
  const restaurant = await getRestaurant(input.restaurant_id);

  let output: CheckAvailabilityToolOutput;
  if (!restaurant.is_ai_enabled) {
    output = {
      available: false,
      suggested_times: [],
      requires_confirmation: true,
      reason: 'ai_disabled',
      message_for_customer: aiDisabledMessage(),
    };
  } else {
    const result = await computeAvailability(
      db,
      restaurant,
      input.date,
      input.time,
      input.party_size,
    );
    output = {
      available: result.available,
      suggested_times: result.suggested_times,
      requires_confirmation: result.requires_confirmation,
      reason: result.reason,
      message_for_customer: availabilityMessage(result, {
        date: input.date,
        time: input.time,
        party_size: input.party_size,
        timezone: restaurant.timezone,
      }),
    };
  }

  await recordToolCall({
    restaurant_id: restaurant.id,
    provider_call_id: input.call_id,
    caller_phone: input.caller_phone,
    tool: 'check_availability',
    extracted_intent: 'check_availability',
    input,
    output,
  });
  return output;
}

export async function toolCreateReservation(
  input: CreateReservationToolInput,
): Promise<CreateReservationToolOutput> {
  const restaurant = await getRestaurant(input.restaurant_id);

  let output: CreateReservationToolOutput;
  let reservationId: string | null = null;
  let outcome = 'reservation_created';

  if (!restaurant.is_ai_enabled) {
    output = {
      success: false,
      reservation_id: null,
      status: null,
      message_for_customer: aiDisabledMessage(),
    };
    outcome = 'ai_disabled';
  } else {
    try {
      const { reservation } = await createReservation({
        restaurant_id: input.restaurant_id,
        customer_name: input.customer_name,
        customer_phone: input.customer_phone,
        party_size: input.party_size,
        date: input.date,
        time: input.time,
        notes: input.notes ?? null,
        source: 'phone_ai',
        idempotency_key: input.idempotency_key ?? null,
      });
      reservationId = reservation.id;
      outcome = reservation.status === 'needs_review' ? 'needs_review' : 'reservation_created';
      output = {
        success: true,
        reservation_id: reservation.id,
        status: reservation.status as ReservationStatus,
        message_for_customer: reservationCreatedMessage({
          status: reservation.status,
          customer_name: reservation.customer_name,
          party_size: reservation.party_size,
          date: reservation.date,
          time: reservation.time,
          timezone: restaurant.timezone,
        }),
      };
    } catch (e) {
      if (e instanceof ConflictError && e.code === 'slot_full') {
        const suggested = ((e.details as { suggested_times?: string[] })?.suggested_times ?? []);
        outcome = 'slot_full';
        output = {
          success: false,
          reservation_id: null,
          status: null,
          suggested_times: suggested,
          message_for_customer: reservationFullMessage(suggested, input.time),
        };
      } else if (e instanceof UnprocessableError && e.code === 'past_date') {
        outcome = 'past_date';
        output = {
          success: false,
          reservation_id: null,
          status: null,
          message_for_customer:
            'Esa fecha y hora ya han pasado. ¿Para qué día quieres la reserva?',
        };
      } else {
        throw e; // lo recoge el fallback de la ruta
      }
    }
  }

  await recordToolCall({
    restaurant_id: restaurant.id,
    provider_call_id: input.call_id,
    caller_phone: input.customer_phone,
    tool: 'create_reservation',
    extracted_intent: 'create_reservation',
    reservation_id: reservationId,
    outcome,
    input,
    output,
  });
  return output;
}

export async function toolCancelReservation(
  input: CancelReservationToolInput,
): Promise<CancelReservationToolOutput> {
  const restaurant = await getRestaurant(input.restaurant_id);
  const phone = normalizePhone(input.customer_phone);
  const today = todayInTz(restaurant.timezone);

  let matches = await db.reservation.findMany({
    where: {
      restaurant_id: restaurant.id,
      customer_phone: phone,
      status: { in: ['pending', 'confirmed', 'needs_review'] },
      date: input.date ?? { gte: today },
      ...(input.time ? { time: input.time } : {}),
    },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
    take: 5,
  });

  if (matches.length > 1 && input.customer_name) {
    const name = input.customer_name.trim().toLowerCase();
    const byName = matches.filter((m) => m.customer_name.toLowerCase().includes(name));
    if (byName.length >= 1) matches = byName;
  }

  let output: CancelReservationToolOutput;
  let outcome: string;
  let reservationId: string | null = null;

  if (matches.length === 0) {
    outcome = 'cancel_not_found';
    output = { success: false, status: null, message_for_customer: cancellationNotFoundMessage() };
  } else if (matches.length > 1) {
    outcome = 'cancel_ambiguous';
    output = {
      success: false,
      status: null,
      message_for_customer: cancellationAmbiguousMessage(matches.length),
    };
  } else {
    const cancelled = await cancelReservation(matches[0].id);
    reservationId = cancelled.id;
    outcome = 'reservation_cancelled';
    output = {
      success: true,
      status: 'cancelled',
      message_for_customer: cancellationMessage({
        customer_name: cancelled.customer_name,
        date: cancelled.date,
        time: cancelled.time,
        timezone: restaurant.timezone,
      }),
    };
    void notifyRestaurant(
      restaurant,
      'Reserva cancelada por teléfono',
      reservationSummary(cancelled, restaurant),
    );
  }

  await recordToolCall({
    restaurant_id: restaurant.id,
    provider_call_id: input.call_id,
    caller_phone: input.customer_phone,
    tool: 'cancel_reservation',
    extracted_intent: 'cancel_reservation',
    reservation_id: reservationId,
    outcome,
    input,
    output,
  });
  return output;
}

export async function toolRequestHumanReview(
  input: RequestHumanReviewToolInput,
): Promise<RequestHumanReviewToolOutput> {
  const restaurant = await getRestaurant(input.restaurant_id);

  const output: RequestHumanReviewToolOutput = {
    success: true,
    message_for_customer: handoffMessage(),
  };

  await recordToolCall({
    restaurant_id: restaurant.id,
    provider_call_id: input.call_id,
    caller_phone: input.caller_phone,
    tool: 'request_human_review',
    extracted_intent: input.reason,
    outcome: 'handoff',
    input,
    output,
  });

  await notifyRestaurant(
    restaurant,
    'Llamada derivada: requiere atención humana',
    [
      `Motivo: ${input.reason}`,
      input.caller_phone ? `Teléfono del cliente: ${input.caller_phone}` : null,
      input.transcript_summary ? `Resumen: ${input.transcript_summary}` : null,
      input.extracted_data ? `Datos extraídos: ${JSON.stringify(input.extracted_data)}` : null,
      'Revisa la sección "Por revisar" del panel.',
    ]
      .filter(Boolean)
      .join('\n'),
  );

  return output;
}
