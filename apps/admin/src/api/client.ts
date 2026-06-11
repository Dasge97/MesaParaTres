const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

const TOKEN_KEY = 'mesaparatres_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { error?: string; message?: string; details?: unknown } | null,
  ) {
    super(body?.message ?? `Error ${status}`);
  }
}

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401 && !path.startsWith('/auth')) {
    setToken(null);
    window.location.href = '/login';
    throw new ApiError(401, null);
  }
  if (!res.ok) {
    let body = null;
    try {
      body = await res.json();
    } catch {
      // sin cuerpo JSON
    }
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}
