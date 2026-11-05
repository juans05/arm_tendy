'use client';
import { useEffect, useState } from 'react';
import { api, Miembro } from '@/lib/api';

export default function Miembros() {
  const [lista, setLista] = useState<Miembro[]>([]);
  const [error, setError] = useState('');

  const cargar = () => api<Miembro[]>('/miembros').then((r) => (r.data ? setLista(r.data) : setError(r.message ?? 'Error')));
  useEffect(() => { cargar(); }, []);

  async function cambiar(m: Miembro, cambios: Partial<Miembro>) {
    setError('');
    const r = await api<Miembro>(`/miembros/${m.id}`, { method: 'PATCH', body: JSON.stringify(cambios) });
    if (r.data) setLista((l) => l.map((x) => (x.id === m.id ? r.data! : x)));
    else { setError(r.message ?? 'No se pudo guardar'); cargar(); }
  }

  return (
    <section className="mx-auto max-w-5xl space-y-3 px-4 py-6 md:px-8 md:py-10">
      <h1 className="font-display text-3xl font-bold">Miembros</h1>
      <p className="text-sm text-gris">Quien entra a ARM con un usuario de tu empresa aparece aquí como pendiente. Actívalo y asígnale su rol.</p>
      {error && <p className="text-sm text-peligro">{error}</p>}
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-papel text-left">
            <tr><th className="p-2">Nombre</th><th className="p-2">Rol</th><th className="p-2">Estado</th><th className="p-2">Recibe demos</th><th className="p-2">Celular para alertas</th></tr>
          </thead>
          <tbody>
            {lista.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-2">{m.nombre}<div className="text-xs text-gris">{m.username}</div></td>
                <td className="p-2">
                  <select value={m.rol} onChange={(e) => cambiar(m, { rol: e.target.value as Miembro['rol'] })} className="rounded-xl border border-linea px-2 py-1">
                    <option value="gerente">Gerente</option><option value="comercial">Comercial</option>
                  </select>
                </td>
                <td className="p-2">
                  <select value={m.estado} onChange={(e) => cambiar(m, { estado: e.target.value as Miembro['estado'] })} className="rounded-xl border border-linea px-2 py-1">
                    <option value="pendiente">Pendiente</option><option value="activo">Activo</option><option value="inactivo">Inactivo</option>
                  </select>
                </td>
                <td className="p-2"><input type="checkbox" checked={m.recibeDemos} onChange={(e) => cambiar(m, { recibeDemos: e.target.checked })} /></td>
                <td className="p-2">
                  <input
                    defaultValue={m.celularAlertas ?? ''}
                    placeholder="+51987654321"
                    className="w-36 rounded border px-2 py-1"
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== m.celularAlertas) cambiar(m, { celularAlertas: v });
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
