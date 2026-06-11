import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { CallLog } from '../api/types';
import { useRestaurant } from '../state/restaurant';
import { EmptyState, StatusBadge } from '../components/ui';
import { fmtDateTime } from '../lib/dates';

const OUTCOME_LABELS: Record<string, string> = {
  reservation_created: 'Reserva creada',
  reservation_cancelled: 'Reserva cancelada',
  needs_review: 'A revisión',
  handoff: 'Derivada',
  error: 'Error',
  slot_full: 'Sin hueco',
  cancel_not_found: 'Cancelación sin match',
  cancel_ambiguous: 'Cancelación ambigua',
  ai_disabled: 'IA desactivada',
  past_date: 'Fecha pasada',
};

export function CallLogsPage() {
  const { selected } = useRestaurant();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['call-logs', selected?.id],
    enabled: Boolean(selected),
    queryFn: () => api<CallLog[]>(`/call-logs?restaurant_id=${selected!.id}`),
  });

  if (!selected) return <EmptyState>Selecciona un restaurante.</EmptyState>;

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold">Registro de llamadas y acciones de la IA</h1>
      {isLoading ? (
        <EmptyState>Cargando…</EmptyState>
      ) : logs.length === 0 ? (
        <EmptyState>Aún no hay llamadas registradas.</EmptyState>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <details
              key={log.id}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5"
            >
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
                <span className="text-slate-400">{fmtDateTime(log.created_at)}</span>
                <span className="font-medium">{log.caller_phone ?? 'sin teléfono'}</span>
                {log.outcome && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                    {OUTCOME_LABELS[log.outcome] ?? log.outcome}
                  </span>
                )}
                {log.provider_call_id && (
                  <span className="text-xs text-slate-400">{log.provider_call_id}</span>
                )}
                {log.reservation && (
                  <span className="flex items-center gap-1 text-xs">
                    → {log.reservation.customer_name} ({log.reservation.date}{' '}
                    {log.reservation.time}) <StatusBadge status={log.reservation.status} />
                  </span>
                )}
                <span className="ml-auto text-xs text-slate-400">
                  {log.tool_calls.length} tool call{log.tool_calls.length === 1 ? '' : 's'}
                </span>
              </summary>
              <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                {log.transcript && (
                  <p className="text-sm text-slate-600">
                    <strong>Transcripción:</strong> {log.transcript}
                  </p>
                )}
                {log.tool_calls.map((tc, i) => (
                  <div key={i} className="rounded bg-slate-50 p-2 text-xs">
                    <p className="mb-1 font-semibold">
                      {tc.tool} <span className="font-normal text-slate-400">{tc.at}</span>
                    </p>
                    <pre className="overflow-auto whitespace-pre-wrap text-[11px] text-slate-600">
                      → {JSON.stringify(tc.input)}
                      {'\n'}← {JSON.stringify(tc.output)}
                    </pre>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
