import type { FastifyPluginAsync } from 'fastify';
import { blockedSlotCreateSchema } from '@mesaparatres/shared';
import { db } from '../../lib/db';
import { NotFoundError } from '../../lib/errors';

export const blockedSlotRoutes: FastifyPluginAsync = async (app) => {
  app.get('/restaurants/:id/blocked-slots', async (req) => {
    const { id } = req.params as { id: string };
    const { from } = req.query as { from?: string };
    return db.blockedSlot.findMany({
      where: { restaurant_id: id, ...(from ? { date: { gte: from } } : {}) },
      orderBy: [{ date: 'asc' }, { start_time: 'asc' }],
    });
  });

  app.post('/restaurants/:id/blocked-slots', async (req, reply) => {
    const { id } = req.params as { id: string };
    const restaurant = await db.restaurant.findUnique({ where: { id }, select: { id: true } });
    if (!restaurant) throw new NotFoundError('Restaurante');
    const data = blockedSlotCreateSchema.parse(req.body);
    const blocked = await db.blockedSlot.create({
      data: { ...data, restaurant_id: id },
    });
    reply.code(201);
    return blocked;
  });

  app.delete('/blocked-slots/:id', async (req) => {
    const { id } = req.params as { id: string };
    const existing = await db.blockedSlot.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Bloqueo');
    await db.blockedSlot.delete({ where: { id } });
    return { deleted: true };
  });
};
