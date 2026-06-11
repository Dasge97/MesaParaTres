import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RESERVATION_STATUS_LABELS_ES, RESERVATION_STATUSES } from '@mesaparatres/shared';
import { api } from '../api/client';
import type { Reservation } from '../api/types';
import { useRestaurant } from '../state/restaurant';
import { Button, EmptyState, Input, Select, StatusBadge } from '../components/ui';
import { NewReservationModal } from '../components/reservations/NewReservationModal';
import { ReservationDrawer } from '../components/reservations/ReservationDrawer';
import { todayISO } from '../lib/dates';

export function ReservationsPage() {
  const { selected } = useRestaurant();
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState('');
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ['reservations', selected?.id, date, status],
    enabled: Boolean(selected),
    queryFn: () =>
      api<Reservation[]>(
        `/reservations?restaurant_id=${selected!.id}${date ? `&date=${date}` : ''}${
          status ? `&status=${status}` : ''
        }`,
      ),
  });

  if (!selected) return <EmptyState>Selecciona un restaurante.</EmptyState>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-lg font-bold">Reservas</h1>
        <Input
          type="date"
          className="w-auto"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Button variant="ghost" onClick={() => setDate('')}>
          Todas las fechas
        </Button>
        <Select
          className="w-auto"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {RESERVATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {RESERVATION_STATUS_LABELS_ES[s]}
            </option>
          ))}
        </Select>
        <div className="ml-auto">
          <Button onClick={() => setShowNew(true)}>+ Nueva reserva</Button>
        </div>
      </div>

      {isLoading ? (
        <EmptyState>Cargando…</EmptyState>
      ) : reservations.length === 0 ? (
        <EmptyState>No hay reservas con esos filtros.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Hora</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Teléfono</th>
                <th className="px-3 py-2">Pax</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Origen</th>
                <th className="px-3 py-2">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reservations.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => setDrawerId(r.id)}
                >
                  <td className="px-3 py-2 tabular-nums">{r.date}</td>
                  <td className="px-3 py-2 font-semibold tabular-nums">{r.time}</td>
                  <td className="px-3 py-2 font-medium">{r.customer_name}</td>
                  <td className="px-3 py-2 text-slate-500">{r.customer_phone}</td>
                  <td className="px-3 py-2">{r.party_size}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2 text-slate-500">{r.source}</td>
                  <td className="max-w-48 truncate px-3 py-2 text-slate-400">{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {drawerId && <ReservationDrawer reservationId={drawerId} onClose={() => setDrawerId(null)} />}
      {showNew && (
        <NewReservationModal
          restaurantId={selected.id}
          defaultDate={date || todayISO()}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}
