'use client';
import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Cuenta = { cuentaId: string; nombre: string; moneda: string } | null;

// Cuenta publicitaria de Meta: con ella el panel calcula el costo por lead, demo y venta.
export default function CuentaAnuncios() {
  const [cuenta, setCuenta] = useState<Cuenta | undefined>(undefined);
  const [cuentaId, setCuentaId] = useState('');
  const [token, setToken] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ cuenta: Cuenta }>('/anuncios/cuenta').then((r) => setCuenta(r.data?.cuenta ?? null));
  }, []);

  async function conectar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setError('');
    const r = await api<{ cuenta: Cuenta }>('/anuncios/cuenta', { method: 'PUT', body: JSON.stringify({ cuentaId, token }) });
    setOcupado(false);
    if (!r.data) return setError(r.message ?? 'No se pudo conectar la cuenta');
    setCuenta(r.data.cuenta);
    setToken('');
  }

  async function desconectar() {
    const r = await api('/anuncios/cuenta', { method: 'DELETE' });
    if (r.status === 200) setCuenta(null);
  }

  if (cuenta === undefined) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold">Anuncios de Meta</h2>
      {cuenta ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-linea bg-white px-4 py-3">
          <p className="mr-auto">
            <span className="font-semibold">{cuenta.nombre}</span>
            <span className="block text-sm text-gris">
              Cuenta {cuenta.cuentaId} · {cuenta.moneda}
            </span>
          </p>
          <button onClick={desconectar} className="rounded-xl border border-linea px-3 py-1.5 text-sm font-medium">
            Desconectar
          </button>
        </div>
      ) : (
        <form onSubmit={conectar} className="space-y-3 rounded-2xl border border-linea bg-white p-4">
          <p className="text-sm text-gris">
            Con el gasto de tus anuncios, el panel muestra cuánto te cuesta cada lead, demo y venta. Usa un token de usuario del sistema de Business Manager con permiso <code>ads_read</code>.
          </p>
          <label className="block text-sm font-medium">
            ID de la cuenta publicitaria
            <input value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} required pattern="(act_)?[0-9]+" placeholder="act_1234567890" className="mt-1 w-full rounded-xl border border-linea px-3 py-2" />
          </label>
          <label className="block text-sm font-medium">
            Token de acceso
            <input type="password" value={token} onChange={(e) => setToken(e.target.value)} required autoComplete="off" className="mt-1 w-full rounded-xl border border-linea px-3 py-2" />
          </label>
          {error && <p className="text-sm text-peligro">{error}</p>}
          <button disabled={ocupado} className="rounded-xl bg-tinta px-4 py-2 font-semibold text-white disabled:opacity-50">
            {ocupado ? 'Conectando…' : 'Conectar cuenta'}
          </button>
        </form>
      )}
    </section>
  );
}
