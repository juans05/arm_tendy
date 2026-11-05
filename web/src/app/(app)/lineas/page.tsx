'use client';
import { FormEvent, useEffect, useState } from 'react';
import { api, Linea, Miembro } from '@/lib/api';
import { useMiembro } from '@/lib/miembro-ctx';

interface Form { id?: string; nombre: string; criterios: string; duracionDemoMin: number; activa: boolean; comercialIds: string[] }
const vacio: Form = { nombre: '', criterios: '', duracionDemoMin: 30, activa: true, comercialIds: [] };

export default function Lineas() {
  const { miembro } = useMiembro();
  const esGerente = miembro.rol === 'gerente';
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');

  const cargar = () => api<Linea[]>('/lineas').then((r) => r.data && setLineas(r.data));
  useEffect(() => {
    cargar();
    if (esGerente) api<Miembro[]>('/miembros').then((r) => r.data && setMiembros(r.data.filter((m) => m.estado === 'activo')));
  }, [esGerente]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    const { id, ...datos } = form;
    const r = await api<Linea>(id ? `/lineas/${id}` : '/lineas', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(datos) });
    if (!r.data) return setError(r.message ?? 'No se pudo guardar');
    setForm(null);
    setError('');
    cargar();
  }

  const editar = (l: Linea) =>
    setForm({ id: l.id, nombre: l.nombre, criterios: l.criterios, duracionDemoMin: l.duracionDemoMin, activa: l.activa, comercialIds: l.comerciales.filter((c) => c.estado === 'activo').map((c) => c.id) });

  return (
    <section className="mx-auto max-w-5xl space-y-4 px-4 py-6 md:px-8 md:py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Líneas de producto</h1>
        {esGerente && !form && <button className="rounded bg-tinta px-3 py-2 text-sm text-white" onClick={() => setForm(vacio)}>Nueva línea</button>}
      </div>

      {form && (
        <form onSubmit={guardar} className="space-y-3 rounded border bg-white p-4">
          <label className="block text-sm">Nombre
            <input className="mt-1 w-full rounded border px-3 py-2" value={form.nombre} maxLength={100} required onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </label>
          <label className="block text-sm">Criterios de calificación (cuándo pasar a demo)
            <textarea className="mt-1 h-32 w-full rounded border px-3 py-2" value={form.criterios} maxLength={4000} onChange={(e) => setForm({ ...form, criterios: e.target.value })} />
          </label>
          <div className="flex flex-wrap gap-6 text-sm">
            <label>Duración de la demo (min)
              <input type="number" min={15} max={180} className="ml-2 w-20 rounded border px-2 py-1" value={form.duracionDemoMin} onChange={(e) => setForm({ ...form, duracionDemoMin: Number(e.target.value) })} />
            </label>
            <label><input type="checkbox" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} /> Activa</label>
          </div>
          <fieldset className="text-sm">
            <legend>Comerciales que hacen sus demos (si no eliges ninguno, todos los que reciben demos)</legend>
            <div className="mt-1 flex flex-wrap gap-4">
              {miembros.map((m) => (
                <label key={m.id}>
                  <input
                    type="checkbox"
                    checked={form.comercialIds.includes(m.id)}
                    onChange={(e) => setForm({ ...form, comercialIds: e.target.checked ? [...form.comercialIds, m.id] : form.comercialIds.filter((x) => x !== m.id) })}
                  /> {m.nombre}
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p className="text-sm text-peligro">{error}</p>}
          <div className="flex gap-3">
            <button className="rounded bg-tinta px-4 py-2 text-sm text-white">Guardar</button>
            <button type="button" className="text-sm underline" onClick={() => { setForm(null); setError(''); }}>Cancelar</button>
          </div>
        </form>
      )}

      <ul className="space-y-2">
        {lineas.map((l) => (
          <li key={l.id} className="rounded-xl border border-linea bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{l.nombre} {!l.activa && <span className="text-xs text-gris">(inactiva)</span>}</span>
              {esGerente && <button className="text-sm underline" onClick={() => editar(l)}>Editar</button>}
            </div>
            <p className="text-sm text-gris">
              Demo de {l.duracionDemoMin} min · {l.comerciales.length ? l.comerciales.map((c) => c.nombre).join(', ') : 'todos los que reciben demos'}
            </p>
            {l.criterios && <p className="mt-2 whitespace-pre-wrap text-sm">{l.criterios}</p>}
          </li>
        ))}
        {!lineas.length && <li className="text-sm text-gris">Aún no hay líneas de producto.</li>}
      </ul>
    </section>
  );
}
