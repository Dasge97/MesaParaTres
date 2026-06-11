import type { FastifyPluginAsync } from 'fastify';
import { availabilityRulesPutSchema, openingHoursPutSchema } from '@recepcionista/shared';
import { db } from '../../lib/db';
import { NotFoundError, UnprocessableError } from '../../lib/errors';

async function assertRestaurant(id: string): Promise<void> {
  const r = await db.restaurant.findUnique({ where: { id }, select: { id: true } });
  if (!r) throw new NotFoundError('Restaurante');
}

/**
 * Horarios y franjas se editan como documento completo (PUT reemplaza todo):
 * el panel siempre envía el estado final, lo que evita diffs incrementales.
 */
export const restaurantConfigRoutes: FastifyPluginAsync = async (app) => {
  app.get('/restaurants/:id/opening-hours', async (req) => {
    const { id } = req.params as { id: string };
    await assertRestaurant(id);
    return db.openingHours.findMany({
      where: { restaurant_id: id },
      orderBy: [{ day_of_week: 'asc' }, { open_time: 'asc' }],
    });
  });

  app.put('/restaurants/:id/opening-hours', async (req) => {
    const { id } = req.params as { id: string };
    await assertRestaurant(id);
    const items = openingHoursPutSchema.parse(req.body);
    await db.$transaction([
      db.openingHours.deleteMany({ where: { restaurant_id: id } }),
      db.openingHours.createMany({
        data: items.map((i) => ({ ...i, restaurant_id: id })),
      }),
    ]);
    return db.openingHours.findMany({
      where: { restaurant_id: id },
      orderBy: [{ day_of_week: 'asc' }, { open_time: 'asc' }],
    });
  });

  app.get('/restaurants/:id/availability-rules', async (req) => {
    const { id } = req.params as { id: string };
    await assertRestaurant(id);
    return db.availabilityRule.findMany({
      where: { restaurant_id: id },
      orderBy: [{ day_of_week: 'asc' }, { slot_time: 'asc' }],
    });
  });

  app.put('/restaurants/:id/availability-rules', async (req) => {
    const { id } = req.params as { id: string };
    await assertRestaurant(id);
    const items = availabilityRulesPutSchema.parse(req.body);

    const seen = new Set<string>();
    for (const i of items) {
      const key = `${i.day_of_week}|${i.service_type}|${i.slot_time}`;
      if (seen.has(key)) {
        throw new UnprocessableError(
          'duplicate_slot',
          `Franja duplicada: día ${i.day_of_week}, ${i.service_type}, ${i.slot_time}`,
        );
      }
      seen.add(key);
    }

    await db.$transaction([
      db.availabilityRule.deleteMany({ where: { restaurant_id: id } }),
      db.availabilityRule.createMany({
        data: items.map((i) => ({ ...i, restaurant_id: id })),
      }),
    ]);
    return db.availabilityRule.findMany({
      where: { restaurant_id: id },
      orderBy: [{ day_of_week: 'asc' }, { slot_time: 'asc' }],
    });
  });
};
