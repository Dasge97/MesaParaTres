import { db } from '../../lib/db';
import { config, isGoogleConfigured } from '../../lib/config';
import { dayOfWeekFor } from '../../lib/time';
import { notifyRestaurant } from '../notifications/notifier';
import { deleteReservationEvent, upsertReservationEvent } from './google';
import type { Reservation, Restaurant } from '@prisma/client';

/**
 * Sincronización con Google Calendar, SIEMPRE fuera del camino crítico:
 * - al crear/confirmar una reserva se marca calendar_sync_status = pending
 *   y se intenta un sync inmediato en background;
 * - un worker periódico reintenta los pending/failed con backoff;
 * - si Calendar falla, la reserva no se pierde: queda con failed + el error.
 */

const MAX_ATTEMPTS = 5;
/** Backoff entre reintentos: intentos * 2 minutos. */
const BACKOFF_PER_ATTEMPT_MS = 2 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;
let passRunning = false;

async function durationFor(reservation: Reservation, restaurant: Restaurant): Promise<number> {
  const rule = await db.availabilityRule.findFirst({
    where: {
      restaurant_id: restaurant.id,
      day_of_week: dayOfWeekFor(reservation.date, restaurant.timezone),
      slot_time: reservation.time,
    },
  });
  return rule?.reservation_duration_minutes ?? 90;
}

async function markSyncError(
  reservation: Reservation & { restaurant: Restaurant },
  e: unknown,
): Promise<void> {
  const attempts = reservation.calendar_sync_attempts + 1;
  const message = String((e as Error)?.message ?? e).slice(0, 500);
  console.error(`[calendar] sync de reserva ${reservation.id} falló (intento ${attempts}):`, message);
  await db.reservation.update({
    where: { id: reservation.id },
    data: {
      calendar_sync_status: 'failed',
      calendar_sync_attempts: attempts,
      calendar_last_error: message,
    },
  });
  if (attempts >= MAX_ATTEMPTS) {
    await notifyRestaurant(
      reservation.restaurant,
      'Reserva sin sincronizar con Google Calendar',
      `La reserva de ${reservation.customer_name} (${reservation.party_size} pax, ${reservation.date} ${reservation.time}) ` +
        `está confirmada en el sistema pero no se ha podido reflejar en Google Calendar tras ${attempts} intentos.\n` +
        `Último error: ${message}\nRevisa la sección Integraciones del panel.`,
    );
  }
}

export async function syncReservation(reservationId: string): Promise<void> {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    include: { restaurant: true },
  });
  if (!reservation) return;
  const restaurant = reservation.restaurant;

  // Cancelada con evento en Calendar → borrar el evento.
  if (reservation.status === 'cancelled') {
    if (!reservation.calendar_event_id || !restaurant.calendar_id || !isGoogleConfigured()) return;
    try {
      await deleteReservationEvent(restaurant.calendar_id, reservation.calendar_event_id);
      await db.reservation.update({
        where: { id: reservation.id },
        data: {
          calendar_event_id: null,
          calendar_sync_status: 'disabled',
          calendar_last_error: null,
        },
      });
    } catch (e) {
      await markSyncError(reservation, e);
    }
    return;
  }

  if (reservation.status !== 'confirmed') return;
  if (!restaurant.calendar_id) {
    if (reservation.calendar_sync_status !== 'disabled') {
      await db.reservation.update({
        where: { id: reservation.id },
        data: { calendar_sync_status: 'disabled' },
      });
    }
    return;
  }
  // Sin credenciales globales: se queda en pending y se sincronizará
  // automáticamente cuando se configuren.
  if (!isGoogleConfigured()) return;

  try {
    const duration = await durationFor(reservation, restaurant);
    const eventId = await upsertReservationEvent(reservation, restaurant, duration);
    await db.reservation.update({
      where: { id: reservation.id },
      data: {
        calendar_event_id: eventId,
        calendar_sync_status: 'synced',
        calendar_last_error: null,
      },
    });
  } catch (e) {
    await markSyncError(reservation, e);
  }
}

/** Sync inmediato en background (post-commit); los fallos los recoge el worker. */
export function triggerSync(reservationId: string): void {
  void syncReservation(reservationId).catch((e) =>
    console.error(`[calendar] triggerSync(${reservationId}) error:`, e),
  );
}

export async function runSyncPass(limit = 10): Promise<number> {
  if (!isGoogleConfigured()) return 0;
  const now = Date.now();
  const candidates = await db.reservation.findMany({
    where: {
      OR: [
        {
          status: 'confirmed',
          calendar_sync_status: { in: ['pending', 'failed'] },
          calendar_sync_attempts: { lt: MAX_ATTEMPTS },
        },
        { status: 'cancelled', calendar_event_id: { not: null } },
      ],
    },
    orderBy: { updated_at: 'asc' },
    take: limit,
    select: { id: true, calendar_sync_status: true, calendar_sync_attempts: true, updated_at: true },
  });

  let processed = 0;
  for (const c of candidates) {
    const backoff = c.calendar_sync_attempts * BACKOFF_PER_ATTEMPT_MS;
    if (c.calendar_sync_status === 'failed' && now - c.updated_at.getTime() < backoff) continue;
    await syncReservation(c.id);
    processed++;
  }
  return processed;
}

/** Re-sync forzado desde el panel: resetea los failed y procesa la cola. */
export async function forceSync(restaurantId?: string): Promise<{ processed: number }> {
  await db.reservation.updateMany({
    where: {
      ...(restaurantId ? { restaurant_id: restaurantId } : {}),
      status: 'confirmed',
      calendar_sync_status: 'failed',
    },
    data: { calendar_sync_status: 'pending', calendar_sync_attempts: 0, calendar_last_error: null },
  });
  let total = 0;
  for (let i = 0; i < 5; i++) {
    const n = await runSyncPass(20);
    total += n;
    if (n === 0) break;
  }
  return { processed: total };
}

export function startCalendarSyncWorker(): void {
  if (timer) return;
  timer = setInterval(() => {
    if (passRunning) return;
    passRunning = true;
    runSyncPass()
      .catch((e) => console.error('[calendar] error en pasada de sync:', e))
      .finally(() => {
        passRunning = false;
      });
  }, config.calendarSyncIntervalMs);
  timer.unref();
  console.log(
    `[calendar] worker de sync iniciado (cada ${config.calendarSyncIntervalMs} ms; ` +
      `credenciales Google: ${isGoogleConfigured() ? 'configuradas' : 'NO configuradas — sync en pausa'})`,
  );
}

export function stopCalendarSyncWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
