import type { Restaurant } from '@prisma/client';
import { config } from '../../lib/config';

/**
 * Notificaciones al restaurante. Siempre deja traza en el log del servidor;
 * si hay RESEND_API_KEY y el restaurante tiene notification_email, además
 * envía un email. Nunca lanza: una notificación fallida no puede romper
 * la operación que la originó.
 */
export async function notifyRestaurant(
  restaurant: Restaurant,
  subject: string,
  body: string,
): Promise<void> {
  console.log(`[notify] (${restaurant.name}) ${subject} :: ${body.replace(/\n/g, ' | ')}`);

  if (!config.resendApiKey || !restaurant.notification_email) return;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.notificationsFrom,
        to: [restaurant.notification_email],
        subject: `[${restaurant.name}] ${subject}`,
        text: body,
      }),
    });
    if (!res.ok) {
      console.error(`[notify] Resend respondió ${res.status}: ${await res.text()}`);
    }
  } catch (e) {
    console.error('[notify] error enviando email:', e);
  }
}
