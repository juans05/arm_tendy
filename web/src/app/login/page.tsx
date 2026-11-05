'use client';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { login } from '@/lib/cuentas';
import { guardarToken } from '@/lib/sesion';

export default function Login() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      guardarToken(await login(usuario, clave));
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow">
        <div>
          <h1 className="text-2xl font-semibold">ARM</h1>
          <p className="text-sm text-slate-500">Entra con tu usuario de la suite</p>
        </div>
        <label className="block text-sm">
          Usuario
          <input className="mt-1 w-full rounded border px-3 py-2" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" required />
        </label>
        <label className="block text-sm">
          Contraseña
          <input className="mt-1 w-full rounded border px-3 py-2" type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={enviando} className="w-full rounded bg-slate-900 py-2 text-white disabled:opacity-50">
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
