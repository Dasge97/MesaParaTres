import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { CalendarEvent } from '../api/types';
import { useRestaurant } from '../state/restaurant';
import { Button, EmptyState, StatusBadge, STATUS_COLORS } from '../components/ui';
import { NewReservationModal } from '../components/reservations/NewReservationModal';
import { BlockSlotModal } from '../components/reservations/BlockSlotModal';
import { ReservationDrawer } from '../components/reservations/ReservationDrawer';
import { addDaysISO, fmtDayLabel, fmtShort, todayISO, weekDays } from '../lib/dates';

type View = 'day' | 'week';

const LEGEND: { status: Parameters<typeof StatusBadge>[0]['status']; }[] = [
  { status: 'confirmed' },
  { status: 'pending' },
  { status: 'needs_review' },
  { status: 'cancelled' },
  { status: 'blocked' },
];

export function CalendarPage() {
  const { selected } = useRestaurant();
  const qc = useQueryClient();
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState(todayISO());
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showBlock, setShowBlock] = useState(false);

  const days = view === 'day' ? [anchor] : weekDays(anchor);
  const from = days[0];
  const to = days[days.length - 1];

  const { data, isLoading } = useQuery({
    queryKey: ['calendar', selected?.id, from, to],
    enabled: Boolean(selected),
    queryFn: () =>
      api<{ events: CalendarEvent[] }>(
        `/calendar?restaurant_id=${selected!.id}&from=${from}&to=${to}`,
      ),
  });

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const day of days) map.set(day, []);
    for (const ev of data?.events ?? []) map.get(ev.date)?.push(ev);
    return map;
  }, [data, days]);

  const deleteBlock = useMutation({
    mutationFn: (id: string) => api(`/blocked-slots/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: ['blocked-slots'] });
    },
  });

  function onEventClick(ev: CalendarEvent) {
    if (ev.type === 'reservation') {
      setDrawerId(ev.id);
    } else if (
      window.confirm(
        `Bloqueo: ${ev.title}\n${ev.start_time ? `${ev.start_time}–${ev.end_time}` : 'Día completo'}\n\n¿Eliminar este bloqueo?`,
      )
    ) {
      deleteBlock.mutate(ev.id);
    }
  }

  if (!selected) return <EmptyState>Selecciona un restaurante.</EmptyState>;
  const step = view === 'day' ? 1 : 7;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-lg font-bold">Calendario</h1>
        <div className="flex overflow-hidden rounded-md border border-slate-300">
          {(['day', 'week'] as View[]).map((v) => (
            <button
              key={v}
              className={`px-3 py-1.5 text-sm font-medium ${
                view === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
              onClick={() => setView(v)}
            >
              {v === 'day' ? 'Día' : 'Semana'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="secondary" onClick={() => setAnchor(addDaysISO(anchor, -step))}>
            ‹
          </Button>
          <Button variant="secondary" onClick={() => setAnchor(todayISO())}>
            Hoy
          </Button>
          <Button variant="secondary" onClick={() => setAnchor(addDaysISO(anchor, step))}>
            ›
          </Button>
        </div>
        <input
          type="date"
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white"
          value={anchor}
          onChange={(e) => e.target.value && setAnchor(e.target.value)}
        />
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={() => setShowBlock(true)}>
            Bloquear franja
          </Button>
          <Button onClick={() => setShowNew(true)}>+ Nueva reserva</Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {LEGEND.map((l) => (
          <StatusBadge key={l.status} status={l.status} />
        ))}
      </div>

      {isLoading ? (
        <EmptyState>Cargando…</EmptyState>
      ) : view === 'day' ? (
        <DayView
          date={anchor}
          events={eventsByDay.get(anchor) ?? []}
          onEventClick={onEventClick}
        />
      ) : (
        <WeekView
          days={days}
          eventsByDay={eventsByDay}
          onEventClick={onEventClick}
          onDayClick={(d) => {
            setAnchor(d);
            setView('day');
          }}
        />
      )}

      {drawerId && <ReservationDrawer reservationId={drawerId} onClose={() => setDrawerId(null)} />}
      {showNew && (
        <NewReservationModal
          restaurantId={selected.id}
          defaultDate={anchor}
          onClose={() => setShowNew(false)}
        />
      )}
      {showBlock && (
        <BlockSlotModal
          restaurantId={selected.id}
          defaultDate={anchor}
          onClose={() => setShowBlock(false)}
        />
      )}
    </div>
  );
}

function chipClasses(ev: CalendarEvent): string {
  const base = STATUS_COLORS[ev.status] ?? STATUS_COLORS.blocked;
  const cancelled = ev.status === 'cancelled' ? 'line-through opacity-60' : '';
  const review = ev.status === 'needs_review' ? 'ring-2 ring-orange-400' : '';
  return `${base} ${cancelled} ${review}`;
}

function DayView({
  date,
  events,
  onEventClick,
}: {
  date: string;
  events: CalendarEvent[];
  onEventClick: (ev: CalendarEvent) => void;
}) {
  const blocks = events.filter((e) => e.type === 'blocked_slot');
  const reservations = events.filter((e) => e.type === 'reservation');
  const activePax = reservations
    .filter((r) => r.status === 'confirmed' || r.status === 'pending')
    .reduce((acc, r) => acc + (r.party_size ?? 0), 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold capitalize">{fmtDayLabel(date)}</h2>
        <span className="text-xs text-slate-500">
          {reservations.length} reservas · {activePax} pax activos
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {blocks.map((b) => (
          <button
            key={b.id}
            onClick={() => onEventClick(b)}
            className="block w-full bg-slate-100 px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-200"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(0,0,0,0.04) 8px, rgba(0,0,0,0.04) 16px)',
            }}
          >
            ⛔ {b.start_time ? `${b.start_time}–${b.end_time}` : 'Día completo'} · {b.title}
          </button>
        ))}
        {reservations.length === 0 && blocks.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-400">Sin reservas este día.</p>
        )}
        {reservations.map((r) => (
          <button
            key={r.id}
            onClick={() => onEventClick(r)}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
              r.status === 'cancelled' ? 'opacity-50' : ''
            }`}
          >
            <span className="w-12 font-bold tabular-nums">{r.time}</span>
            <span className={`font-medium ${r.status === 'cancelled' ? 'line-through' : ''}`}>
              {r.customer_name}
            </span>
            <span className="text-slate-500">{r.party_size} pax</span>
            {r.customer_phone && <span className="text-slate-400">{r.customer_phone}</span>}
            <span className="ml-auto flex items-center gap-2">
              {r.notes && (
                <span className="max-w-48 truncate text-xs text-slate-400" title={r.notes}>
                  📝 {r.notes}
                </span>
              )}
              <StatusBadge status={r.status} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function WeekView({
  days,
  eventsByDay,
  onEventClick,
  onDayClick,
}: {
  days: string[];
  eventsByDay: Map<string, CalendarEvent[]>;
  onEventClick: (ev: CalendarEvent) => void;
  onDayClick: (date: string) => void;
}) {
  const today = todayISO();
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day) => {
        const events = eventsByDay.get(day) ?? [];
        const isToday = day === today;
        return (
          <div
            key={day}
            className={`min-h-48 rounded-lg border bg-white ${
              isToday ? 'border-slate-900' : 'border-slate-200'
            }`}
          >
            <button
              onClick={() => onDayClick(day)}
              className={`w-full border-b px-2 py-1.5 text-left text-xs font-semibold capitalize hover:bg-slate-50 ${
                isToday ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-100'
              }`}
            >
              {fmtDayLabel(day)}
            </button>
            <div className="space-y-1 p-1.5">
              {events.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => onEventClick(ev)}
                  className={`block w-full truncate rounded border px-1.5 py-1 text-left text-[11px] leading-tight ${chipClasses(ev)}`}
                  title={
                    ev.type === 'reservation'
                      ? `${ev.time} · ${ev.customer_name} · ${ev.party_size} pax (${ev.status})${ev.notes ? `\n${ev.notes}` : ''}`
                      : `Bloqueo: ${ev.title}`
                  }
                >
                  {ev.type === 'reservation'
                    ? `${ev.time} ${ev.customer_name} · ${ev.party_size}p`
                    : `⛔ ${ev.start_time ? `${ev.start_time}–${ev.end_time}` : 'Día'} ${ev.title}`}
                </button>
              ))}
              {events.length === 0 && (
                <p className="px-1 py-2 text-center text-[11px] text-slate-300">—</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
