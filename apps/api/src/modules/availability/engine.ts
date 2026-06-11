import type { AvailabilityReason } from '@mesaparatres/shared';
import { timeToMinutes } from '../../lib/time';

/**
 * Motor de disponibilidad: lógica pura, sin I/O.
 * Recibe los datos ya cargados (reglas, horarios, bloqueos y ocupación)
 * y decide si cabe una reserva. Es la pieza más testeada del sistema.
 */

export interface RuleInput {
  slot_time: string;
  service_type: string;
  max_covers: number;
  max_party_size_auto_confirm: number;
  reservation_duration_minutes: number;
}

export interface OpeningInput {
  open_time: string;
  close_time: string;
  service_type: string;
}

export interface BlockInput {
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

export interface EngineInput {
  time: string;
  party_size: number;
  /** Reglas del restaurante para ese día de la semana (todos los servicios). */
  rules: RuleInput[];
  /** Horarios de apertura para ese día de la semana. */
  opening_hours: OpeningInput[];
  /** Bloqueos que afectan a esa fecha concreta. */
  blocked_slots: BlockInput[];
  /** Comensales ya reservados (pending + confirmed) por franja "HH:MM". */
  covers_by_slot: Record<string, number>;
  max_party_size_global: number;
}

export interface EngineResult {
  available: boolean;
  /** Franja real asignada (puede diferir de la hora pedida por redondeo). */
  slot_time: string | null;
  requires_confirmation: boolean;
  reason: AvailabilityReason | null;
  suggested_times: string[];
}

/** Si el cliente pide una hora a ≤15 min de una franja existente, se asigna esa franja. */
const ROUNDING_TOLERANCE_MIN = 15;
const MAX_SUGGESTIONS = 3;

function findBlock(time: string, blocks: BlockInput[]): BlockInput | null {
  const t = timeToMinutes(time);
  for (const b of blocks) {
    if (b.start_time == null || b.end_time == null) return b; // día completo
    if (t >= timeToMinutes(b.start_time) && t < timeToMinutes(b.end_time)) return b;
  }
  return null;
}

function isWholeDayBlocked(blocks: BlockInput[]): boolean {
  return blocks.some((b) => b.start_time == null || b.end_time == null);
}

function withinOpeningHours(time: string, opening: OpeningInput[]): boolean {
  const t = timeToMinutes(time);
  return opening.some(
    (o) => t >= timeToMinutes(o.open_time) && t < timeToMinutes(o.close_time),
  );
}

/** Franjas alternativas con hueco, ordenadas por cercanía a la hora pedida. */
function suggestTimes(
  input: EngineInput,
  opts: { service_type?: string; exclude?: string } = {},
): string[] {
  const target = timeToMinutes(input.time);
  return input.rules
    .filter((r) => (opts.service_type ? r.service_type === opts.service_type : true))
    .filter((r) => r.slot_time !== opts.exclude)
    .filter((r) => !findBlock(r.slot_time, input.blocked_slots))
    .filter((r) => withinOpeningHours(r.slot_time, input.opening_hours))
    .filter((r) => (input.covers_by_slot[r.slot_time] ?? 0) + input.party_size <= r.max_covers)
    .sort(
      (a, b) =>
        Math.abs(timeToMinutes(a.slot_time) - target) -
        Math.abs(timeToMinutes(b.slot_time) - target),
    )
    .slice(0, MAX_SUGGESTIONS)
    .map((r) => r.slot_time);
}

export function checkSlotAvailability(input: EngineInput): EngineResult {
  const base = { available: false, slot_time: null, suggested_times: [] as string[] };

  if (input.party_size < 1) {
    return { ...base, requires_confirmation: false, reason: 'invalid_party_size' };
  }

  // 1. Día sin horario de apertura → cerrado. Caso dudoso: la IA ofrece handoff.
  if (input.opening_hours.length === 0) {
    return { ...base, requires_confirmation: true, reason: 'closed' };
  }

  // 2. Día completo bloqueado (fecha especial, cierre puntual).
  if (isWholeDayBlocked(input.blocked_slots)) {
    return { ...base, requires_confirmation: false, reason: 'blocked' };
  }

  // 3. Fuera del horario de apertura → caso dudoso (puede acabar en needs_review).
  if (!withinOpeningHours(input.time, input.opening_hours)) {
    return {
      ...base,
      requires_confirmation: true,
      reason: 'outside_opening_hours',
      suggested_times: suggestTimes(input),
    };
  }

  // 4. Bloqueo parcial que cubre la hora pedida.
  if (findBlock(input.time, input.blocked_slots)) {
    return {
      ...base,
      requires_confirmation: false,
      reason: 'blocked',
      suggested_times: suggestTimes(input),
    };
  }

  // 5. Buscar franja: exacta o redondeada a la más cercana dentro de la tolerancia.
  const target = timeToMinutes(input.time);
  const nearest = input.rules
    .filter((r) => !findBlock(r.slot_time, input.blocked_slots))
    .map((r) => ({ rule: r, dist: Math.abs(timeToMinutes(r.slot_time) - target) }))
    .sort((a, b) => a.dist - b.dist)[0];

  if (!nearest || nearest.dist > ROUNDING_TOLERANCE_MIN) {
    return {
      ...base,
      requires_confirmation: true,
      reason: 'no_slot',
      suggested_times: suggestTimes(input),
    };
  }
  const rule = nearest.rule;

  // 6. Capacidad de la franja.
  const used = input.covers_by_slot[rule.slot_time] ?? 0;
  if (used + input.party_size > rule.max_covers) {
    return {
      ...base,
      requires_confirmation: false,
      reason: 'full',
      suggested_times: suggestTimes(input, {
        service_type: rule.service_type,
        exclude: rule.slot_time,
      }),
    };
  }

  // 7. Límites de tamaño de grupo: cabe, pero requiere confirmación humana.
  if (
    input.party_size > input.max_party_size_global ||
    input.party_size > rule.max_party_size_auto_confirm
  ) {
    return {
      available: true,
      slot_time: rule.slot_time,
      requires_confirmation: true,
      reason: 'party_too_large',
      suggested_times: [],
    };
  }

  return {
    available: true,
    slot_time: rule.slot_time,
    requires_confirmation: false,
    reason: null,
    suggested_times: [],
  };
}
