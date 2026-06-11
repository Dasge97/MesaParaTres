import type { FastifyPluginAsync } from 'fastify';
import { restaurantCreateSchema, restaurantUpdateSchema } from '@recepcionista/shared';
import { db } from '../../lib/db';
import { NotFoundError } from '../../lib/errors';
import { todayInTz } from '../../lib/time';

export const restaurantRoutes: FastifyPluginAsync = async (app) => {
  app.get('/restaurants', async () =>
    db.restaurant.findMany({ orderBy: { created_at: 'asc' } }),
  );

  app.post('/restaurants', async (req, reply) => {
    const data = restaurantCreateSchema.parse(req.body);
    const restaurant = await db.restaurant.create({ data });
    reply.code(201);
    return restaurant;
  });

  app.get('/restaurants/:id', async (req) => {
    const { id } = req.params as { id: string };
    const restaurant = await db.restaurant.findUnique({ where: { id } });
    if (!restaurant) throw new NotFoundError('Restaurante');
    return restaurant;
  });

  app.patch('/restaurants/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = restaurantUpdateSchema.parse(req.body);
    const existing = await db.restaurant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Restaurante');
    return db.restaurant.update({ where: { id }, data });
  });

  app.get('/restaurants/:id/config', async (req) => {
    const { id } = req.params as { id: string };
    const restaurant = await db.restaurant.findUnique({
      where: { id },
      include: {
        opening_hours: { orderBy: [{ day_of_week: 'asc' }, { open_time: 'asc' }] },
        availability_rules: { orderBy: [{ day_of_week: 'asc' }, { slot_time: 'asc' }] },
      },
    });
    if (!restaurant) throw new NotFoundError('Restaurante');
    const blocked_slots = await db.blockedSlot.findMany({
      where: { restaurant_id: id, date: { gte: todayInTz(restaurant.timezone) } },
      orderBy: { date: 'asc' },
    });
    return { ...restaurant, blocked_slots };
  });
};
