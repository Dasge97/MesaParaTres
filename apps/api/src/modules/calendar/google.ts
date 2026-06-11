import { google } from 'googleapis';
import type { Reservation, Restaurant } from '@prisma/client';
import { config } from '../../lib/config';
import { dateTimeInTz } from '../../lib/time';

function calendarClient() {
  const auth = new google.auth.JWT({
    email: config.google.serviceAccountEmail,
    key: config.google.privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  return google.calendar({ version: 'v3', auth });
}

function httpStatus(e: unknown): number | undefined {
  const err = e as { code?: number | string; response?: { status?: number } };
  const code = typeof err?.code === 'string' ? parseInt(err.code, 10) : err?.code;
  return err?.response?.status ?? (Number.isFinite(code) ? (code as number) : undefined);
}

function buildEventBody(
  reservation: Reservation,
  restaurant: Restaurant,
  durationMinutes: number,
) {
  const start = dateTimeInTz(reservation.date, reservation.time, restaurant.timezone);
  const end = start.plus({ minutes: durationMinutes });
  const lines = [
    `Teléfono: ${reservation.customer_phone}`,
    `Comensales: ${reservation.party_size}`,
    reservation.notes ? `Notas: ${reservation.notes}` : null,
    `Origen: ${reservation.source}`,
    `ID reserva: ${reservation.id}`,
  ].filter(Boolean);
  return {
    summary: `Reserva: ${reservation.customer_name} · ${reservation.party_size} pax`,
    description: lines.join('\n'),
    start: { dateTime: start.toISO()!, timeZone: restaurant.timezone },
    end: { dateTime: end.toISO()!, timeZone: restaurant.timezone },
  };
}

/** Crea o actualiza el evento de una reserva. Devuelve el event id. */
export async function upsertReservationEvent(
  reservation: Reservation,
  restaurant: Restaurant,
  durationMinutes: number,
): Promise<string> {
  const cal = calendarClient();
  const requestBody = buildEventBody(reservation, restaurant, durationMinutes);
  const calendarId = restaurant.calendar_id!;

  if (reservation.calendar_event_id) {
    try {
      const res = await cal.events.update({
        calendarId,
        eventId: reservation.calendar_event_id,
        requestBody,
      });
      return res.data.id!;
    } catch (e) {
      // Si el evento fue borrado a mano en Calendar, se recrea.
      const status = httpStatus(e);
      if (status !== 404 && status !== 410) throw e;
    }
  }

  const res = await cal.events.insert({ calendarId, requestBody });
  return res.data.id!;
}

export async function deleteReservationEvent(
  calendarId: string,
  eventId: string,
): Promise<void> {
  try {
    await calendarClient().events.delete({ calendarId, eventId });
  } catch (e) {
    const status = httpStatus(e);
    if (status !== 404 && status !== 410) throw e; // ya no existe → objetivo cumplido
  }
}

/** Lanza si la service account no tiene acceso al calendario. */
export async function testCalendarAccess(calendarId: string): Promise<void> {
  await calendarClient().calendars.get({ calendarId });
}
