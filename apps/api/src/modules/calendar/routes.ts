import type { FastifyPluginAsync } from 'fastify';
import { calendarConnectSchema, calendarSyncRequestSchema } from '@recepcionista/shared';
import { config, isGoogleConfigured } from '../../lib/config';
import { db } from '../../lib/db';
import { NotFoundError, UnprocessableError } from '../../lib/errors';
import { testCalendarAccess } from './google';
import { forceSync } from './sync';

export const calendarRoutes: FastifyPluginAsync = async (app) => {
  app.post('/integrations/google-calendar/connect', async (req) => {
    const { restaurant_id, calendar_id } = calendarConnectSchema.parse(req.body);
    const restaurant = await db.restaurant.findUnique({ where: { id: restaurant_id } });
    if (!restaurant) throw new NotFoundError('Restaurante');

    if (isGoogleConfigured()) {
      try {
        await testCalendarAccess(calendar_id);
      } catch {
        throw new UnprocessableError(
          'calendar_access_failed',
          `La service account (${config.google.serviceAccountEmail}) no tiene acceso a ese calendario. ` +
            'Comparte el calendario con ese email (permiso "Hacer cambios en eventos") y vuelve a intentarlo.',
        );
      }
    }

    const updated = await db.restaurant.update({
      where: { id: restaurant_id },
      data: { calendar_id },
    });

    // Reservas confirmadas que aún no tienen evento → a la cola de sync.
    await db.reservation.updateMany({
      where: {
        restaurant_id,
        status: 'confirmed',
        calendar_event_id: null,
        calendar_sync_status: 'disabled',
      },
      data: { calendar_sync_status: 'pending', calendar_sync_attempts: 0 },
    });

    return { restaurant: updated, google_configured: isGoogleConfigured() };
  });

  app.post('/integrations/google-calendar/sync', async (req) => {
    const { restaurant_id } = calendarSyncRequestSchema.parse(req.body ?? {});
    if (!isGoogleConfigured()) {
      throw new UnprocessableError(
        'google_not_configured',
        'No hay credenciales de Google configuradas en el servidor (GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY).',
      );
    }
    return forceSync(restaurant_id);
  });

  app.get('/integrations/google-calendar/status', async (req) => {
    const { restaurant_id } = req.query as { restaurant_id?: string };
    const grouped = await db.reservation.groupBy({
      by: ['calendar_sync_status'],
      where: { ...(restaurant_id ? { restaurant_id } : {}), status: 'confirmed' },
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    for (const g of grouped) counts[g.calendar_sync_status] = g._count._all;
    return {
      google_configured: isGoogleConfigured(),
      service_account_email: config.google.serviceAccountEmail || null,
      counts,
    };
  });
};
