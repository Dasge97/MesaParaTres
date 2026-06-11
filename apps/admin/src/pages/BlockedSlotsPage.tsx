import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { BlockedSlot } from '../api/types';
import { useRestaurant } from '../state/restaurant';
import { Button, EmptyState } from '../components/ui';
import { BlockSlotModal } from '../components/reservations/BlockSlotModal';
import { fmtDayLabel, todayISO } from '../lib/dates';

export function BlockedSlotsPage() {
  const { selected } = useRestaurant();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ['blocked-slots', selected?.id],
    enabled: Boolean(selected),
    queryFn: () =>
      api<BlockedSlot[]>(`/restaurants/${selected!.id}/blocked-slots?from=${todayISO()}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/blocked-slots/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blocked-slots'] });
      qc.invalidateQueries({ queryKey: ['calendar'] });
    },
  });

  if (!selected) return <EmptyState>Selecciona un restaurante.</EmptyState>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">Bloqueos y cierres</h1>
        <Button onClick={() => setShowNew(true)}>+ Bloquear franja</Button>
      </div>

      {isLoading ? (
        <EmptyState>Cargando…</EmptyState>
      ) : blocks.length === 0 ? (
        <EmptyState>No hay bloqueos próximos.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Franja</th>
                <th className="px-3 py-2">Motivo</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {blocks.map((b) => (
                <tr key={b.id}>
                  <td className="px-3 py-2 capitalize">{fmtDayLabel(b.date)}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {b.start_time ? `${b.start_time} – ${b.end_time}` : 'Día completo'}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{b.reason ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm('¿Eliminar este bloqueo?')) remove.mutate(b.id);
                      }}
                    >
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <BlockSlotModal
          restaurantId={selected.id}
          defaultDate={todayISO()}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}
