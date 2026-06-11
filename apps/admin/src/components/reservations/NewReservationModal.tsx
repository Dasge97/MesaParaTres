import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { AvailabilityResult, Reservation } from '../../api/types';
import { Button, ErrorText, Field, Input, Modal, Textarea } from '../ui';

const REASON_LABELS: Record<string, string> = {
  closed: 'El restaurante está cerrado ese día.',
  outside_opening_hours: 'La hora está fuera del horario de apertura.',
  blocked: 'Esa franja está bloqueada.',
  no_slot: 'No hay franja de reserva para esa hora.',
  full: 'No queda capacidad en esa franja.',
  party_too_large: 'Grupo grande: la reserva quedará pendiente de confirmación.',
  past_date: 'La fecha y hora ya han pasado.',
};

/**
 * Alta manual de reserva: comprueba disponibilidad con el backend antes de
 * crear. Si no hay hueco, muestra alternativas y permite forzar (override
 * del restaurante, p. ej. por teléfono directo).
 */
export function NewReservationModal({
  restaurantId,
  defaultDate,
  onClose,
}: {
  restaurantId: string;
  defaultDate: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    party_size: 2,
    date: defaultDate,
    time: '21:00',
    notes: '',
  });
  const [check, setCheck] = useState<AvailabilityResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function create(force: boolean) {
    setBusy(true);
    setError(null);
    try {
      await api<{ reservation: Reservation }>('/reservations', {
        method: 'POST',
        body: { ...form, restaurant_id: restaurantId, notes: form.notes || null, source: 'admin', force },
      });
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['review-count'] });
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api<AvailabilityResult>('/availability/check', {
        method: 'POST',
        body: {
          restaurant_id: restaurantId,
          date: form.date,
          time: form.time,
          party_size: form.party_size,
        },
      });
      if (result.available && !result.requires_confirmation) {
        await create(false);
        return;
      }
      setCheck(result); // muestra aviso + alternativas + opción de forzar
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Nueva reserva" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nombre del cliente">
          <Input
            value={form.customer_name}
            onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
            required
          />
        </Field>
        <Field label="Teléfono">
          <Input
            value={form.customer_phone}
            onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
            required
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Personas">
            <Input
              type="number"
              min={1}
              value={form.party_size}
              onChange={(e) => {
                setForm({ ...form, party_size: Number(e.target.value) });
                setCheck(null);
              }}
              required
            />
          </Field>
          <Field label="Fecha">
            <Input
              type="date"
              value={form.date}
              onChange={(e) => {
                setForm({ ...form, date: e.target.value });
                setCheck(null);
              }}
              required
            />
          </Field>
          <Field label="Hora">
            <Input
              type="time"
              value={form.time}
              onChange={(e) => {
                setForm({ ...form, time: e.target.value });
                setCheck(null);
              }}
              required
            />
          </Field>
        </div>
        <Field label="Notas">
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>

        {check && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p>{REASON_LABELS[check.reason ?? ''] ?? 'No hay disponibilidad automática.'}</p>
            {check.suggested_times.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs">Alternativas con hueco:</span>
                {check.suggested_times.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="rounded-full border border-amber-400 bg-white px-2 py-0.5 text-xs font-medium hover:bg-amber-100"
                    onClick={() => {
                      setForm({ ...form, time: t });
                      setCheck(null);
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => create(!check.requires_confirmation)}
              >
                {check.requires_confirmation
                  ? 'Crear como pendiente de revisión'
                  : 'Forzar creación igualmente'}
              </Button>
            </div>
          </div>
        )}

        {!check && (
          <Button className="w-full" disabled={busy}>
            {busy ? 'Comprobando…' : 'Comprobar disponibilidad y crear'}
          </Button>
        )}
        <ErrorText error={error} />
      </form>
    </Modal>
  );
}
