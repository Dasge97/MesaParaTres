import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Restaurant } from '../api/types';
import { useRestaurant } from '../state/restaurant';
import { Button, Card, EmptyState, ErrorText, Field, Input } from '../components/ui';

/**
 * Ajustes del restaurante seleccionado: IA telefónica, notificaciones e
 * información para configurar las tools en ElevenLabs. La integración con
 * Google Calendar queda fuera del MVP (el calendario interno es la vista
 * operativa); se añadirá más adelante como sync externo opcional.
 */
export function SettingsPage() {
  const { selected } = useRestaurant();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    notification_email: '',
    notification_phone: '',
    elevenlabs_agent_id: '',
    is_ai_enabled: true,
    max_party_size_global: 12,
  });
  useEffect(() => {
    if (selected) {
      setForm({
        notification_email: selected.notification_email ?? '',
        notification_phone: selected.notification_phone ?? '',
        elevenlabs_agent_id: selected.elevenlabs_agent_id ?? '',
        is_ai_enabled: selected.is_ai_enabled,
        max_party_size_global: selected.max_party_size_global,
      });
    }
  }, [selected]);

  const save = useMutation({
    mutationFn: () =>
      api<Restaurant>(`/restaurants/${selected!.id}`, {
        method: 'PATCH',
        body: {
          notification_email: form.notification_email || null,
          notification_phone: form.notification_phone || null,
          elevenlabs_agent_id: form.elevenlabs_agent_id || null,
          is_ai_enabled: form.is_ai_enabled,
          max_party_size_global: form.max_party_size_global,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['restaurants'] }),
  });

  if (!selected) return <EmptyState>Selecciona un restaurante.</EmptyState>;

  const toolBase = '<URL pública de la API>/tools';
  const tools = [
    ['check_availability', `POST ${toolBase}/check-availability`],
    ['create_reservation', `POST ${toolBase}/create-reservation`],
    ['cancel_reservation', `POST ${toolBase}/cancel-reservation`],
    ['request_human_review', `POST ${toolBase}/request-human-review`],
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-lg font-bold">Ajustes — {selected.name}</h1>

      <Card title="IA telefónica y avisos">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_ai_enabled}
              onChange={(e) => setForm({ ...form, is_ai_enabled: e.target.checked })}
            />
            IA telefónica activada (si se desactiva, la IA deriva todas las llamadas)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email para avisos">
              <Input
                type="email"
                value={form.notification_email}
                onChange={(e) => setForm({ ...form, notification_email: e.target.value })}
              />
            </Field>
            <Field label="Teléfono para avisos">
              <Input
                value={form.notification_phone}
                onChange={(e) => setForm({ ...form, notification_phone: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Grupo máximo global (por encima siempre pasa a revisión)">
            <Input
              type="number"
              min={1}
              value={form.max_party_size_global}
              onChange={(e) =>
                setForm({ ...form, max_party_size_global: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="ID del agente de ElevenLabs">
            <Input
              placeholder="agent_…"
              value={form.elevenlabs_agent_id}
              onChange={(e) => setForm({ ...form, elevenlabs_agent_id: e.target.value })}
            />
          </Field>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar ajustes'}
          </Button>
          <ErrorText error={save.error} />
        </div>
      </Card>

      <Card title="Configuración de tools en ElevenLabs">
        <p className="mb-3 text-sm text-slate-600">
          En el agente de ElevenLabs, configura estas webhook tools apuntando a la API. Todas
          requieren el header <code className="rounded bg-slate-100 px-1">X-Tools-Secret</code>{' '}
          (variable <code className="rounded bg-slate-100 px-1">TOOLS_SHARED_SECRET</code> del
          servidor) e incluir{' '}
          <code className="rounded bg-slate-100 px-1">restaurant_id: {selected.id}</code> en cada
          llamada.
        </p>
        <ul className="space-y-1 text-sm">
          {tools.map(([name, url]) => (
            <li key={name} className="flex gap-2">
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{name}</code>
              <span className="text-xs text-slate-500">{url}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Google Calendar">
        <p className="text-sm text-slate-500">
          Fuera del MVP. El calendario interno del panel es la vista operativa; la
          sincronización con Google Calendar se añadirá más adelante como integración opcional.
        </p>
      </Card>
    </div>
  );
}
