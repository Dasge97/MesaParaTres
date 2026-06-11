import type { FastifyPluginAsync } from 'fastify';
import { callLogCreateSchema } from '@recepcionista/shared';
import { db } from '../../lib/db';

export const callLogRoutes: FastifyPluginAsync = async (app) => {
  app.get('/call-logs', async (req) => {
    const { restaurant_id, outcome } = req.query as {
      restaurant_id?: string;
      outcome?: string;
    };
    return db.callLog.findMany({
      where: {
        ...(restaurant_id ? { restaurant_id } : {}),
        ...(outcome ? { outcome } : {}),
      },
      include: {
        reservation: {
          select: { id: true, customer_name: true, date: true, time: true, status: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 200,
    });
  });

  app.post('/call-logs', async (req, reply) => {
    const data = callLogCreateSchema.parse(req.body);
    const log = await db.callLog.create({ data });
    reply.code(201);
    return log;
  });
};
