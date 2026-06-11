import 'dotenv/config';

const env = process.env;

export const config = {
  port: parseInt(env.PORT ?? '3001', 10),
  jwtSecret: env.JWT_SECRET || 'dev-jwt-secret-cambiar-en-produccion',
  toolsSecret: env.TOOLS_SHARED_SECRET || 'dev-tools-secret-cambiar-en-produccion',
  google: {
    serviceAccountEmail: env.GOOGLE_SA_EMAIL ?? '',
    // Las claves privadas suelen pegarse con \n escapados en el .env
    privateKey: (env.GOOGLE_SA_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  },
  resendApiKey: env.RESEND_API_KEY ?? '',
  notificationsFrom: env.NOTIFICATIONS_FROM || 'reservas@example.com',
  calendarSyncIntervalMs: parseInt(env.CALENDAR_SYNC_INTERVAL_MS ?? '30000', 10),
  adminEmail: env.ADMIN_EMAIL || 'admin@demo.com',
  adminPassword: env.ADMIN_PASSWORD || 'admin123',
};

export function isGoogleConfigured(): boolean {
  return Boolean(config.google.serviceAccountEmail && config.google.privateKey);
}
