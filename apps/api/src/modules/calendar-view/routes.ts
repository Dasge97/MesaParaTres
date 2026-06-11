import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dateString } from '@mesaparatres/shared';
import { db } from '../../lib/db';
import { NotFoundError } from '../../lib/errors';
import { dateTimeInTz, dayOfWeekFor } from '../../lib/time';

const calendarQuerySchema = z.object({
  restaurant_id: z.string().min(1),
  from: dateString,
  to: dateString,
});

export interface CalendarEvent {
  id: string;
  type: 'reservation' | 'blocked_slot';
  title: string;
  start: string;
  end: string;
  status: string;
  date: string;
  // reservation
  time?: string;
  customer_name?: string;
  customer_phone?: string;
  party_size?: number;
  notes?: string | null;
  source?: string;
  needs_review_reason?: string | null;
  // blocked_slot
  start_time?: string | null;
  end_time?: string | null;
  reason?: string | null;
}

/**
 * Vista de calendario interno del panel: reservas (todos los estados) +
 * bloqueos de un rango de fechas, con start/end ISO en la zona horaria
 * del restaurante. El backend es la fuente de verdad; no depende de
 * ningún proveedor externo de calendario.
 */
export const calendarViewRoutes: FastifyPluginAsync = async (app) => {
  app.get('/calendar', async (req) => {
    const q = calendarQuerySchema.parse(req.query);
    const restaurant = await db.restaurant.findUnique({ where: { id: q.restaurant_id } });
    if (!restaurant) throw new NotFoundError('Restaurante');
    const tz = restaurant.timezone;

    const [reservations, blocks, rules] = await Promise.all([
      db.reservation.findMany({
        where: { restaurant_id: q.restaurant_id, date: { gte: q.from, lte: q.to } },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
      }),
      db.blockedSlot.findMany({
        where: { restaurant_id: q.restaurant_id, date: { gte: q.from, lte: q.to } },
        orderBy: [{ date: 'asc' }, { start_time: 'asc' }],
      }),
      db.availabilityRule.findMany({ where: { restaurant_id: q.restaurant_id } }),
    ]);

    const durationBySlot = new Map<string, number>();
    for (const r of rules) {
      durationBySlot.set(`${r.day_of_week}|${r.slot_time}`, r.reservation_duration_minutes);
    }

    const events: CalendarEvent[] = [];

    for (const r of reservations) {
      const start = dateTimeInTz(r.date, r.time, tz);
      const dow = dayOfWeekFor(r.date, tz);
      const minutes = durationBySlot.get(`${dow}|${r.time}`) ?? 90;
      events.push({
        id: r.id,
        type: 'reservation',
        title: `${r.customer_name} · ${r.party_size} pax`,
        start: start.toISO()!,
        end: start.plus({ minutes }).toISO()!,
        status: r.status,
        date: r.date,
        time: r.time,
        customer_name: r.customer_name,
        customer_phone: r.customer_phone,
        party_size: r.party_size,
        notes: r.notes,
        source: r.source,
        needs_review_reason: r.needs_review_reason,
      });
    }

    for (const b of blocks) {
      events.push({
        id: b.id,
        type: 'blocked_slot',
        title: b.reason ?? 'Bloqueado',
        start: dateTimeInTz(b.date, b.start_time ?? '00:00', tz).toISO()!,
        end: dateTimeInTz(b.date, b.end_time ?? '23:59', tz).toISO()!,
        status: 'blocked',
        date: b.date,
        start_time: b.start_time,
        end_time: b.end_time,
        reason: b.reason,
      });
    }

    events.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
    return { events };
  });
};
