import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { CallLog, Reservation } from '../api/types';
import { useRestaurant } from '../state/restaurant';
import { Button, Card, EmptyState, StatusBadge } from '../components/ui';
import { ReservationDrawer } from '../components/reservations/ReservationDrawer';
import { fmtDateTime } from '../lib/dates';

const REVIEW_REASON_LABELS: Record<string, string> = {
  party_too_large: 'Grupo grande',
  outside_opening_hours: 'Fuera de horario',
  closed: 'Día cerrado',
  no_slot: 'Sin franja',
};

/** Bandeja de casos dudosos: reservas needs_review + llamadas derivadas o con error. */
export function ReviewPage() {
  const { selected } = useRestaurant();
  const qc = useQueryClient();
  const [drawerId, setDrawerId] = useState<string | null>(null);

  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', selected?.id, 'needs_review'],
    enabled: Boolean(selected),
    queryFn: () =>
      api<Reservation[]>(
        `/reservations?restaurant_id=${selected!.id}&status=needs_review`,
      ),
  });

  const { data: callLogs = [] } = useQuery({
    queryKey: ['call-logs', selected?.id, 'review'],
    enabled: Boolean(selected),
    queryFn: () => api<CallLog[]>(`/call-logs?restaurant_id=${selected!.id}`),
    select: (logs) => logs.filter((l) => l.outcome === 'handoff' || l.outcome === 'error'),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['reservations'] });
    qc.invalidateQueries({ queryKey: ['calendar'] });
    qc.invalidateQueries({ queryKey: ['review-count'] });
  }

  const confirm = useMutation({
    mutationFn: (id: string) => api(`/reservations/${id}/confirm`, { method: 'POST', body: {} }),
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api(`/reservations/${id}/cancel`, { method: 'POST', body: {} }),
    onSuccess: invalidate,
  });

  if (!selected) return <EmptyState>Selecciona un restaurante.</EmptyState>;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold">Por revisar</h1>

      <Card title={`Reservas pendientes de revisión (${reservations.length})`}>
        {reservations.length === 0 ? (
          <EmptyState>No hay reservas pendientes de revisión. 🎉</EmptyState>
        ) : (
          <div className="divide-y divide-slate-100">
            {reservations.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <button
                  className="font-medium underline-offset-2 hover:underline"
                  onClick={() => setDrawerId(r.id)}
                >
                  {r.customer_name}
                </button>
                <span className="tabular-nums">
                  {r.date} · {r.time}
                </span>
                <span>{r.party_size} pax</span>
                <span className="text-slate-400">{r.customer_phone}</span>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">
                  {REVIEW_REASON_LABELS[r.needs_review_reason ?? ''] ??
                    r.needs_review_reason ??
                    'revisión manual'}
                </span>
                {r.notes && <span className="text-xs text-slate-400">📝 {r.notes}</span>}
                <span className="ml-auto flex gap-2">
                  <Button
                    variant="secondary"
                    className="border-emerald-400 text-emerald-700"
                    onClick={() => confirm.mutate(r.id)}
                    disabled={confirm.isPending}
                  >
                    Confirmar
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (window.confirm('¿Rechazar/cancelar esta reserva?')) cancel.mutate(r.id);
                    }}
                    disabled={cancel.isPending}
                  >
                    Rechazar
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={`Llamadas derivadas o con error (${callLogs.length})`}>
        {callLogs.length === 0 ? (
          <EmptyState>No hay llamadas que requieran atención.</EmptyState>
        ) : (
          <div className="divide-y divide-slate-100">
            {callLogs.map((log) => (
              <div key={log.id} className="py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      log.outcome === 'error'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-orange-100 text-orange-800'
                    }`}
                  >
                    {log.outcome === 'error' ? 'Error técnico' : 'Derivada a humano'}
                  </span>
                  <span className="text-slate-500">{log.caller_phone ?? 'sin teléfono'}</span>
                  <span className="text-slate-400">{fmtDateTime(log.created_at)}</span>
                  {log.extracted_intent && (
                    <span className="text-xs text-slate-500">Motivo: {log.extracted_intent}</span>
                  )}
                  {log.reservation && (
                    <span className="flex items-center gap-1 text-xs">
                      Reserva: {log.reservation.customer_name} ({log.reservation.date}{' '}
                      {log.reservation.time}) <StatusBadge status={log.reservation.status} />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {drawerId && <ReservationDrawer reservationId={drawerId} onClose={() => setDrawerId(null)} />}
    </div>
  );
}
