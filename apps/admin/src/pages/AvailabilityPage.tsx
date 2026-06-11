import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DAY_NAMES_ES,
  SERVICE_TYPE_LABELS_ES,
  SERVICE_TYPES,
} from '@mesaparatres/shared';
import { api } from '../api/client';
import type { AvailabilityRuleItem, OpeningHoursItem } from '../api/types';
import { useRestaurant } from '../state/restaurant';
import { Button, Card, EmptyState, ErrorText, Input, Select } from '../components/ui';

// Orden visual: lunes a domingo
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function AvailabilityPage() {
  const { selected } = useRestaurant();
  if (!selected) return <EmptyState>Selecciona un restaurante.</EmptyState>;
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold">Disponibilidad — {selected.name}</h1>
      <OpeningHoursEditor restaurantId={selected.id} />
      <RulesEditor restaurantId={selected.id} />
    </div>
  );
}

function OpeningHoursEditor({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['opening-hours', restaurantId],
    queryFn: () => api<OpeningHoursItem[]>(`/restaurants/${restaurantId}/opening-hours`),
  });
  const [rows, setRows] = useState<OpeningHoursItem[]>([]);
  useEffect(() => {
    if (data) setRows(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      api(`/restaurants/${restaurantId}/opening-hours`, {
        method: 'PUT',
        body: rows.map(({ id: _id, ...r }) => r),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opening-hours', restaurantId] }),
  });

  function update(i: number, patch: Partial<OpeningHoursItem>) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  return (
    <Card
      title="Horarios de apertura"
      actions={
        <>
          <Button
            variant="secondary"
            onClick={() =>
              setRows([
                ...rows,
                { day_of_week: 5, open_time: '20:00', close_time: '23:30', service_type: 'dinner' },
              ])
            }
          >
            + Añadir
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar horarios'}
          </Button>
        </>
      }
    >
      {rows.length === 0 && <EmptyState>Sin horarios: el restaurante figura cerrado.</EmptyState>}
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Select
              className="w-36"
              value={row.day_of_week}
              onChange={(e) => update(i, { day_of_week: Number(e.target.value) })}
            >
              {DAY_ORDER.map((d) => (
                <option key={d} value={d}>
                  {DAY_NAMES_ES[d]}
                </option>
              ))}
            </Select>
            <Select
              className="w-32"
              value={row.service_type}
              onChange={(e) =>
                update(i, { service_type: e.target.value as OpeningHoursItem['service_type'] })
              }
            >
              {SERVICE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {SERVICE_TYPE_LABELS_ES[s]}
                </option>
              ))}
            </Select>
            <Input
              type="time"
              className="w-28"
              value={row.open_time}
              onChange={(e) => update(i, { open_time: e.target.value })}
            />
            <span className="text-slate-400">—</span>
            <Input
              type="time"
              className="w-28"
              value={row.close_time}
              onChange={(e) => update(i, { close_time: e.target.value })}
            />
            <Button variant="ghost" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>
              ✕
            </Button>
          </div>
        ))}
      </div>
      <ErrorText error={save.error} />
    </Card>
  );
}

function RulesEditor({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['availability-rules', restaurantId],
    queryFn: () => api<AvailabilityRuleItem[]>(`/restaurants/${restaurantId}/availability-rules`),
  });
  const [rows, setRows] = useState<AvailabilityRuleItem[]>([]);
  const [dayFilter, setDayFilter] = useState<number>(-1);
  useEffect(() => {
    if (data) setRows(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      api(`/restaurants/${restaurantId}/availability-rules`, {
        method: 'PUT',
        body: rows.map(({ id: _id, ...r }) => r),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['availability-rules', restaurantId] }),
  });

  function update(target: AvailabilityRuleItem, patch: Partial<AvailabilityRuleItem>) {
    setRows(rows.map((r) => (r === target ? { ...r, ...patch } : r)));
  }

  const visible = rows
    .filter((r) => dayFilter === -1 || r.day_of_week === dayFilter)
    .sort((a, b) => a.day_of_week - b.day_of_week || a.slot_time.localeCompare(b.slot_time));

  return (
    <Card
      title="Franjas y capacidad"
      actions={
        <>
          <Select
            className="w-36"
            value={dayFilter}
            onChange={(e) => setDayFilter(Number(e.target.value))}
          >
            <option value={-1}>Todos los días</option>
            {DAY_ORDER.map((d) => (
              <option key={d} value={d}>
                {DAY_NAMES_ES[d]}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            onClick={() =>
              setRows([
                ...rows,
                {
                  day_of_week: dayFilter === -1 ? 5 : dayFilter,
                  service_type: 'dinner',
                  slot_time: '21:00',
                  max_covers: 20,
                  max_party_size_auto_confirm: 8,
                  reservation_duration_minutes: 90,
                },
              ])
            }
          >
            + Añadir franja
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar franjas'}
          </Button>
        </>
      }
    >
      {visible.length === 0 ? (
        <EmptyState>Sin franjas: no se podrá reservar automáticamente.</EmptyState>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-1 pr-2">Día</th>
              <th className="py-1 pr-2">Servicio</th>
              <th className="py-1 pr-2">Hora</th>
              <th className="py-1 pr-2">Máx. comensales</th>
              <th className="py-1 pr-2">Grupo máx. auto</th>
              <th className="py-1 pr-2">Duración (min)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={`${row.id ?? 'new'}-${i}`}>
                <td className="py-1 pr-2">
                  <Select
                    value={row.day_of_week}
                    onChange={(e) => update(row, { day_of_week: Number(e.target.value) })}
                  >
                    {DAY_ORDER.map((d) => (
                      <option key={d} value={d}>
                        {DAY_NAMES_ES[d]}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="py-1 pr-2">
                  <Select
                    value={row.service_type}
                    onChange={(e) =>
                      update(row, {
                        service_type: e.target.value as AvailabilityRuleItem['service_type'],
                      })
                    }
                  >
                    {SERVICE_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {SERVICE_TYPE_LABELS_ES[s]}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="py-1 pr-2">
                  <Input
                    type="time"
                    value={row.slot_time}
                    onChange={(e) => update(row, { slot_time: e.target.value })}
                  />
                </td>
                <td className="py-1 pr-2">
                  <Input
                    type="number"
                    min={0}
                    value={row.max_covers}
                    onChange={(e) => update(row, { max_covers: Number(e.target.value) })}
                  />
                </td>
                <td className="py-1 pr-2">
                  <Input
                    type="number"
                    min={1}
                    value={row.max_party_size_auto_confirm}
                    onChange={(e) =>
                      update(row, { max_party_size_auto_confirm: Number(e.target.value) })
                    }
                  />
                </td>
                <td className="py-1 pr-2">
                  <Input
                    type="number"
                    min={15}
                    step={15}
                    value={row.reservation_duration_minutes}
                    onChange={(e) =>
                      update(row, { reservation_duration_minutes: Number(e.target.value) })
                    }
                  />
                </td>
                <td className="py-1">
                  <Button variant="ghost" onClick={() => setRows(rows.filter((r) => r !== row))}>
                    ✕
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ErrorText error={save.error} />
    </Card>
  );
}
