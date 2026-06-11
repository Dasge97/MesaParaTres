import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { Button, ErrorText, Field, Input, Modal } from '../ui';

/** Bloqueo de una fecha completa o de una franja horaria concreta. */
export function BlockSlotModal({
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
    date: defaultDate,
    allDay: true,
    start_time: '20:00',
    end_time: '23:30',
    reason: '',
  });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/restaurants/${restaurantId}/blocked-slots`, {
        method: 'POST',
        body: {
          date: form.date,
          start_time: form.allDay ? null : form.start_time,
          end_time: form.allDay ? null : form.end_time,
          reason: form.reason || null,
        },
      });
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: ['blocked-slots'] });
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Bloquear franja" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Fecha">
          <Input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.allDay}
            onChange={(e) => setForm({ ...form, allDay: e.target.checked })}
          />
          Día completo
        </label>
        {!form.allDay && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Desde">
              <Input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                required
              />
            </Field>
            <Field label="Hasta">
              <Input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                required
              />
            </Field>
          </div>
        )}
        <Field label="Motivo">
          <Input
            placeholder="Evento privado, cierre por vacaciones…"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
        </Field>
        <Button className="w-full" disabled={busy}>
          {busy ? 'Bloqueando…' : 'Bloquear'}
        </Button>
        <ErrorText error={error} />
      </form>
    </Modal>
  );
}
