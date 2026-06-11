import type { FastifyPluginAsync } from 'fastify';
import { requestHumanReviewToolInput } from '@recepcionista/shared';
import { toolRequestHumanReview } from './service';

/** POST /handoff: misma lógica que la tool request_human_review, vía panel/API admin. */
export const handoffRoutes: FastifyPluginAsync = async (app) => {
  app.post('/handoff', async (req) => {
    const input = requestHumanReviewToolInput.parse(req.body);
    return toolRequestHumanReview(input);
  });
};
