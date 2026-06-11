import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { config } from './lib/config';
import { AppError } from './lib/errors';
import { authRoutes } from './modules/auth/routes';
import { availabilityRoutes } from './modules/availability/routes';
import { blockedSlotRoutes } from './modules/blocked-slots/routes';
import { callLogRoutes } from './modules/call-logs/routes';
import { calendarRoutes } from './modules/calendar/routes';
import { reservationRoutes } from './modules/reservations/routes';
import { restaurantConfigRoutes } from './modules/restaurants/config-routes';
import { restaurantRoutes } from './modules/restaurants/routes';
import { handoffRoutes } from './modules/tools/handoff-routes';
import { toolsRoutes } from './modules/tools/routes';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function buildApp() {
  const app = Fastify({
    logger: { level: process.env.NODE_ENV === 'test' ? 'silent' : 'info' },
  });

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: config.jwtSecret });
  await app.register(rateLimit, { global: false });

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'unauthorized', message: 'Token inválido o caducado' });
    }
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: 'validation_error', issues: err.issues });
    }
    if (err instanceof AppError) {
      return reply
        .code(err.statusCode)
        .send({ error: err.code, message: err.message, details: err.details ?? undefined });
    }
    // Errores propios de fastify (rate limit 429, body inválido 400…)
    const fe = err as { statusCode?: number; code?: string; message?: string };
    const status = fe.statusCode && fe.statusCode >= 400 ? fe.statusCode : 500;
    if (status >= 500) req.log.error(err);
    return reply.code(status).send({
      error: status >= 500 ? 'internal_error' : fe.code ?? 'request_error',
      message: status >= 500 ? 'Error interno' : fe.message,
    });
  });

  app.get('/health', async () => ({ ok: true }));

  // Tools del agente de voz: autenticación por secreto compartido.
  await app.register(toolsRoutes, { prefix: '/tools' });

  // Login (público) y API admin (JWT).
  await app.register(authRoutes);
  await app.register(async (admin) => {
    admin.addHook('onRequest', admin.authenticate);
    await admin.register(restaurantRoutes);
    await admin.register(restaurantConfigRoutes);
    await admin.register(blockedSlotRoutes);
    await admin.register(availabilityRoutes);
    await admin.register(reservationRoutes);
    await admin.register(callLogRoutes);
    await admin.register(calendarRoutes);
    await admin.register(handoffRoutes);
  });

  return app;
}
