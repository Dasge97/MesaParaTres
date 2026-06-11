import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition } from './state';

describe('máquina de estados de reserva', () => {
  it('permite needs_review → confirmed (resolución desde el panel)', () => {
    expect(canTransition('needs_review', 'confirmed')).toBe(true);
  });

  it('permite confirmed → cancelled', () => {
    expect(canTransition('confirmed', 'cancelled')).toBe(true);
  });

  it('cancelled es terminal', () => {
    expect(canTransition('cancelled', 'confirmed')).toBe(false);
    expect(canTransition('cancelled', 'pending')).toBe(false);
  });

  it('failed es terminal', () => {
    expect(canTransition('failed', 'confirmed')).toBe(false);
  });

  it('no permite cancelled → needs_review', () => {
    expect(() => assertTransition('cancelled', 'needs_review')).toThrow();
  });

  it('la transición al mismo estado es un no-op', () => {
    expect(() => assertTransition('confirmed', 'confirmed')).not.toThrow();
  });
});
