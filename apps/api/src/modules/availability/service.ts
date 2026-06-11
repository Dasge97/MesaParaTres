import type { Restaurant } from '@prisma/client';
import { db, type DbClient } from '../../lib/db';
import { NotFoundError, UnprocessableError } from '../../lib/errors';
import { dayOfWeekFor, isPast, isValidDate } from '../../lib/time';
import { checkSlotAvailability, type EngineResult } from './engine';

/**
 * Carga los datos de la fecha pedida y ejecuta el motor de disponibilidad.
 * Acepta un DbClient para poder ejecutarse dentro de la transacción de
 * creación de reserva (re-chequeo bajo lock).
 */
export async function computeAvailability(
  client: DbClient,
  restaurant: Restaurant,
  date: string,
  time: string,
  party_size: number,
): Promise<EngineResult> {
  if (!isValidDate(date, restaurant.timezone)) {
    throw new UnprocessableError('invalid_date', `Fecha inválida: ${date}`);
  }

  if (isPast(date, time, restaurant.timezone)) {
    return {
      available: false,
      slot_time: null,
      requires_confirmation: false,
      reason: 'past_date',
      suggested_times: [],
    };
  }

  const dow = dayOfWeekFor(date, restaurant.timezone);

  const [rules, opening_hours, blocked_slots, grouped] = await Promise.all([
    client.availabilityRule.findMany({
      where: { restaurant_id: restaurant.id, day_of_week: dow },
    }),
    client.openingHours.findMany({
      where: { restaurant_id: restaurant.id, day_of_week: dow },
    }),
    client.blockedSlot.findMany({ where: { restaurant_id: restaurant.id, date } }),
    client.reservation.groupBy({
      by: ['time'],
      where: {
        restaurant_id: restaurant.id,
        date,
        status: { in: ['pending', 'confirmed'] },
      },
      _sum: { party_size: true },
    }),
  ]);

  const covers_by_slot: Record<string, number> = {};
  for (const g of grouped) covers_by_slot[g.time] = g._sum.party_size ?? 0;

  return checkSlotAvailability({
    time,
    party_size,
    rules,
    opening_hours,
    blocked_slots,
    covers_by_slot,
    max_party_size_global: restaurant.max_party_size_global,
  });
}

export async function checkAvailabilityForRestaurant(input: {
  restaurant_id: string;
  date: string;
  time: string;
  party_size: number;
}): Promise<{ restaurant: Restaurant; result: EngineResult }> {
  const restaurant = await db.restaurant.findUnique({ where: { id: input.restaurant_id } });
  if (!restaurant) throw new NotFoundError('Restaurante');
  const result = await computeAvailability(
    db,
    restaurant,
    input.date,
    input.time,
    input.party_size,
  );
  return { restaurant, result };
}
