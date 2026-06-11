import type { ReservationStatus } from '@mesaparatres/shared';
import { ConflictError } from '../../lib/errors';

/**
 * Máquina de estados de reserva. Cualquier cambio de estado pasa por aquí;
 * no hay updates de status sueltos por el código.
 */
export const ALLOWED_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  pending: ['confirmed', 'cancelled', 'needs_review', 'failed'],
  needs_review: ['confirmed', 'cancelled', 'failed'],
  confirmed: ['cancelled', 'needs_review'],
  cancelled: [],
  failed: [],
};

export function canTransition(from: ReservationStatus, to: ReservationStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ReservationStatus, to: ReservationStatus): void {
  if (from === to) return;
  if (!canTransition(from, to)) {
    throw new ConflictError(
      'invalid_transition',
      `Una reserva en estado "${from}" no puede pasar a "${to}"`,
    );
  }
}
