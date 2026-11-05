'use client';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { login } from '@/lib/cuentas';
import Marca from '@/components/Marca';
import { me } from '@/lib/api';
import { borrarToken, destinoTrasMe, errorTrasLogin, guardarToken } from '@/lib/sesion';

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
      const r = await me();
      const problema = errorTrasLogin(r.status);
      if (problema) {
        borrarToken();
        return setError(problema);
      }
      router.replace(destinoTrasMe({ status: r.status, code: r.code, rol: r.data?.miembro.rol, estado: r.data?.miembro.estado }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="grid min-h-dvh md:grid-cols-[1.1fr_1fr]">
      {/* Lado de marca: una conversación de ejemplo dice qué hace ARM mejor que un eslogan. */}
      <section className="flex flex-col justify-between gap-10 bg-tinta px-6 pb-10 pt-[calc(2rem+env(safe-area-inset-top))] text-white md:p-12">
        <Marca grande />
        <div className="max-w-md space-y-2.5" aria-hidden>
          <p className="w-fit max-w-[80%] rounded-2xl rounded-bl-md bg-white px-4 py-2 text-tinta">Hola, ¿el sistema sirve para mi barbería?</p>
          <p className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-menta-suave px-4 py-2 text-tinta">
            ¡Sí! ¿Cuántos barberos trabajan contigo? Te muestro la agenda en una demo de 30 min.
          </p>
          <p className="w-fit rounded-2xl rounded-bl-md bg-white px-4 py-2 text-tinta">Somos 4. ¿Mañana a las 10?</p>
          <p className="ml-auto w-fit rounded-full bg-mango px-4 py-1.5 text-sm font-semibold text-tinta">Demo agendada con Ana</p>
        </div>
        <p className="hidden max-w-sm text-white/60 md:block">Tus clientes escriben por WhatsApp; ARM los atiende, los ordena y se los pasa a tu equipo.</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <form onSubmit={entrar} className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="font-display text-3xl font-bold">Entra a ARM</h1>
            <p className="mt-1 text-gris">Usa el mismo usuario de la suite.</p>
          </div>
          <label className="block text-sm font-medium">
            Usuario
            <input
              className="mt-1.5 w-full rounded-xl border border-linea bg-white px-3.5 py-3 outline-none focus:border-uva"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Contraseña
            <input
              className="mt-1.5 w-full rounded-xl border border-linea bg-white px-3.5 py-3 outline-none focus:border-uva"
              type="password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="text-sm text-peligro">{error}</p>}
          <button disabled={enviando} className="w-full rounded-xl bg-mango py-3 font-semibold text-tinta transition active:scale-[0.99] disabled:opacity-50">
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
