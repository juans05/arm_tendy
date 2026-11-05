'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { me } from '@/lib/api';
import { cambiarEmpresa, EmpresaAcceso, empresas } from '@/lib/cuentas';
import { borrarToken, destinoTrasMe, guardarToken } from '@/lib/sesion';

// La empresa del token no tiene ARM: el usuario puede cambiar a otra de sus empresas.
export default function ElegirEmpresa() {
  const router = useRouter();
  const [lista, setLista] = useState<EmpresaAcceso[]>([]);
  const [error, setError] = useState('');
  const [cambiando, setCambiando] = useState<number | null>(null);

  useEffect(() => {
    empresas().then(setLista).catch((e) => setError(e.message));
  }, []);

  async function elegir(e: EmpresaAcceso) {
    setError('');
    setCambiando(e.tenantId);
    try {
      guardarToken(await cambiarEmpresa(e.tenantId));
      const r = await me();
      if (r.code === 'SIN_ARM') setError(`${e.nombre} no tiene ARM contratado`);
      else router.replace(destinoTrasMe({ status: r.status, code: r.code, rol: r.data?.miembro.rol, estado: r.data?.miembro.estado }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar de empresa');
    } finally {
      setCambiando(null);
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="font-display text-3xl font-bold">Tu empresa no tiene ARM contratado</h1>
      <p className="text-sm text-gris">Si perteneces a otra empresa que sí lo tiene, elígela:</p>
      <ul className="space-y-2">
        {lista.map((e) => (
          <li key={e.tenantId}>
            <button
              onClick={() => elegir(e)}
              disabled={cambiando !== null}
              className="w-full rounded border bg-white px-4 py-3 text-left hover:bg-papel disabled:opacity-50"
            >
              {e.nombre} {e.activa && <span className="text-xs text-gris">(actual)</span>}
              {cambiando === e.tenantId && <span className="ml-2 text-xs">Cambiando…</span>}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-peligro">{error}</p>}
      <button className="text-sm underline" onClick={() => { borrarToken(); router.replace('/login'); }}>Salir</button>
    </main>
  );
}
