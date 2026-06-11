import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, setToken } from '../api/client';
import type { Reservation } from '../api/types';
import { useRestaurant } from '../state/restaurant';
import { Select } from './ui';

const NAV = [
  { to: '/calendario', label: 'Calendario' },
  { to: '/reservas', label: 'Reservas' },
  { to: '/disponibilidad', label: 'Disponibilidad' },
  { to: '/bloqueos', label: 'Bloqueos' },
  { to: '/revision', label: 'Por revisar' },
  { to: '/llamadas', label: 'Llamadas' },
  { to: '/restaurantes', label: 'Restaurantes' },
  { to: '/ajustes', label: 'Ajustes' },
];

export function Layout() {
  const navigate = useNavigate();
  const { restaurants, selected, setSelectedId } = useRestaurant();

  const { data: reviewCount = 0 } = useQuery({
    queryKey: ['review-count', selected?.id],
    enabled: Boolean(selected),
    refetchInterval: 30_000,
    queryFn: async () => {
      const list = await api<Reservation[]>(
        `/reservations?restaurant_id=${selected!.id}&status=needs_review`,
      );
      return list.length;
    },
  });

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-52 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="px-4 py-4">
          <span className="text-lg font-bold tracking-tight">
            Mesa<span className="text-orange-600">Para</span>Tres
          </span>
        </div>
        <nav className="flex-1 space-y-0.5 px-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <span>{item.label}</span>
              {item.to === '/revision' && reviewCount > 0 && (
                <span className="rounded-full bg-orange-500 px-1.5 text-[11px] font-bold text-white">
                  {reviewCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <button
          className="m-3 rounded-md px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100"
          onClick={() => {
            setToken(null);
            navigate('/login');
          }}
        >
          Cerrar sesión
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div className="w-72">
            <Select
              value={selected?.id ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </div>
          {selected && !selected.is_ai_enabled && (
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
              IA telefónica desactivada
            </span>
          )}
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
