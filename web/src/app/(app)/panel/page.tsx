'use client';
import { useEffect, useMemo, useState } from 'react';
import { API, api, Linea, Miembro } from '@/lib/api';
import { useMiembro } from '@/lib/miembro-ctx';
import { leerToken } from '@/lib/sesion';
import InversionMeta, { ResumenAnuncios } from '@/components/panel/InversionMeta';

interface Periodo {
  ventas: { cantidad: number; monto: number; ticket: number; porLinea: { linea: string; cantidad: number; monto: number }[] };
  embudo: { leads: number; calificados: number; demoAgendada: number; demoRealizada: number; ganado: number };
  tiempos: { aDemoHoras: number | null; aRealizadaHoras: number | null; aGanadoHoras: number | null; cicloHoras: number | null };
  motivosPerdida: { motivo: string; n: number }[];
  motivosDescarte: { motivo: string; n: number }[];
  asistencia: { agendadas: number; realizadas: number; noAsistio: number; tasa: number | null };
  porComercial: {
    id: string;
    nombre: string;
    demosRealizadas: number;
    noAsistio: number;
    ganados: number;
    monto: number;
    tasaCierre: number | null;
    primeraRespuestaMin: number | null;
    sinAtender: number;
  }[];
  ia: {
    primeraRespuestaSeg: number | null;
    calificadosSinHumano: number | null;
    bajas: number;
    preguntasTop: { pregunta: string; n: number }[];
    traspasos: { motivo: string; n: number }[];
  };
  seguimiento: { entraron: number; volvieron: number | null; llegaronADemo: number | null };
  anuncios: { anuncio: string; id: string | null; leads: number; demos: number; ganados: number; monto: number }[];
  cuando: { porDia: number[]; porHora: number[]; fueraDeHorario: number | null };
}
interface Kpis {
  actual: Periodo;
  anterior: Periodo;
  proximo: { demos: number; seguimientoActivos: number };
  anuncios: ResumenAnuncios | null;
}

const RANGOS = { 7: 'Últimos 7 días', 30: 'Últimos 30 días', 90: 'Últimos 90 días' } as const;
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const TRASPASO: Record<string, string> = { pide_humano: 'Pidió una persona', molesto: 'Cliente molesto', demo: 'Agendó demo' };
const soles = (n: number) => n.toLocaleString('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 });
const duracion = (h: number | null) => (h === null ? '—' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} días`);
const pct = (n: number | null) => (n === null ? '—' : `${n}%`);

export default function Panel() {
  const { miembro } = useMiembro();
  const [dias, setDias] = useState<keyof typeof RANGOS>(30);
  const [lineaId, setLineaId] = useState('');
  const [duenoId, setDuenoId] = useState('');
  const [origen, setOrigen] = useState('');
  const [k, setK] = useState<Kpis | null>(null);
  const [error, setError] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [equipo, setEquipo] = useState<Miembro[]>([]);

  const q = useMemo(() => {
    const hasta = new Date();
    const p = new URLSearchParams({ desde: new Date(hasta.getTime() - dias * 86_400_000).toISOString(), hasta: hasta.toISOString() });
    if (lineaId) p.set('lineaId', lineaId);
    if (duenoId) p.set('duenoId', duenoId);
    if (origen) p.set('origen', origen);
    return p.toString();
  }, [dias, lineaId, duenoId, origen]);

  useEffect(() => {
    setK(null);
    api<Kpis>(`/panel/kpis?${q}`).then((r) => (r.data ? setK(r.data) : setError(r.message ?? 'No se pudo cargar el panel')));
  }, [q]);
  useEffect(() => {
    api<Linea[]>('/lineas').then((r) => setLineas(r.data ?? []));
    api<Miembro[]>('/miembros').then((r) => setEquipo((r.data ?? []).filter((m) => m.estado === 'activo')));
  }, []);

  async function excel() {
    const res = await fetch(`${API}/panel/excel?${q}`, { headers: { Authorization: `Bearer ${leerToken()}` } }).catch(() => null);
    if (!res?.ok) return setError('No se pudo descargar el Excel');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await res.blob());
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (miembro.rol !== 'gerente') return <p className="p-8 text-gris">El panel es solo para gerentes.</p>;

  const a = k?.actual;
  const b = k?.anterior;
  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-end gap-2">
        <h1 className="mr-auto font-display text-3xl font-bold">Panel</h1>
        <select value={dias} onChange={(e) => setDias(Number(e.target.value) as keyof typeof RANGOS)} aria-label="Rango" className="rounded-xl border border-linea bg-white px-3 py-2 text-sm">
          {Object.entries(RANGOS).map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
        <select value={lineaId} onChange={(e) => setLineaId(e.target.value)} aria-label="Línea" className="rounded-xl border border-linea bg-white px-3 py-2 text-sm">
          <option value="">Todas las líneas</option>
          {lineas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nombre}
            </option>
          ))}
        </select>
        <select value={duenoId} onChange={(e) => setDuenoId(e.target.value)} aria-label="Comercial" className="rounded-xl border border-linea bg-white px-3 py-2 text-sm">
          <option value="">Todo el equipo</option>
          {equipo.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
        <select value={origen} onChange={(e) => setOrigen(e.target.value)} aria-label="Origen" className="rounded-xl border border-linea bg-white px-3 py-2 text-sm">
          <option value="">Todo origen</option>
          <option value="anuncio">Anuncios</option>
          <option value="organico">Orgánico</option>
        </select>
        <button onClick={excel} className="rounded-xl bg-tinta px-4 py-2 text-sm font-semibold text-white">
          Descargar Excel
        </button>
      </header>
      {error && <p className="text-sm text-peligro">{error}</p>}

      {!a || !b || !k ? (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Cifra titulo="Vendido" valor={soles(a.ventas.monto)} actual={a.ventas.monto} anterior={b.ventas.monto} />
            <Cifra titulo="Ventas" valor={String(a.ventas.cantidad)} actual={a.ventas.cantidad} anterior={b.ventas.cantidad} />
            <Cifra titulo="Ticket promedio" valor={soles(a.ventas.ticket)} actual={a.ventas.ticket} anterior={b.ventas.ticket} />
            <Cifra titulo="Leads nuevos" valor={String(a.embudo.leads)} actual={a.embudo.leads} anterior={b.embudo.leads} />
            <Cifra titulo="Asistencia a demos" valor={pct(a.asistencia.tasa)} actual={a.asistencia.tasa} anterior={b.asistencia.tasa} />
            <Cifra titulo="Ciclo de venta" valor={duracion(a.tiempos.cicloHoras)} actual={a.tiempos.cicloHoras} anterior={b.tiempos.cicloHoras} menosEsMejor />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Caja titulo="¿Dónde se cae la gente?" className="lg:col-span-2">
              <Embudo e={a.embudo} />
            </Caja>
            <Caja titulo="Lo que viene">
              <dl className="grid grid-cols-2 gap-3">
                <Dato titulo="Demos próximos 7 días" valor={k.proximo.demos} />
                <Dato titulo="En seguimiento" valor={k.proximo.seguimientoActivos} />
                <Dato titulo="Tiempo a la demo" valor={duracion(a.tiempos.aDemoHoras)} />
                <Dato titulo="Demo a venta" valor={duracion(a.tiempos.aGanadoHoras)} />
              </dl>
            </Caja>
          </div>

          <Caja titulo="Cómo rinde cada comercial">
            {a.porComercial.length === 0 ? (
              <p className="text-sm text-gris">Sin actividad en el período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead className="text-left text-xs text-gris">
                    <tr>
                      <th className="py-2 font-medium">Comercial</th>
                      <th className="py-2 text-right font-medium">Demos</th>
                      <th className="py-2 text-right font-medium">No vinieron</th>
                      <th className="py-2 text-right font-medium">Ventas</th>
                      <th className="py-2 text-right font-medium">Cierre</th>
                      <th className="py-2 text-right font-medium">Vendido</th>
                      <th className="py-2 text-right font-medium">1.ª respuesta</th>
                      <th className="py-2 text-right font-medium">Sin atender</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-linea tabular-nums">
                    {a.porComercial.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2 font-medium">{c.nombre}</td>
                        <td className="py-2 text-right">{c.demosRealizadas}</td>
                        <td className="py-2 text-right">{c.noAsistio}</td>
                        <td className="py-2 text-right">{c.ganados}</td>
                        <td className="py-2 text-right">{pct(c.tasaCierre)}</td>
                        <td className="py-2 text-right">{soles(c.monto)}</td>
                        <td className="py-2 text-right">{c.primeraRespuestaMin === null ? '—' : `${c.primeraRespuestaMin} min`}</td>
                        <td className={`py-2 text-right ${c.sinAtender ? 'font-semibold text-peligro' : ''}`}>{c.sinAtender}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Caja>

          <div className="grid gap-4 lg:grid-cols-3">
            <Caja titulo="Cómo rinde la IA">
              <dl className="grid grid-cols-2 gap-3">
                <Dato titulo="Primera respuesta" valor={a.ia.primeraRespuestaSeg === null ? '—' : `${Math.round(a.ia.primeraRespuestaSeg)} s`} />
                <Dato titulo="Calificados sin ayuda" valor={pct(a.ia.calificadosSinHumano)} />
                <Dato titulo="Pidieron no ser contactados" valor={a.ia.bajas} />
              </dl>
              <Lista titulo="Traspasos a una persona" filas={a.ia.traspasos.map((t) => ({ texto: TRASPASO[t.motivo] ?? t.motivo, n: t.n }))} />
              <Lista titulo="Lo que más preguntan y la IA no sabe" filas={a.ia.preguntasTop.map((p) => ({ texto: p.pregunta, n: p.n }))} />
            </Caja>
            <Caja titulo="¿Por qué perdemos?">
              <Lista titulo="Motivos de pérdida" filas={a.motivosPerdida.map((m) => ({ texto: m.motivo, n: m.n }))} />
              <Lista titulo="Motivos de descarte" filas={a.motivosDescarte.map((m) => ({ texto: m.motivo, n: m.n }))} />
            </Caja>
            <Caja titulo="¿Funciona el seguimiento?">
              <dl className="grid grid-cols-2 gap-3">
                <Dato titulo="Entraron a seguimiento" valor={a.seguimiento.entraron} />
                <Dato titulo="Volvieron a responder" valor={pct(a.seguimiento.volvieron)} />
                <Dato titulo="Llegaron a demo" valor={pct(a.seguimiento.llegaronADemo)} />
              </dl>
              <Lista titulo="Vendido por línea" filas={a.ventas.porLinea.map((l) => ({ texto: l.linea, n: l.monto, etiqueta: soles(l.monto) }))} />
            </Caja>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Caja titulo="¿Cuándo escriben?">
              <Barras valores={a.cuando.porHora} etiquetas={a.cuando.porHora.map((_, h) => `${h}:00`)} cada={3} />
              <div className="mt-4">
                <Barras valores={a.cuando.porDia} etiquetas={DIAS} cada={1} />
              </div>
              <p className="mt-3 text-sm text-gris">
                {a.cuando.fueraDeHorario === null
                  ? 'Configura los horarios del equipo en Calendario para ver cuántos escriben fuera de horario.'
                  : `${a.cuando.fueraDeHorario}% escribió fuera del horario del equipo (ahí atiende la IA).`}
              </p>
            </Caja>
            <Caja titulo="¿Qué publicidad conviene?">
              {a.anuncios.length === 0 ? (
                <p className="text-sm text-gris">Ningún lead llegó por un anuncio de Meta en el período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[28rem] text-sm">
                    <thead className="text-left text-xs text-gris">
                      <tr>
                        <th className="py-2 font-medium">Anuncio</th>
                        <th className="py-2 text-right font-medium">Leads</th>
                        <th className="py-2 text-right font-medium">Demos</th>
                        <th className="py-2 text-right font-medium">Ventas</th>
                        <th className="py-2 text-right font-medium">Vendido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-linea tabular-nums">
                      {a.anuncios.map((x) => (
                        <tr key={`${x.anuncio}-${x.id}`}>
                          <td className="max-w-56 truncate py-2" title={x.anuncio}>
                            {x.anuncio}
                          </td>
                          <td className="py-2 text-right">{x.leads}</td>
                          <td className="py-2 text-right">{x.demos}</td>
                          <td className="py-2 text-right">{x.ganados}</td>
                          <td className="py-2 text-right">{soles(x.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!k.anuncios && (
                <p className="mt-3 text-xs text-gris">
                  Conecta tu cuenta publicitaria en{' '}
                  <a href="/canales" className="underline">
                    Canales
                  </a>{' '}
                  para ver cuánto cuesta cada lead, demo y venta.
                </p>
              )}
            </Caja>
          </div>

          {k.anuncios && (
            <Caja titulo="Inversión en Meta Ads">
              <InversionMeta r={k.anuncios} />
            </Caja>
          )}
        </>
      )}
    </section>
  );
}

function Caja({ titulo, children, className = '' }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`space-y-3 rounded-2xl border border-linea bg-white p-5 ${className}`}>
      <h2 className="font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string | number }) {
  return (
    <div>
      <dt className="text-xs text-gris">{titulo}</dt>
      <dd className="font-display text-xl font-bold tabular-nums">{valor}</dd>
    </div>
  );
}

// Cifra con su variación contra el período anterior; en rojo si empeora más de 20 %.
function Cifra({ titulo, valor, actual, anterior, menosEsMejor = false }: { titulo: string; valor: string; actual: number | null; anterior: number | null; menosEsMejor?: boolean }) {
  const cambio = actual !== null && anterior ? Math.round(((actual - anterior) / anterior) * 100) : null;
  const empeora = cambio !== null && (menosEsMejor ? cambio > 20 : cambio < -20);
  return (
    <div className="rounded-2xl border border-linea bg-white p-4">
      <p className="text-sm text-gris">{titulo}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums">{valor}</p>
      <p className={`mt-1 text-xs ${empeora ? 'font-semibold text-peligro' : 'text-gris'}`}>
        {cambio === null ? 'sin datos del período anterior' : `${cambio > 0 ? '▲' : cambio < 0 ? '▼' : '='} ${Math.abs(cambio)}% vs. período anterior`}
      </p>
    </div>
  );
}

const PASOS = [
  ['leads', 'Leads'],
  ['calificados', 'Calificados'],
  ['demoAgendada', 'Demo agendada'],
  ['demoRealizada', 'Demo realizada'],
  ['ganado', 'Ganado'],
] as const;

// Embudo por cohorte: cada barra es cuántos de los leads del período llegaron a esa etapa.
function Embudo({ e }: { e: Periodo['embudo'] }) {
  const max = Math.max(e.leads, 1);
  const tasas = PASOS.map(([k], i) => (i === 0 ? null : e[PASOS[i - 1][0]] ? e[k] / e[PASOS[i - 1][0]] : null));
  const peor = tasas.reduce<number | null>((p, t, i) => (t !== null && (p === null || t < (tasas[p] ?? 1)) ? i : p), null);
  return (
    <ol className="space-y-2.5">
      {PASOS.map(([k, texto], i) => (
        <li key={k} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-sm">
          <span className="text-gris">{texto}</span>
          <span className="h-6 rounded-r bg-papel" title={`${texto}: ${e[k]}`}>
            <span className="block h-full rounded-r-[4px] bg-uva" style={{ width: `${(e[k] / max) * 100}%` }} />
          </span>
          <span className="w-28 text-right tabular-nums">
            <span className="font-semibold">{e[k]}</span>
            {tasas[i] !== null && (
              <span className={`ml-2 text-xs ${i === peor ? 'font-semibold text-peligro' : 'text-gris'}`}>{Math.round(tasas[i]! * 100)}% pasa</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Lista({ titulo, filas }: { titulo: string; filas: { texto: string; n: number; etiqueta?: string }[] }) {
  const max = Math.max(...filas.map((f) => f.n), 1);
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold text-gris">{titulo}</h3>
      {filas.length === 0 ? (
        <p className="text-sm text-gris">Nada en el período.</p>
      ) : (
        <ul className="space-y-1.5">
          {filas.map((f) => (
            <li key={f.texto} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate" title={f.texto}>
                  {f.texto}
                </span>
                <span className="tabular-nums">{f.etiqueta ?? f.n}</span>
              </div>
              <span className="mt-0.5 block h-1.5 rounded-full bg-papel">
                <span className="block h-full rounded-full bg-uva" style={{ width: `${(f.n / max) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Barras verticales de una sola serie; el número aparece al pasar el mouse.
function Barras({ valores, etiquetas, cada }: { valores: number[]; etiquetas: string[]; cada: number }) {
  const max = Math.max(...valores, 1);
  return (
    <div>
      <div className="flex h-28 items-end gap-0.5 border-b border-linea" role="img" aria-label={etiquetas.map((e, i) => `${e}: ${valores[i]}`).join(', ')}>
        {valores.map((v, i) => (
          <span key={i} className="group relative flex h-full flex-1 items-end" title={`${etiquetas[i]}: ${v}`}>
            <span className="block w-full rounded-t-[4px] bg-uva transition-opacity group-hover:opacity-80" style={{ height: `${(v / max) * 100}%`, minHeight: v ? 2 : 0 }} />
          </span>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5 text-[10px] text-gris">
        {etiquetas.map((e, i) => (
          <span key={e} className="flex-1 text-center">
            {i % cada === 0 ? e : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
