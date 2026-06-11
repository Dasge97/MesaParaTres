import type { FastifyPluginAsync } from 'fastify';
import {
  reservationCreateSchema,
  reservationListQuerySchema,
  reservationUpdateSchema,
} from '@recepcionista/shared';
import { db } from '../../lib/db';
import { NotFoundError } from '../../lib/errors';
import {
  cancelReservation,
  confirmReservation,
  createReservation,
  updateReservation,
} from './service';

export const reservationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/reservations', async (req) => {
    const q = reservationListQuerySchema.parse(req.query);
    return db.reservation.findMany({
      where: {
        ...(q.restaurant_id ? { restaurant_id: q.restaurant_id } : {}),
        ...(q.date ? { date: q.date } : {}),
        ...(q.from || q.to
          ? { date: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } }
          : {}),
        ...(q.status ? { status: q.status } : {}),
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      take: 500,
    });
  });

  app.post('/reservations', async (req, reply) => {
    const input = reservationCreateSchema.parse(req.body);
    const { reservation, availability, created } = await createReservation(input);
    reply.code(created ? 201 : 200);
    return { reservation, availability };
  });

  app.get('/reservations/:id', async (req) => {
    const { id } = req.params as { id: string };
    const reservation = await db.reservation.findUnique({
      where: { id },
      include: { call_logs: { orderBy: { created_at: 'desc' } } },
    });
    if (!reservation) throw new NotFoundError('Reserva');
    return reservation;
  });

  app.patch('/reservations/:id', async (req) => {
    const { id } = req.params as { id: string };
    const input = reservationUpdateSchema.parse(req.body);
    return updateReservation(id, input);
  });

  app.post('/reservations/:id/cancel', async (req) => {
    const { id } = req.params as { id: string };
    return cancelReservation(id);
  });

  app.post('/reservations/:id/confirm', async (req) => {
    const { id } = req.params as { id: string };
    return confirmReservation(id);
  });
};
