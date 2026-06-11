import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { ZodError } from 'zod';
import {
  cancelReservationToolInput,
  checkAvailabilityToolInput,
  createReservationToolInput,
  requestHumanReviewToolInput,
} from '@mesaparatres/shared';
import { config } from '../../lib/config';
import { db } from '../../lib/db';
import { notifyRestaurant } from '../notifications/notifier';
import { recordToolCall } from '../call-logs/service';
import { errorFallbackMessage } from './messages';
import {
  toolCancelReservation,
  toolCheckAvailability,
  toolCreateReservation,
  toolRequestHumanReview,
} from './service';

function secretIsValid(header: unknown): boolean {
  if (typeof header !== 'string' || header.length === 0) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(config.toolsSecret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Cualquier error inesperado en una tool devuelve un mensaje controlado al
 * agente (nunca un 500 pelado que lo deje colgado al teléfono), registra el
 * fallo y avisa al restaurante: "cualquier error de backend → revisión humana".
 */
async function handleToolError(
  tool: string,
  body: unknown,
  error: unknown,
  extra: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  console.error(`[tools] error en ${tool}:`, error);
  const restaurantId = (body as { restaurant_id?: string })?.restaurant_id;
  if (restaurantId) {
    const restaurant = await db.restaurant
      .findUnique({ where: { id: restaurantId } })
      .catch(() => null);
    if (restaurant) {
      await recordToolCall({
        restaurant_id: restaurant.id,
        provider_call_id: (body as { call_id?: string })?.call_id ?? null,
        caller_phone:
          (body as { caller_phone?: string; customer_phone?: string })?.caller_phone ??
          (body as { customer_phone?: string })?.customer_phone ??
          null,
        tool,
        input: body as object,
        output: { error: String((error as Error)?.message ?? error).slice(0, 300) },
        outcome: 'error',
      });
      await notifyRestaurant(
        restaurant,
        'Error técnico durante una llamada',
        `La tool "${tool}" ha fallado durante una llamada. El cliente ha recibido un mensaje de disculpa.\n` +
          `Error: ${String((error as Error)?.message ?? error).slice(0, 300)}\n` +
          `Puede que haya que contactar al cliente manualmente (ver registro de llamadas).`,
      );
    }
  }
  return { ...extra, message_for_customer: errorFallbackMessage() };
}

export const toolsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (req, reply) => {
    if (!secretIsValid(req.headers['x-tools-secret'])) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  });

  const rl = { rateLimit: { max: 120, timeWindow: '1 minute' } };

  app.post('/check-availability', { config: rl }, async (req, reply) => {
    let input;
    try {
      input = checkAvailabilityToolInput.parse(req.body);
    } catch (e) {
      if (e instanceof ZodError) {
        return {
          available: false,
          suggested_times: [],
          requires_confirmation: false,
          reason: null,
          message_for_customer:
            'No he entendido bien la fecha, la hora o el número de personas. ¿Me lo repites, por favor?',
        };
      }
      throw e;
    }
    try {
      return await toolCheckAvailability(input);
    } catch (e) {
      reply.code(200);
      return handleToolError('check_availability', input, e, {
        available: false,
        suggested_times: [],
        requires_confirmation: true,
        reason: null,
      });
    }
  });

  app.post('/create-reservation', { config: rl }, async (req, reply) => {
    let input;
    try {
      input = createReservationToolInput.parse(req.body);
    } catch (e) {
      if (e instanceof ZodError) {
        return {
          success: false,
          reservation_id: null,
          status: null,
          message_for_customer:
            'Me falta algún dato para completar la reserva (nombre, teléfono, fecha, hora o personas). ¿Me lo confirmas?',
        };
      }
      throw e;
    }
    try {
      return await toolCreateReservation(input);
    } catch (e) {
      reply.code(200);
      return handleToolError('create_reservation', input, e, {
        success: false,
        reservation_id: null,
        status: null,
      });
    }
  });

  app.post('/cancel-reservation', { config: rl }, async (req, reply) => {
    let input;
    try {
      input = cancelReservationToolInput.parse(req.body);
    } catch (e) {
      if (e instanceof ZodError) {
        return {
          success: false,
          status: null,
          message_for_customer:
            'Para cancelar necesito el teléfono con el que se hizo la reserva. ¿Me lo dices, por favor?',
        };
      }
      throw e;
    }
    try {
      return await toolCancelReservation(input);
    } catch (e) {
      reply.code(200);
      return handleToolError('cancel_reservation', input, e, { success: false, status: null });
    }
  });

  app.post('/request-human-review', { config: rl }, async (req, reply) => {
    let input;
    try {
      input = requestHumanReviewToolInput.parse(req.body);
    } catch (e) {
      if (e instanceof ZodError) {
        return { success: false, message_for_customer: errorFallbackMessage() };
      }
      throw e;
    }
    try {
      return await toolRequestHumanReview(input);
    } catch (e) {
      reply.code(200);
      return handleToolError('request_human_review', input, e, { success: false });
    }
  });
};
