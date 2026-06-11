import type { Prisma, Reservation, Restaurant } from '@prisma/client';
import type { ReservationSource, ReservationStatus } from '@recepcionista/shared';
import { db } from '../../lib/db';
import { ConflictError, NotFoundError, UnprocessableError } from '../../lib/errors';
import { normalizePhone } from '../../lib/phone';
import { humanDateEs, isPast, isValidDate } from '../../lib/time';
import { computeAvailability } from '../availability/service';
import type { EngineResult } from '../availability/engine';
import { triggerSync } from '../calendar/sync';
import { notifyRestaurant } from '../notifications/notifier';
import { assertTransition } from './state';

export interface CreateReservationInput {
  restaurant_id: string;
  customer_name: string;
  customer_phone: string;
  party_size: number;
  date: string;
  time: string;
  notes?: string | null;
  source: ReservationSource;
  idempotency_key?: string | null;
  /** Override manual desde el panel: crea aunque la franja esté llena. */
  force?: boolean;
}

export interface CreateReservationResult {
  reservation: Reservation;
  restaurant: Restaurant;
  availability: EngineResult | null;
  /** false si la devolvió la idempotencia (reintento de la misma operación). */
  created: boolean;
}

export async function createReservation(
  input: CreateReservationInput,
): Promise<CreateReservationResult> {
  const restaurant = await db.restaurant.findUnique({ where: { id: input.restaurant_id } });
  if (!restaurant) throw new NotFoundError('Restaurante');

  if (input.idempotency_key) {
    const existing = await db.reservation.findUnique({
      where: { idempotency_key: input.idempotency_key },
    });
    if (existing) {
      return { reservation: existing, restaurant, availability: null, created: false };
    }
  }

  if (!isValidDate(input.date, restaurant.timezone)) {
    throw new UnprocessableError('invalid_date', `Fecha inválida: ${input.date}`);
  }
  if (isPast(input.date, input.time, restaurant.timezone)) {
    throw new UnprocessableError('past_date', 'La fecha y hora indicadas ya han pasado');
  }

  const { reservation, availability } = await db.$transaction(async (tx) => {
    // Lock por restaurante+día: dos creaciones simultáneas sobre el mismo día
    // se serializan y la segunda ve la ocupación real. Evita el overbooking
    // por carrera entre check y create.
    const lockKey = `${input.restaurant_id}|${input.date}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    const availability = await computeAvailability(
      tx,
      restaurant,
      input.date,
      input.time,
      input.party_size,
    );

    let status: ReservationStatus;
    let needs_review_reason: string | null = null;

    if (availability.available && !availability.requires_confirmation) {
      status = 'confirmed';
    } else if (availability.requires_confirmation) {
      // Caso dudoso (grupo grande, fuera de horario, día cerrado…):
      // se registra y lo resuelve una persona desde el panel.
      status = 'needs_review';
      needs_review_reason = availability.reason;
    } else if (input.force) {
      status = 'confirmed';
    } else {
      throw new ConflictError('slot_full', 'No hay disponibilidad en esa franja', {
        reason: availability.reason,
        suggested_times: availability.suggested_times,
      });
    }

    const calendarEnabled = Boolean(restaurant.calendar_id);
    const reservation = await tx.reservation.create({
      data: {
        restaurant_id: input.restaurant_id,
        customer_name: input.customer_name.trim(),
        customer_phone: normalizePhone(input.customer_phone),
        party_size: input.party_size,
        date: input.date,
        time: availability.slot_time ?? input.time,
        status,
        notes: input.notes ?? null,
        source: input.source,
        needs_review_reason,
        idempotency_key: input.idempotency_key ?? null,
        calendar_sync_status: status === 'confirmed' && calendarEnabled ? 'pending' : 'disabled',
      },
    });
    return { reservation, availability };
  });

  // Efectos post-commit, fuera del camino crítico de la respuesta.
  if (reservation.status === 'confirmed') {
    triggerSync(reservation.id);
    void notifyRestaurant(
      restaurant,
      'Nueva reserva confirmada',
      reservationSummary(reservation, restaurant),
    );
  } else if (reservation.status === 'needs_review') {
    void notifyRestaurant(
      restaurant,
      'Reserva pendiente de revisión',
      `${reservationSummary(reservation, restaurant)}\nMotivo: ${needsReviewLabel(reservation.needs_review_reason)}\nRevisa la sección "Por revisar" del panel.`,
    );
  }

  return { reservation, restaurant, availability, created: true };
}

export interface UpdateReservationInput {
  customer_name?: string;
  customer_phone?: string;
  party_size?: number;
  date?: string;
  time?: string;
  notes?: string | null;
  status?: ReservationStatus;
}

export async function updateReservation(
  id: string,
  input: UpdateReservationInput,
): Promise<Reservation> {
  const reservation = await db.reservation.findUnique({
    where: { id },
    include: { restaurant: true },
  });
  if (!reservation) throw new NotFoundError('Reserva');
  const restaurant = reservation.restaurant;

  if (input.status && input.status !== reservation.status) {
    assertTransition(reservation.status as ReservationStatus, input.status);
  }
  if (input.date && !isValidDate(input.date, restaurant.timezone)) {
    throw new UnprocessableError('invalid_date', `Fecha inválida: ${input.date}`);
  }

  const data: Prisma.ReservationUpdateInput = {
    customer_name: input.customer_name?.trim(),
    customer_phone: input.customer_phone ? normalizePhone(input.customer_phone) : undefined,
    party_size: input.party_size,
    date: input.date,
    time: input.time,
    notes: input.notes,
    status: input.status,
  };

  const finalStatus = input.status ?? (reservation.status as ReservationStatus);
  const becomesConfirmed = finalStatus === 'confirmed' && reservation.status !== 'confirmed';
  const detailsChanged =
    (input.date && input.date !== reservation.date) ||
    (input.time && input.time !== reservation.time) ||
    (input.party_size && input.party_size !== reservation.party_size) ||
    (input.customer_name && input.customer_name.trim() !== reservation.customer_name);

  const needsResync =
    Boolean(restaurant.calendar_id) &&
    (becomesConfirmed || (finalStatus === 'confirmed' && detailsChanged));

  if (needsResync) {
    data.calendar_sync_status = 'pending';
    data.calendar_sync_attempts = 0;
    data.calendar_last_error = null;
  }
  if (becomesConfirmed) {
    data.needs_review_reason = null;
  }

  const updated = await db.reservation.update({ where: { id }, data });

  if (needsResync || finalStatus === 'cancelled') {
    triggerSync(updated.id);
  }
  return updated;
}

export async function cancelReservation(id: string): Promise<Reservation> {
  const reservation = await db.reservation.findUnique({ where: { id } });
  if (!reservation) throw new NotFoundError('Reserva');
  assertTransition(reservation.status as ReservationStatus, 'cancelled');

  const updated = await db.reservation.update({
    where: { id },
    data: { status: 'cancelled' },
  });
  triggerSync(updated.id); // si tenía evento en Calendar, el sync lo borra
  return updated;
}

export async function confirmReservation(id: string): Promise<Reservation> {
  return updateReservation(id, { status: 'confirmed' });
}

export function reservationSummary(reservation: Reservation, restaurant: Restaurant): string {
  return (
    `${reservation.customer_name} · ${reservation.party_size} pax · ` +
    `${humanDateEs(reservation.date, restaurant.timezone)} a las ${reservation.time} · ` +
    `Tel: ${reservation.customer_phone}` +
    (reservation.notes ? ` · Notas: ${reservation.notes}` : '')
  );
}

export function needsReviewLabel(reason: string | null): string {
  switch (reason) {
    case 'party_too_large':
      return 'Grupo mayor que el límite de confirmación automática';
    case 'outside_opening_hours':
      return 'Hora fuera del horario de apertura';
    case 'closed':
      return 'Día sin horario de apertura configurado';
    case 'no_slot':
      return 'No existe franja para esa hora';
    default:
      return reason ?? 'Revisión manual solicitada';
  }
}
