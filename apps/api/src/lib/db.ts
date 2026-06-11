import { Prisma, PrismaClient } from '@prisma/client';

export const db = new PrismaClient();

/**
 * Los servicios que deben poder ejecutarse tanto fuera como dentro de una
 * transacción aceptan este tipo en lugar de PrismaClient.
 */
export type DbClient = PrismaClient | Prisma.TransactionClient;
