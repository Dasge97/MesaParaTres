import { DAY_NAMES_ES } from '@mesaparatres/shared';

const MONTHS_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromISO(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDaysISO(date: string, days: number): string {
  const d = fromISO(date);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Lunes de la semana que contiene la fecha. */
export function mondayOf(date: string): string {
  const d = fromISO(date);
  const offset = (d.getDay() + 6) % 7; // 0 si lunes
  return addDaysISO(date, -offset);
}

export function weekDays(date: string): string[] {
  const monday = mondayOf(date);
  return Array.from({ length: 7 }, (_, i) => addDaysISO(monday, i));
}

export function dayOfWeek(date: string): number {
  return fromISO(date).getDay();
}

/** "Viernes 12 jun" */
export function fmtDayLabel(date: string): string {
  const d = fromISO(date);
  return `${DAY_NAMES_ES[d.getDay()]} ${d.getDate()} ${MONTHS_ES[d.getMonth()]}`;
}

/** "12 jun" */
export function fmtShort(date: string): string {
  const d = fromISO(date);
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]}`;
}

/** "2026-06-12T19:00:00.000Z" o similar → "12 jun 19:00" (hora local del navegador). */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
