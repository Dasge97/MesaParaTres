import { DateTime } from 'luxon';

/** Convierte weekday de Luxon (1=lunes…7=domingo) a la convención JS (0=domingo…6=sábado). */
export function dayOfWeekFor(date: string, timezone: string): number {
  const dt = DateTime.fromISO(date, { zone: timezone });
  return dt.weekday % 7;
}

export function dateTimeInTz(date: string, time: string, timezone: string): DateTime {
  return DateTime.fromISO(`${date}T${time}`, { zone: timezone });
}

export function isValidDate(date: string, timezone: string): boolean {
  return DateTime.fromISO(date, { zone: timezone }).isValid;
}

/** true si la fecha+hora ya ha pasado en la zona horaria del restaurante. */
export function isPast(date: string, time: string, timezone: string): boolean {
  const dt = dateTimeInTz(date, time, timezone);
  return dt < DateTime.now().setZone(timezone);
}

export function todayInTz(timezone: string): string {
  return DateTime.now().setZone(timezone).toISODate()!;
}

/** "viernes 12 de junio" — para mensajes leídos al cliente por la IA. */
export function humanDateEs(date: string, timezone: string): string {
  return DateTime.fromISO(date, { zone: timezone })
    .setLocale('es')
    .toFormat("cccc d 'de' LLLL");
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
