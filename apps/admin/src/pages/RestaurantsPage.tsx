import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Restaurant } from '../api/types';
import { useRestaurant } from '../state/restaurant';
import { Button, ErrorText, Field, Input, Modal } from '../components/ui';

const EMPTY_FORM = {
  name: '',
  phone: '',
  timezone: 'Europe/Madrid',
  default_language: 'es',
  notification_email: '',
  notification_phone: '',
  max_party_size_global: 12,
};

export function RestaurantsPage() {
  const { restaurants } = useRestaurant();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Restaurant | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['restaurants'] });
  }

  const create = useMutation({
    mutationFn: () =>
      api<Restaurant>('/restaurants', {
        method: 'POST',
        body: {
          ...form,
          phone: form.phone || null,
          notification_email: form.notification_email || null,
          notification_phone: form.notification_phone || null,
        },
      }),
    onSuccess: () => {
      invalidate();
      setCreating(false);
      setForm(EMPTY_FORM);
    },
  });

  const update = useMutation({
    mutationFn: (patch: Partial<Restaurant> & { id: string }) =>
      api<Restaurant>(`/restaurants/${patch.id}`, {
        method: 'PATCH',
        body: { ...patch, id: undefined },
      }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">Restaurantes</h1>
        <Button onClick={() => setCreating(true)}>+ Nuevo restaurante</Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Teléfono</th>
              <th className="px-3 py-2">Zona horaria</th>
              <th className="px-3 py-2">Email avisos</th>
              <th className="px-3 py-2">IA telefónica</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {restaurants.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 text-slate-500">{r.phone ?? '—'}</td>
                <td className="px-3 py-2 text-slate-500">{r.timezone}</td>
                <td className="px-3 py-2 text-slate-500">{r.notification_email ?? '—'}</td>
                <td className="px-3 py-2">
                  <button
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      r.is_ai_enabled
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                    onClick={() =>
                      update.mutate({ id: r.id, is_ai_enabled: !r.is_ai_enabled })
                    }
                  >
                    {r.is_ai_enabled ? 'Activada' : 'Desactivada'}
                  </button>
                </td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" onClick={() => setEditing(r)}>
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <Modal title="Nuevo restaurante" onClose={() => setCreating(false)}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <RestaurantFields form={form} setForm={setForm} />
            <Button className="w-full" disabled={create.isPending}>
              Crear restaurante
            </Button>
            <ErrorText error={create.error} />
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title={`Editar ${editing.name}`} onClose={() => setEditing(null)}>
          <EditForm
            restaurant={editing}
            onSave={(patch) => update.mutate({ id: editing.id, ...patch })}
            saving={update.isPending}
            error={update.error}
          />
        </Modal>
      )}
    </div>
  );
}

function RestaurantFields({
  form,
  setForm,
}: {
  form: typeof EMPTY_FORM;
  setForm: (f: typeof EMPTY_FORM) => void;
}) {
  return (
    <>
      <Field label="Nombre">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Teléfono">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Zona horaria">
          <Input
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email para avisos">
          <Input
            type="email"
            value={form.notification_email}
            onChange={(e) => setForm({ ...form, notification_email: e.target.value })}
          />
        </Field>
        <Field label="Grupo máximo (global)">
          <Input
            type="number"
            min={1}
            value={form.max_party_size_global}
            onChange={(e) =>
              setForm({ ...form, max_party_size_global: Number(e.target.value) })
            }
          />
        </Field>
      </div>
    </>
  );
}

function EditForm({
  restaurant,
  onSave,
  saving,
  error,
}: {
  restaurant: Restaurant;
  onSave: (patch: Partial<Restaurant>) => void;
  saving: boolean;
  error: unknown;
}) {
  const [form, setForm] = useState({
    name: restaurant.name,
    phone: restaurant.phone ?? '',
    timezone: restaurant.timezone,
    default_language: restaurant.default_language,
    notification_email: restaurant.notification_email ?? '',
    notification_phone: restaurant.notification_phone ?? '',
    max_party_size_global: restaurant.max_party_size_global,
  });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...form,
          phone: form.phone || null,
          notification_email: form.notification_email || null,
          notification_phone: form.notification_phone || null,
        });
      }}
    >
      <RestaurantFields form={form} setForm={setForm} />
      <Field label="Teléfono para avisos">
        <Input
          value={form.notification_phone}
          onChange={(e) => setForm({ ...form, notification_phone: e.target.value })}
        />
      </Field>
      <Button className="w-full" disabled={saving}>
        Guardar cambios
      </Button>
      <ErrorText error={error} />
    </form>
  );
}
