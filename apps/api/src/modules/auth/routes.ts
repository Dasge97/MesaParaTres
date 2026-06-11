import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { loginSchema } from '@mesaparatres/shared';
import { db } from '../../lib/db';
import { AppError } from '../../lib/errors';

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await db.adminUser.findUnique({ where: { email: email.toLowerCase() } });
    const valid = user && (await bcrypt.compare(password, user.password_hash));
    if (!valid) throw new AppError(401, 'invalid_credentials', 'Email o contraseña incorrectos');
    const token = app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '12h' });
    return { token, email: user.email };
  });
};
