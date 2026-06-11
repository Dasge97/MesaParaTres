import type { FastifyPluginAsync } from 'fastify';
import { availabilityCheckSchema } from '@recepcionista/shared';
import { checkAvailabilityForRestaurant } from './service';

export const availabilityRoutes: FastifyPluginAsync = async (app) => {
  app.post('/availability/check', async (req) => {
    const input = availabilityCheckSchema.parse(req.body);
    const { result } = await checkAvailabilityForRestaurant(input);
    return result;
  });
};
