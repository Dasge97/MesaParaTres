import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RESERVATION_STATUS_LABELS_ES } from '@mesaparatres/shared';
import { api } from '../../api/client';
import type { Reservation } from '../../api/types';
import { Button, ErrorText, Field, Input, StatusBadge, Textarea } from '../ui';
import { fmtDateTime } from '../../lib/dates';

const SOURCE_LABELS: Record<string, string> = {
  phone_ai: 'Teléfono (IA)',
  admin: 'Panel admin',
  manual: 'Manual',
};

const REVIEW_REASON_LABELS: Record<string, string> = {
  party_too_large: 'Grupo mayor que el límite automático',
  outside_opening_hours: 'Fuera del horario de apertura',
  closed: 'Día sin horario configurado',
  no_slot: 'Sin franja para esa hora',
};

/** Panel lateral con el detalle completo de una reserva: editar, confirmar, cancelar. */
export function ReservationDrawer({
  reservationId,
  onClose,
}: {
  reservationId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: reservation } = useQuery({
    queryKey: ['reservation', reservationId],
    queryFn: () => api<Reservation>(`/reservations/${reservationId}`),
  });

  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    party_size: 2,
    date: '',
    time: '',
    notes: '',
  });
  useEffect(() => {
    if (reservation) {
      setForm({
        customer_name: reservation.customer_name,
        customer_phone: reservation.customer_phone,
        party_size: reservation.party_size,
        date: reservation.date,
        time: reservation.time,
        notes: reservation.notes ?? '',
      });
    }
  }, [reservation]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['calendar'] });
    qc.invalidateQueries({ queryKey: ['reservations'] });
    qc.invalidateQueries({ queryKey: ['reservation', reservationId] });
    qc.invalidateQueries({ queryKey: ['review-count'] });
  }

  const save = useMutation({
    mutationFn: () =>
      api<Reservation>(`/reservations/${reservationId}`, {
        method: 'PATCH',
        body: { ...form, notes: form.notes || null },
      }),
    onSuccess: invalidate,
  });

  const confirm = useMutation({
    mutationFn: () =>
      api<Reservation>(`/reservations/${reservationId}/confirm`, { method: 'POST', body: {} }),
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: () =>
      api<Reservation>(`/reservations/${reservationId}/cancel`, { method: 'POST', body: {} }),
    onSuccess: invalidate,
  });

  if (!reservation) return null;
  const isFinal = reservation.status === 'cancelled' || reservation.status === 'failed';

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-auto bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">Reserva</h3>
          <button className="text-slate-400 hover:text-slate-600" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <StatusBadge status={reservation.status} />
          <span className="text-xs text-slate-400">
            {SOURCE_LABELS[reservation.source] ?? reservation.source} ·{' '}
            creada {fmtDateTime(reservation.created_at)}
          </span>
        </div>

        {reservation.status === 'needs_review' && (
          <div className="mb-4 rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900">
            <strong>Pendiente de revisión:</strong>{' '}
            {REVIEW_REASON_LABELS[reservation.needs_review_reason ?? ''] ??
              reservation.needs_review_reason ??
              'revisión manual'}
          </div>
        )}

        <div className="space-y-3">
          <Field label="Nombre">
            <Input
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              disabled={isFinal}
            />
          </Field>
          <Field label="Teléfono">
            <Input
              value={form.customer_phone}
              onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
              disabled={isFinal}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Personas">
              <Input
                type="number"
                min={1}
                value={form.party_size}
                onChange={(e) => setForm({ ...form, party_size: Number(e.target.value) })}
                disabled={isFinal}
              />
            </Field>
            <Field label="Fecha">
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                disabled={isFinal}
              />
            </Field>
            <Field label="Hora">
              <Input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                disabled={isFinal}
              />
            </Field>
          </div>
          <Field label="Notas">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              disabled={isFinal}
            />
          </Field>
        </div>

        {!isFinal && (
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            {(reservation.status === 'needs_review' || reservation.status === 'pending') && (
              <Button
                variant="secondary"
                className="border-emerald-400 text-emerald-700"
                onClick={() => confirm.mutate()}
                disabled={confirm.isPending}
              >
                Confirmar
              </Button>
            )}
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm('¿Cancelar esta reserva?')) cancel.mutate();
              }}
              disabled={cancel.isPending}
            >
              Cancelar reserva
            </Button>
          </div>
        )}
        {isFinal && (
          <p className="mt-5 text-sm text-slate-400">
            Esta reserva está en estado {RESERVATION_STATUS_LABELS_ES[reservation.status]} y no
            se puede modificar.
          </p>
        )}

        <ErrorText error={save.error ?? confirm.error ?? cancel.error} />
      </div>
    </div>
  );
}
