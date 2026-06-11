import { buildApp } from './app';
import { config } from './lib/config';
import { db } from './lib/db';
import { startCalendarSyncWorker, stopCalendarSyncWorker } from './modules/calendar/sync';

async function main() {
  const app = await buildApp();
  try {
    // Dual-stack (IPv4 + IPv6): evita el timeout de ::1 → fallback IPv4
    // que añade ~2s por request a los clientes que resuelven "localhost" como IPv6.
    await app.listen({ port: config.port, host: '::' });
  } catch {
    await app.listen({ port: config.port, host: '0.0.0.0' });
  }
  startCalendarSyncWorker();

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} recibido, cerrando…`);
    stopCalendarSyncWorker();
    await app.close();
    await db.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((e) => {
  console.error('Error fatal arrancando la API:', e);
  process.exit(1);
});
