import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api/client';
import { Button, ErrorText, Field, Input } from '../components/ui';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ token: string }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      setToken(res.token);
      navigate('/calendario');
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="mb-1 text-xl font-bold">
          Mesa<span className="text-orange-600">Para</span>Tres
        </h1>
        <p className="mb-5 text-sm text-slate-500">Panel de administración</p>
        <div className="space-y-3">
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </Field>
          <Field label="Contraseña">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
        </div>
        <Button className="mt-5 w-full" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </Button>
        <ErrorText error={error} />
      </form>
    </div>
  );
}
