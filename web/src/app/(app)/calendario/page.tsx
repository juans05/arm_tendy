'use client';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { IconoAtras, IconoBasura } from '@/components/Iconos';
import { api, Miembro } from '@/lib/api';
import { useMiembro } from '@/lib/miembro-ctx';

interface Cita {
  id: string;
  leadId: string | null;
  miembroId: string;
  inicio: string;
  fin: string;
  estado: 'agendada' | 'realizada' | 'no_asistio' | 'cancelada';
  origen: 'ia' | 'manual';
  titulo: string;
  link: string | null;
  conversacionId: string | null;
  contacto: string | null;
  miembro: string;
}
interface Franja {
  dia: number;
  desde: string;
  hasta: string;
}
interface Bloqueo {
  id: string;
  miembroId: string;
  inicio: string;
  fin: string;
  motivo: string;
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ESTADO: Record<Cita['estado'], { texto: string; clase: string }> = {
  agendada: { texto: 'Agendada', clase: 'border-l-mango' },
  realizada: { texto: 'Realizada', clase: 'border-l-menta' },
  no_asistio: { texto: 'No asistió', clase: 'border-l-peligro' },
  cancelada: { texto: 'Cancelada', clase: 'border-l-linea opacity-60' },
};

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
function lunes(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const masDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// ponytail: las fechas se muestran y se eligen en la hora del navegador; asume que el equipo está en la zona de la empresa.
export default function Calendario() {
  const { miembro } = useMiembro();
  const gerente = miembro.rol === 'gerente';
  const [semana, setSemana] = useState(() => lunes(new Date()));
  const [citas, setCitas] = useState<Cita[] | null>(null);
  const [equipo, setEquipo] = useState<Miembro[]>([miembro as Miembro]);
  const [vista, setVista] = useState<'semana' | 'horario'>('semana');
  const [nueva, setNueva] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    const q = `desde=${semana.toISOString()}&hasta=${masDias(semana, 7).toISOString()}`;
    return api<Cita[]>(`/citas?${q}`).then((r) => setCitas(r.data ?? []));
  }, [semana]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useEffect(() => {
    if (gerente) api<Miembro[]>('/miembros').then((r) => r.data && setEquipo(r.data.filter((m) => m.estado === 'activo')));
  }, [gerente]);

  async function estado(c: Cita, e: Cita['estado']) {
    const r = await api(`/citas/${c.id}/estado`, { method: 'POST', body: JSON.stringify({ estado: e }) });
    if (r.status >= 400) return setError(r.message ?? 'No se pudo actualizar');
    setError('');
    cargar();
  }

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => masDias(semana, i)), [semana]);
  const hoy = new Date().toDateString();

  return (
    <section className="mx-auto max-w-7xl space-y-5 px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="font-display text-3xl font-bold">Calendario</h1>
          <p className="text-sm text-gris">Las demos que agenda la IA aparecen solas. La IA solo ofrece horarios dentro de tu horario de atención.</p>
        </div>
        <div className="flex gap-1 rounded-full bg-white p-1" role="tablist">
          {(['semana', 'horario'] as const).map((v) => (
            <button key={v} role="tab" aria-selected={vista === v} onClick={() => setVista(v)} className={`rounded-full px-4 py-1.5 text-sm ${vista === v ? 'bg-tinta text-white' : 'text-gris'}`}>
              {v === 'semana' ? 'Semana' : 'Horario y bloqueos'}
            </button>
          ))}
        </div>
      </header>

      {vista === 'horario' ? (
        <Horario equipo={equipo} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setSemana(masDias(semana, -7))} className="rounded-xl border border-linea bg-white p-2" title="Semana anterior">
              <IconoAtras className="size-4" />
              <span className="sr-only">Semana anterior</span>
            </button>
            <button onClick={() => setSemana(lunes(new Date()))} className="rounded-xl border border-linea bg-white px-3 py-1.5 text-sm">
              Hoy
            </button>
            <button onClick={() => setSemana(masDias(semana, 7))} className="rounded-xl border border-linea bg-white p-2" title="Semana siguiente">
              <IconoAtras className="size-4 rotate-180" />
              <span className="sr-only">Semana siguiente</span>
            </button>
            <p className="font-semibold first-letter:uppercase">
              {semana.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' })} al{' '}
              {masDias(semana, 6).toLocaleDateString('es-PE', { day: 'numeric', month: 'long' })}
            </p>
            <button onClick={() => setNueva(true)} className="ml-auto rounded-xl bg-tinta px-4 py-2 text-sm font-semibold text-white">
              Nueva cita
            </button>
          </div>
          {error && <p className="text-sm text-peligro">{error}</p>}
          {nueva && (
            <NuevaCita
              equipo={equipo}
              miembroId={miembro.id}
              onCerrar={() => setNueva(false)}
              onCreada={() => {
                setNueva(false);
                cargar();
              }}
            />
          )}

          <div className="grid gap-3 md:grid-cols-7">
            {dias.map((d) => {
              const delDia = (citas ?? []).filter((c) => new Date(c.inicio).toDateString() === d.toDateString());
              return (
                <div key={d.toISOString()} className={`min-h-28 rounded-2xl p-2 ${d.toDateString() === hoy ? 'bg-mango-suave' : 'bg-white'}`}>
                  <p className="px-1 pb-2 text-sm">
                    <span className="font-semibold">{DIAS[d.getDay()]}</span> <span className="text-gris">{d.getDate()}</span>
                  </p>
                  <ul className="space-y-2">
                    {delDia.length === 0 && <li className="px-1 text-xs text-gris md:hidden">Sin citas</li>}
                    {delDia.map((c) => (
                      <li key={c.id} className={`rounded-xl border border-l-4 border-linea bg-white p-2 text-sm ${ESTADO[c.estado].clase}`}>
                        <p className="font-semibold">
                          {hhmm(c.inicio)}
                          {c.origen === 'ia' && <span className="ml-1.5 rounded bg-menta-suave px-1 text-[10px] font-bold text-menta">IA</span>}
                        </p>
                        <p className="truncate">{c.contacto ?? c.titulo}</p>
                        {gerente && <p className="truncate text-xs text-gris">{c.miembro}</p>}
                        <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-xs">
                          {c.conversacionId && (
                            <Link href={`/bandeja?c=${c.conversacionId}`} className="text-uva underline">
                              Chat
                            </Link>
                          )}
                          {c.link && (
                            <a href={c.link} target="_blank" rel="noreferrer" className="text-uva underline">
                              Enlace
                            </a>
                          )}
                          {c.estado === 'agendada' ? (
                            <>
                              <button onClick={() => estado(c, 'realizada')} className="text-menta underline">
                                Realizada
                              </button>
                              <button onClick={() => estado(c, 'no_asistio')} className="text-peligro underline">
                                No vino
                              </button>
                              <button onClick={() => estado(c, 'cancelada')} className="text-gris underline">
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <span className="text-gris">{ESTADO[c.estado].texto}</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function NuevaCita({ equipo, miembroId, onCerrar, onCreada }: { equipo: Miembro[]; miembroId: string; onCerrar: () => void; onCreada: () => void }) {
  const [quien, setQuien] = useState(miembroId);
  const [cuando, setCuando] = useState('');
  const [duracion, setDuracion] = useState(30);
  const [titulo, setTitulo] = useState('Demo');
  const [link, setLink] = useState('');
  const [error, setError] = useState('');

  async function crear(e: FormEvent) {
    e.preventDefault();
    const inicio = new Date(cuando);
    const r = await api('/citas', {
      method: 'POST',
      body: JSON.stringify({
        miembroId: quien,
        inicio: inicio.toISOString(),
        fin: new Date(inicio.getTime() + duracion * 60_000).toISOString(),
        titulo,
        ...(link ? { link } : {}),
      }),
    });
    if (r.status >= 400) return setError(r.message ?? 'No se pudo agendar');
    onCreada();
  }

  return (
    <form onSubmit={crear} className="grid gap-3 rounded-2xl border border-linea bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
      {equipo.length > 1 && (
        <label className="text-sm font-medium">
          Con
          <select value={quien} onChange={(e) => setQuien(e.target.value)} className="mt-1 w-full rounded-xl border border-linea px-3 py-2">
            {equipo.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="text-sm font-medium">
        Fecha y hora
        <input type="datetime-local" required value={cuando} onChange={(e) => setCuando(e.target.value)} className="mt-1 w-full rounded-xl border border-linea px-3 py-2" />
      </label>
      <label className="text-sm font-medium">
        Minutos
        <input type="number" min={10} max={480} value={duracion} onChange={(e) => setDuracion(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-linea px-3 py-2" />
      </label>
      <label className="text-sm font-medium">
        Título
        <input required maxLength={200} value={titulo} onChange={(e) => setTitulo(e.target.value)} className="mt-1 w-full rounded-xl border border-linea px-3 py-2" />
      </label>
      <label className="text-sm font-medium">
        Enlace (opcional)
        <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet…" className="mt-1 w-full rounded-xl border border-linea px-3 py-2" />
      </label>
      <div className="flex items-end gap-2">
        <button className="rounded-xl bg-tinta px-4 py-2 text-sm font-semibold text-white">Agendar</button>
        <button type="button" onClick={onCerrar} className="px-2 py-2 text-sm text-gris">
          Cancelar
        </button>
      </div>
      {error && <p className="text-sm text-peligro sm:col-span-full">{error}</p>}
    </form>
  );
}

function Horario({ equipo }: { equipo: Miembro[] }) {
  const { miembro } = useMiembro();
  const [quien, setQuien] = useState(miembro.id);
  const [franjas, setFranjas] = useState<Franja[] | null>(null);
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
  const [estado, setEstado] = useState('');
  const [b, setB] = useState({ inicio: '', fin: '', motivo: '' });

  const cargarBloqueos = useCallback(() => {
    const desde = new Date();
    const hasta = masDias(desde, 120);
    api<Bloqueo[]>(`/bloqueos?desde=${desde.toISOString()}&hasta=${hasta.toISOString()}`).then((r) => setBloqueos((r.data ?? []).filter((x) => x.miembroId === quien)));
  }, [quien]);

  useEffect(() => {
    setFranjas(null);
    api<Franja[]>(`/miembros/${quien}/horarios`).then((r) => setFranjas((r.data ?? []).map((f) => ({ ...f, desde: f.desde.slice(0, 5), hasta: f.hasta.slice(0, 5) }))));
    cargarBloqueos();
  }, [quien, cargarBloqueos]);

  async function guardar() {
    setEstado('Guardando…');
    const r = await api(`/miembros/${quien}/horarios`, { method: 'PUT', body: JSON.stringify({ franjas }) });
    setEstado(r.status >= 400 ? (r.message ?? 'No se pudo guardar') : 'Guardado');
  }

  async function bloquear(e: FormEvent) {
    e.preventDefault();
    const r = await api('/bloqueos', {
      method: 'POST',
      body: JSON.stringify({ miembroId: quien, inicio: new Date(b.inicio).toISOString(), fin: new Date(b.fin).toISOString(), motivo: b.motivo }),
    });
    if (r.status >= 400) return setEstado(r.message ?? 'No se pudo bloquear');
    setB({ inicio: '', fin: '', motivo: '' });
    cargarBloqueos();
  }

  const editable = miembro.rol === 'gerente' || quien === miembro.id;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-3 rounded-2xl border border-linea bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-auto font-semibold">Horario de atención</h2>
          {equipo.length > 1 && (
            <select value={quien} onChange={(e) => setQuien(e.target.value)} aria-label="Miembro" className="rounded-xl border border-linea px-3 py-1.5 text-sm">
              {equipo.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          )}
        </div>
        {!franjas ? (
          <p className="text-sm text-gris">Cargando…</p>
        ) : (
          <ul className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 0].map((dia) => {
              const delDia = franjas.filter((f) => f.dia === dia);
              return (
                <li key={dia} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-24 font-medium">{DIAS[dia]}</span>
                  {delDia.length === 0 && <span className="text-gris">No atiende</span>}
                  {delDia.map((f) => {
                    const i = franjas.indexOf(f);
                    const cambiar = (c: Partial<Franja>) => setFranjas(franjas.map((x, j) => (j === i ? { ...x, ...c } : x)));
                    return (
                      <span key={i} className="flex items-center gap-1">
                        <input type="time" value={f.desde} disabled={!editable} onChange={(e) => cambiar({ desde: e.target.value })} aria-label={`${DIAS[dia]} desde`} className="rounded-lg border border-linea px-2 py-1" />
                        –
                        <input type="time" value={f.hasta} disabled={!editable} onChange={(e) => cambiar({ hasta: e.target.value })} aria-label={`${DIAS[dia]} hasta`} className="rounded-lg border border-linea px-2 py-1" />
                        {editable && (
                          <button onClick={() => setFranjas(franjas.filter((_, j) => j !== i))} className="p-1 text-gris hover:text-peligro" title="Quitar franja">
                            <IconoBasura className="size-4" />
                            <span className="sr-only">Quitar franja</span>
                          </button>
                        )}
                      </span>
                    );
                  })}
                  {editable && (
                    <button onClick={() => setFranjas([...franjas, { dia, desde: '09:00', hasta: '18:00' }])} className="text-xs text-uva underline">
                      Agregar franja
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {editable && (
          <div className="flex items-center gap-3">
            <button onClick={guardar} className="rounded-xl bg-tinta px-4 py-2 text-sm font-semibold text-white">
              Guardar horario
            </button>
            <span className="text-sm text-gris">{estado}</span>
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-2xl border border-linea bg-white p-5">
        <h2 className="font-semibold">Bloqueos (vacaciones, reuniones)</h2>
        {editable && (
          <form onSubmit={bloquear} className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Desde
              <input type="datetime-local" required value={b.inicio} onChange={(e) => setB({ ...b, inicio: e.target.value })} className="mt-1 w-full rounded-xl border border-linea px-3 py-2" />
            </label>
            <label className="text-sm font-medium">
              Hasta
              <input type="datetime-local" required value={b.fin} onChange={(e) => setB({ ...b, fin: e.target.value })} className="mt-1 w-full rounded-xl border border-linea px-3 py-2" />
            </label>
            <input value={b.motivo} maxLength={200} onChange={(e) => setB({ ...b, motivo: e.target.value })} placeholder="Motivo (opcional)" aria-label="Motivo" className="rounded-xl border border-linea px-3 py-2 text-sm" />
            <button className="rounded-xl bg-mango px-4 py-2 text-sm font-semibold text-tinta">Bloquear</button>
          </form>
        )}
        <ul className="divide-y divide-linea text-sm">
          {bloqueos.length === 0 && <li className="py-2 text-gris">Sin bloqueos próximos.</li>}
          {bloqueos.map((x) => (
            <li key={x.id} className="flex items-center gap-2 py-2">
              <span className="flex-1">
                {new Date(x.inicio).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })} →{' '}
                {new Date(x.fin).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}
                {x.motivo && <span className="text-gris">, {x.motivo}</span>}
              </span>
              {editable && (
                <button
                  onClick={() => api(`/bloqueos/${x.id}`, { method: 'DELETE' }).then(cargarBloqueos)}
                  className="p-1 text-gris hover:text-peligro"
                  title="Quitar bloqueo"
                >
                  <IconoBasura className="size-4" />
                  <span className="sr-only">Quitar bloqueo</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
