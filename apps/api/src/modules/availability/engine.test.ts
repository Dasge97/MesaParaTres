import { describe, expect, it } from 'vitest';
import { checkSlotAvailability, type EngineInput } from './engine';

const dinnerRules = [
  { slot_time: '20:00', service_type: 'dinner', max_covers: 20, max_party_size_auto_confirm: 8, reservation_duration_minutes: 90 },
  { slot_time: '20:30', service_type: 'dinner', max_covers: 20, max_party_size_auto_confirm: 8, reservation_duration_minutes: 90 },
  { slot_time: '21:00', service_type: 'dinner', max_covers: 30, max_party_size_auto_confirm: 8, reservation_duration_minutes: 90 },
  { slot_time: '21:30', service_type: 'dinner', max_covers: 30, max_party_size_auto_confirm: 8, reservation_duration_minutes: 90 },
  { slot_time: '22:00', service_type: 'dinner', max_covers: 20, max_party_size_auto_confirm: 8, reservation_duration_minutes: 90 },
];

const dinnerOpening = [{ open_time: '20:00', close_time: '23:30', service_type: 'dinner' }];

function input(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    time: '21:00',
    party_size: 4,
    rules: dinnerRules,
    opening_hours: dinnerOpening,
    blocked_slots: [],
    covers_by_slot: {},
    max_party_size_global: 12,
    ...overrides,
  };
}

describe('checkSlotAvailability', () => {
  it('acepta una reserva normal en franja exacta', () => {
    const r = checkSlotAvailability(input());
    expect(r.available).toBe(true);
    expect(r.slot_time).toBe('21:00');
    expect(r.requires_confirmation).toBe(false);
    expect(r.reason).toBeNull();
  });

  it('redondea a la franja más cercana dentro de la tolerancia (21:10 → 21:00)', () => {
    const r = checkSlotAvailability(input({ time: '21:10' }));
    expect(r.available).toBe(true);
    expect(r.slot_time).toBe('21:00');
  });

  it('día cerrado → closed con requires_confirmation', () => {
    const r = checkSlotAvailability(input({ opening_hours: [] }));
    expect(r.available).toBe(false);
    expect(r.reason).toBe('closed');
    expect(r.requires_confirmation).toBe(true);
  });

  it('fuera de horario → outside_opening_hours con sugerencias dentro de horario', () => {
    const r = checkSlotAvailability(input({ time: '18:00' }));
    expect(r.available).toBe(false);
    expect(r.reason).toBe('outside_opening_hours');
    expect(r.requires_confirmation).toBe(true);
    expect(r.suggested_times.length).toBeGreaterThan(0);
  });

  it('día completo bloqueado → blocked sin sugerencias', () => {
    const r = checkSlotAvailability(
      input({ blocked_slots: [{ start_time: null, end_time: null, reason: 'cerrado' }] }),
    );
    expect(r.available).toBe(false);
    expect(r.reason).toBe('blocked');
    expect(r.suggested_times).toEqual([]);
  });

  it('bloqueo parcial → blocked con sugerencias fuera del bloqueo', () => {
    const r = checkSlotAvailability(
      input({ blocked_slots: [{ start_time: '20:30', end_time: '21:30', reason: 'evento' }] }),
    );
    expect(r.available).toBe(false);
    expect(r.reason).toBe('blocked');
    expect(r.suggested_times).not.toContain('21:00');
    expect(r.suggested_times.length).toBeGreaterThan(0);
  });

  it('franja llena → full con alternativas cercanas del mismo servicio', () => {
    const r = checkSlotAvailability(input({ covers_by_slot: { '21:00': 28 } }));
    expect(r.available).toBe(false);
    expect(r.reason).toBe('full');
    expect(r.suggested_times[0]).toMatch(/20:30|21:30/);
    expect(r.suggested_times).not.toContain('21:00');
  });

  it('ajuste exacto de capacidad (28 ocupados + 2 = 30) → disponible', () => {
    const r = checkSlotAvailability(input({ covers_by_slot: { '21:00': 28 }, party_size: 2 }));
    expect(r.available).toBe(true);
  });

  it('las sugerencias excluyen franjas sin hueco para el grupo', () => {
    const r = checkSlotAvailability(
      input({
        covers_by_slot: { '21:00': 30, '20:30': 19, '21:30': 25 },
        party_size: 5,
      }),
    );
    expect(r.reason).toBe('full');
    // 20:30 solo tiene hueco para 1, 21:30 tiene hueco para 5
    expect(r.suggested_times).toContain('21:30');
    expect(r.suggested_times).not.toContain('20:30');
  });

  it('grupo mayor que max_party_size_auto_confirm → disponible pero requiere confirmación', () => {
    const r = checkSlotAvailability(input({ party_size: 10 }));
    expect(r.available).toBe(true);
    expect(r.requires_confirmation).toBe(true);
    expect(r.reason).toBe('party_too_large');
  });

  it('grupo mayor que el límite global → requiere confirmación', () => {
    const r = checkSlotAvailability(input({ party_size: 13, max_party_size_global: 12 }));
    expect(r.requires_confirmation).toBe(true);
  });

  it('grupo grande sin capacidad → full, no party_too_large', () => {
    const r = checkSlotAvailability(input({ party_size: 10, covers_by_slot: { '21:00': 25 } }));
    expect(r.available).toBe(false);
    expect(r.reason).toBe('full');
  });

  it('hora sin franja cercana dentro de horario → no_slot con sugerencias', () => {
    const r = checkSlotAvailability(input({ time: '23:00' }));
    expect(r.available).toBe(false);
    expect(r.reason).toBe('no_slot');
    expect(r.requires_confirmation).toBe(true);
    expect(r.suggested_times.length).toBeGreaterThan(0);
  });
});
